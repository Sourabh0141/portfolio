import { vi } from 'vitest';
import type { ErrorResponse } from '../../shared/munshi';
import type { Bindings } from '../src/env';
import { handleRequest } from '../src/index';
import { issueSession } from '../src/session';

export const ORIGIN = 'https://portfolio.test';
export const SESSION_KEY = 'test-session-signing-key-0123456789abcdef';

const allow: RateLimit = { limit: async () => ({ success: true }) };
export const deny: RateLimit = { limit: async () => ({ success: false }) };

/**
 * A complete set of bindings. The limiters always allow; a test that needs a refusal swaps in
 * `deny`. The secrets are stand-ins, not real credentials.
 */
export const testEnv: Bindings = {
  SESSION_LIMITER: allow,
  CHAT_IP_LIMITER: allow,
  CHAT_GLOBAL_LIMITER: allow,
  APP_VERSION: '1.0.0',
  MUNSHI_ENABLED: 'true',
  ALLOWED_ORIGINS: ORIGIN,
  DEEPINFRA_BASE_URL: 'https://api.deepinfra.com/v1/openai',
  DEEPINFRA_MODEL: 'test-model',
  TURNSTILE_VERIFY_URL: 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
  TURNSTILE_HOSTNAME: 'portfolio.test',
  DEEPINFRA_API_KEY: 'test-deepinfra-key',
  MUNSHI_SESSION_KEY: SESSION_KEY,
  TURNSTILE_SECRET_KEY: 'test-turnstile-secret',
};

export interface CallOptions {
  method?: string;
  origin?: string | null;
  token?: string;
  json?: unknown;
  body?: BodyInit;
  headers?: Record<string, string>;
  env?: Bindings;
}

export function call(path: string, options: CallOptions = {}): Promise<Response> {
  const headers = new Headers(options.headers);
  if (options.origin !== null) headers.set('origin', options.origin ?? ORIGIN);
  if (options.token) headers.set('authorization', `Bearer ${options.token}`);

  let body = options.body;
  if (options.json !== undefined) {
    headers.set('content-type', 'application/json');
    body = JSON.stringify(options.json);
  }

  const request = new Request(`https://munshi.test${path}`, {
    method: options.method ?? (body === undefined ? 'GET' : 'POST'),
    headers,
    ...(body === undefined ? {} : { body }),
  });
  return handleRequest(request, options.env ?? testEnv);
}

export async function sessionToken(now?: number): Promise<string> {
  return (await issueSession(SESSION_KEY, now)).token;
}

export async function errorCode(response: Response): Promise<string> {
  return ((await response.json()) as ErrorResponse).error.code;
}

export interface UpstreamCall {
  url: string;
  init: RequestInit;
}

type Handler = (call: UpstreamCall) => Response | Promise<Response>;

/**
 * Replaces global fetch. Calls to the model and to Turnstile go to the given handlers; any
 * other URL fails loudly, so a test can never reach the network by accident.
 */
export function stubUpstream(handlers: { chat?: Handler; turnstile?: Handler }) {
  const calls: UpstreamCall[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const record = { url, init };
    calls.push(record);
    if (url.endsWith('/chat/completions') && handlers.chat) return handlers.chat(record);
    if (url.endsWith('/siteverify') && handlers.turnstile) return handlers.turnstile(record);
    throw new Error(`Unexpected upstream call: ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
}

/** A streamed chat completion in the provider's format, split into small frames. */
export function chatStreamBody(text: string, chunkSize = 7): string {
  let body = '';
  for (let i = 0; i < text.length; i += chunkSize) {
    const frame = { choices: [{ delta: { content: text.slice(i, i + chunkSize) } }] };
    body += `data: ${JSON.stringify(frame)}\n\n`;
  }
  return `${body}data: [DONE]\n\n`;
}

export function chatStreamResponse(text: string): Response {
  return new Response(chatStreamBody(text), {
    status: 200,
    headers: { 'content-type': 'text/event-stream', 'x-provider-internal': 'do-not-forward' },
  });
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Captures the Worker's log lines for one test. */
export function captureLogs() {
  const lines: Record<string, unknown>[] = [];
  const record = (line: unknown) => {
    lines.push(JSON.parse(String(line)) as Record<string, unknown>);
  };
  vi.spyOn(console, 'log').mockImplementation(record);
  vi.spyOn(console, 'warn').mockImplementation(record);
  vi.spyOn(console, 'error').mockImplementation(record);
  return lines;
}
