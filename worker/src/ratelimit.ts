import { ApiError } from './errors.ts';

/** Matches the 60 second window configured for every limiter in wrangler.jsonc. */
const WINDOW_SECONDS = '60';

/**
 * Applies one Rate Limiting binding. The binding is required in production: a deploy without
 * it would leave the model budget unprotected, so a missing binding refuses the request
 * instead of letting it through.
 */
export async function enforceRateLimit(
  limiter: RateLimit | undefined,
  key: string,
  scope: string,
): Promise<void> {
  if (!limiter) {
    throw new ApiError('unavailable', 'Munshi is not available right now.', {
      detail: { reason: 'rate_limiter_missing', scope },
    });
  }
  const { success } = await limiter.limit({ key });
  if (!success) {
    throw new ApiError('rate_limited', 'Too many messages. Please wait a minute and try again.', {
      headers: { 'Retry-After': WINDOW_SECONDS },
      detail: { scope },
    });
  }
}
