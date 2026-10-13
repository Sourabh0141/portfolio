import type { ErrorCode } from '../../shared/munshi.ts';

const STATUS: Record<ErrorCode, number> = {
  invalid_request: 400,
  payload_too_large: 413,
  unsupported_media_type: 415,
  forbidden_origin: 403,
  challenge_failed: 403,
  session_required: 401,
  session_expired: 401,
  rate_limited: 429,
  not_found: 404,
  method_not_allowed: 405,
  unavailable: 503,
};

/**
 * An error with a stable code the page can act on. `message` is safe to show a visitor.
 * `detail` is for the log only and is never sent in a response.
 */
export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly headers: Record<string, string>;
  readonly detail: Record<string, unknown> | undefined;

  constructor(
    code: ErrorCode,
    message: string,
    options: { headers?: Record<string, string>; detail?: Record<string, unknown> } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = STATUS[code];
    this.headers = options.headers ?? {};
    this.detail = options.detail;
  }
}
