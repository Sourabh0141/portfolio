/**
 * Contract between the portfolio page and the Munshi Worker. Both sides import this file,
 * so a limit or error code cannot drift between the browser and the API.
 */

/** Versioned so a new Worker can keep serving a page that was cached before a deploy. */
export const ROUTES = {
  health: '/v1/health',
  session: '/v1/session',
  chat: '/v1/chat',
} as const;

export const LIMITS = {
  /** Largest request body the Worker reads, in bytes. */
  bodyBytes: 16_384,
  /** Most messages accepted in one request. The browser trims older turns before sending. */
  messages: 12,
  /** Longest visitor message, in characters. Also the textarea maxlength. */
  userChars: 600,
  /** Longest earlier answer accepted back as history, in characters. */
  assistantChars: 2_000,
  /** Longest Turnstile token accepted. Cloudflare documents 2048 as the maximum. */
  turnstileTokenChars: 2_048,
} as const;

/** Passed to Turnstile by the page and checked by the Worker, so a token minted elsewhere fails. */
export const TURNSTILE_ACTION = 'munshi';

export const ERROR_CODES = [
  'invalid_request',
  'payload_too_large',
  'unsupported_media_type',
  'forbidden_origin',
  'challenge_failed',
  'session_required',
  'session_expired',
  'rate_limited',
  'not_found',
  'method_not_allowed',
  'unavailable',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
}

export interface SessionRequest {
  turnstileToken: string;
}

export interface SessionResponse {
  token: string;
  /** Unix time in seconds. */
  expiresAt: number;
}

export interface HealthResponse {
  status: 'ok';
  enabled: boolean;
  version: string;
  knowledge: string;
}

export interface ErrorResponse {
  error: { code: ErrorCode; message: string; requestId: string };
}

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && (ERROR_CODES as readonly string[]).includes(value);
}
