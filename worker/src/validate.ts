import { LIMITS } from '../../shared/munshi.ts';
import type { ChatMessage, ChatRequest, SessionRequest } from '../../shared/munshi.ts';
import { ApiError } from './errors.ts';

const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false });

function invalid(message: string): ApiError {
  return new ApiError('invalid_request', message);
}

/**
 * Reads a JSON body without trusting Content-Length. The header is checked first so an honest
 * oversized request is refused before any bytes are read, and the stream is then counted so a
 * chunked request cannot exceed the cap either.
 */
export async function readJsonBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!/^application\/json\s*(;|$)/i.test(contentType)) {
    throw new ApiError('unsupported_media_type', 'Send the request as application/json.');
  }

  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > LIMITS.bodyBytes) {
    throw new ApiError('payload_too_large', 'The request is too large.');
  }
  if (!request.body) throw invalid('The request has no body.');

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > LIMITS.bodyBytes) {
      await reader.cancel();
      throw new ApiError('payload_too_large', 'The request is too large.');
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(decoder.decode(bytes)) as unknown;
  } catch {
    throw invalid('The request body is not valid JSON.');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Control characters other than tab and newline have no place in a chat message and are a
 * common way to smuggle text past a reader. They are removed, not rejected.
 */
function clean(text: string): string {
  return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
}

/**
 * The page keeps the conversation and sends it back each time, so every field here is
 * visitor-controlled, including the "assistant" turns. Only the two chat roles are accepted:
 * a client can never supply a system message.
 */
export function parseChatRequest(body: unknown): ChatRequest {
  if (!isRecord(body) || !Array.isArray(body['messages'])) {
    throw invalid('Expected an object with a "messages" array.');
  }
  const raw: unknown[] = body['messages'];
  if (raw.length === 0) throw invalid('Send at least one message.');
  if (raw.length > LIMITS.messages) {
    throw invalid(`Send at most ${LIMITS.messages} messages.`);
  }

  const messages: ChatMessage[] = raw.map((entry) => {
    if (!isRecord(entry)) throw invalid('Each message must be an object.');
    const { role, content } = entry;
    if (role !== 'user' && role !== 'assistant') {
      throw invalid('A message role must be "user" or "assistant".');
    }
    if (typeof content !== 'string') throw invalid('A message content must be a string.');

    const text = clean(content);
    if (text.length === 0) throw invalid('A message cannot be empty.');
    const limit = role === 'user' ? LIMITS.userChars : LIMITS.assistantChars;
    if (text.length > limit) {
      throw invalid(`A ${role} message can be at most ${limit} characters.`);
    }
    return { role, content: text };
  });

  if (messages[0]?.role !== 'user') throw invalid('The first message must be from the user.');
  if (messages.at(-1)?.role !== 'user') throw invalid('The last message must be from the user.');
  return { messages };
}

export function parseSessionRequest(body: unknown): SessionRequest {
  if (!isRecord(body) || typeof body['turnstileToken'] !== 'string') {
    throw invalid('Expected an object with a "turnstileToken" string.');
  }
  const turnstileToken = body['turnstileToken'].trim();
  if (turnstileToken.length === 0 || turnstileToken.length > LIMITS.turnstileTokenChars) {
    throw invalid('The verification token is missing or malformed.');
  }
  return { turnstileToken };
}
