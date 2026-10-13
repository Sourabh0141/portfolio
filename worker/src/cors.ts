import { ApiError } from './errors.ts';

const ALLOW_METHODS = 'GET, POST, OPTIONS';
const ALLOW_HEADERS = 'Authorization, Content-Type';
/** Browsers cap this lower, Chromium at 2 hours. A day is the most any of them honours. */
const PREFLIGHT_MAX_AGE = '86400';

export function isAllowedOrigin(origin: string | null, allowed: readonly string[]): boolean {
  return origin !== null && allowed.includes(origin.toLowerCase());
}

/**
 * Headers for a response to `origin`. An origin that is not on the list gets no
 * Access-Control-Allow-Origin, so the browser refuses to hand the response to the page.
 * `Vary: Origin` is always set so a shared cache never serves one origin's headers to another.
 */
export function corsHeaders(origin: string | null, allowed: readonly string[]): Headers {
  const headers = new Headers({ Vary: 'Origin' });
  if (origin !== null && isAllowedOrigin(origin, allowed)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Expose-Headers', 'Retry-After, X-Request-Id');
  }
  return headers;
}

export function preflightResponse(origin: string | null, allowed: readonly string[]): Response {
  const headers = corsHeaders(origin, allowed);
  if (!isAllowedOrigin(origin, allowed)) return new Response(null, { status: 403, headers });

  headers.set('Access-Control-Allow-Methods', ALLOW_METHODS);
  headers.set('Access-Control-Allow-Headers', ALLOW_HEADERS);
  headers.set('Access-Control-Max-Age', PREFLIGHT_MAX_AGE);
  return new Response(null, { status: 204, headers });
}

/**
 * CORS only stops a browser from reading a response. This also refuses to do the work, so a
 * page on another site cannot spend the model budget even though it could never see the answer.
 * A script that forges the header is still stopped by Turnstile and the rate limits.
 */
export function requireAllowedOrigin(origin: string | null, allowed: readonly string[]): void {
  if (!isAllowedOrigin(origin, allowed)) {
    throw new ApiError('forbidden_origin', 'This origin is not allowed to use Munshi.', {
      detail: { origin: origin?.slice(0, 200) ?? null },
    });
  }
}
