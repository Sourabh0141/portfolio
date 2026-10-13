import { ROUTES } from '../../shared/munshi.ts';
import type { ErrorResponse, HealthResponse } from '../../shared/munshi.ts';
import { isEnabled, loadConfig, parseAllowedOrigins } from './config.ts';
import { corsHeaders, preflightResponse, requireAllowedOrigin } from './cors.ts';
import { startChatStream } from './deepinfra.ts';
import type { Bindings } from './env.ts';
import { ApiError } from './errors.ts';
import { KNOWLEDGE_VERSION } from './generated/knowledge.ts';
import { rootLogger } from './logger.ts';
import type { LogFields } from './logger.ts';
import { buildMessages } from './prompt.ts';
import { enforceRateLimit } from './ratelimit.ts';
import { redactForLog } from './redact.ts';
import { bearerToken, issueSession, verifySession } from './session.ts';
import { verifyTurnstile } from './turnstile.ts';
import { parseChatRequest, parseSessionRequest, readJsonBody } from './validate.ts';

/** Sent on every response. The API returns data, never a document a browser should render. */
const BASE_HEADERS: Record<string, string> = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

interface RequestContext {
  request: Request;
  env: Bindings;
  /** Fields added here are written on the single log line for this request. */
  log: LogFields;
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

function clientIp(request: Request): string {
  return request.headers.get('cf-connecting-ip') ?? 'unknown';
}

function health(env: Bindings): Response {
  const body: HealthResponse = {
    status: 'ok',
    enabled: isEnabled(env),
    version: env.APP_VERSION ?? 'dev',
    knowledge: KNOWLEDGE_VERSION,
  };
  return json(body);
}

/** Exchanges a solved Turnstile challenge for a short-lived session token. */
async function createSession({ request, env }: RequestContext): Promise<Response> {
  const config = loadConfig(env);
  requireAllowedOrigin(request.headers.get('origin'), config.allowedOrigins);
  if (!config.enabled) throw new ApiError('unavailable', 'Munshi is switched off right now.');

  const ip = clientIp(request);
  await enforceRateLimit(env.SESSION_LIMITER, `session:${ip}`, 'session_ip');

  const { turnstileToken } = parseSessionRequest(await readJsonBody(request));
  await verifyTurnstile(config.turnstile, turnstileToken, ip === 'unknown' ? null : ip);

  return json(await issueSession(config.sessionKey));
}

/**
 * Checks are ordered cheapest first, and everything that can refuse a request runs before
 * the one step that costs money.
 */
async function chat({ request, env, log }: RequestContext): Promise<Response> {
  const config = loadConfig(env);
  requireAllowedOrigin(request.headers.get('origin'), config.allowedOrigins);
  if (!config.enabled) throw new ApiError('unavailable', 'Munshi is switched off right now.');

  await enforceRateLimit(env.CHAT_IP_LIMITER, `chat:${clientIp(request)}`, 'chat_ip');
  log['session'] = await verifySession(config.sessionKey, bearerToken(request));

  const { messages } = parseChatRequest(await readJsonBody(request));
  const question = messages.at(-1)?.content ?? '';
  log['messages'] = messages.length;
  log['input_chars'] = messages.reduce((total, message) => total + message.content.length, 0);
  log['question'] = redactForLog(question);
  log['model'] = config.deepinfra.model;
  log['knowledge'] = KNOWLEDGE_VERSION;

  await enforceRateLimit(env.CHAT_GLOBAL_LIMITER, 'chat:global', 'chat_global');

  const stream = await startChatStream(config.deepinfra, buildMessages(messages));
  log['upstream_attempts'] = stream.attempts;
  log['first_byte_ms'] = stream.firstByteMs;

  // A new Response, so none of the provider's own headers reach the visitor.
  return new Response(stream.body, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream; charset=utf-8' },
  });
}

async function route(context: RequestContext, path: string): Promise<Response> {
  const { request, env } = context;
  const handlers: Record<string, { method: string; run: () => Promise<Response> | Response }> = {
    [ROUTES.health]: { method: 'GET', run: () => health(env) },
    [ROUTES.session]: { method: 'POST', run: () => createSession(context) },
    [ROUTES.chat]: { method: 'POST', run: () => chat(context) },
  };

  const handler = handlers[path];
  if (!handler) throw new ApiError('not_found', 'No such endpoint.');
  if (request.method !== handler.method) {
    throw new ApiError('method_not_allowed', `Use ${handler.method} for this endpoint.`, {
      headers: { Allow: `${handler.method}, OPTIONS` },
    });
  }
  return handler.run();
}

function errorResponse(error: unknown, requestId: string, log: LogFields): Response {
  // Anything that is not an ApiError is a bug. The visitor gets the same generic answer as an
  // outage; the log line carries the detail.
  const apiError =
    error instanceof ApiError
      ? error
      : new ApiError('unavailable', 'Munshi is not available right now.', {
          detail: { reason: 'unhandled', error },
        });

  log['outcome'] = apiError.code;
  if (apiError.detail) log['detail'] = apiError.detail;

  const body: ErrorResponse = {
    error: { code: apiError.code, message: apiError.message, requestId },
  };
  return json(body, apiError.status, apiError.headers);
}

export async function handleRequest(request: Request, env: Bindings): Promise<Response> {
  const started = Date.now();
  const requestId = crypto.randomUUID();
  const url = new URL(request.url);
  const origin = request.headers.get('origin');
  const allowed = parseAllowedOrigins(env.ALLOWED_ORIGINS);

  if (request.method === 'OPTIONS') return preflightResponse(origin, allowed);

  const log: LogFields = { outcome: 'ok' };
  let response: Response;
  try {
    response = await route({ request, env, log }, url.pathname);
  } catch (error) {
    response = errorResponse(error, requestId, log);
  }

  // Responses from fetch() have immutable headers, so the final response is always rebuilt.
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(BASE_HEADERS)) headers.set(name, value);
  for (const [name, value] of corsHeaders(origin, allowed)) headers.set(name, value);
  headers.set('X-Request-Id', requestId);

  const level = response.status >= 500 ? 'error' : response.status >= 400 ? 'warn' : 'info';
  rootLogger[level]('request', {
    request_id: requestId,
    method: request.method,
    path: url.pathname.slice(0, 100),
    status: response.status,
    // Time until the response started. A streamed answer keeps flowing after this line.
    duration_ms: Date.now() - started,
    country: (request.cf?.country as string | undefined) ?? null,
    ...log,
  });

  return new Response(response.body, { status: response.status, headers });
}

export default {
  fetch: (request, env) => handleRequest(request, env),
} satisfies ExportedHandler<Bindings>;
