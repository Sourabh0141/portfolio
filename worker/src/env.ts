/**
 * Bindings the Worker reads. Declared by hand instead of using the generated `Env`, because
 * `wrangler types` narrows every var to the literal in wrangler.jsonc and cannot see the
 * secrets that CI uploads.
 */
export interface Bindings {
  SESSION_LIMITER?: RateLimit;
  CHAT_IP_LIMITER?: RateLimit;
  CHAT_GLOBAL_LIMITER?: RateLimit;

  APP_VERSION?: string;
  MUNSHI_ENABLED?: string;
  ALLOWED_ORIGINS?: string;
  DEEPINFRA_BASE_URL?: string;
  DEEPINFRA_MODEL?: string;
  TURNSTILE_VERIFY_URL?: string;
  TURNSTILE_HOSTNAME?: string;

  /** Secrets. Uploaded by CI from GitHub; absent from wrangler.jsonc. */
  DEEPINFRA_API_KEY?: string;
  MUNSHI_SESSION_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
}
