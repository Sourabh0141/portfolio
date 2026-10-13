import { TURNSTILE_ACTION } from '../../shared/munshi.ts';
import type { Config } from './config.ts';
import { ApiError } from './errors.ts';
import { isTimeoutError, timeoutSignal } from './timeout.ts';

const VERIFY_TIMEOUT_MS = 5_000;

interface SiteverifyResult {
  success?: unknown;
  hostname?: unknown;
  action?: unknown;
  'error-codes'?: unknown;
}

/**
 * Checks a Turnstile token with Cloudflare. A token is single-use and valid for 5 minutes;
 * the caller exchanges it for a session token straight away.
 *
 * A wrong token is the visitor's problem (`challenge_failed`). Cloudflare being unreachable is
 * ours (`unavailable`), and the page offers a retry.
 */
export async function verifyTurnstile(
  config: Config['turnstile'],
  token: string,
  clientIp: string | null,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const form = new URLSearchParams({ secret: config.secretKey, response: token });
  if (clientIp) form.set('remoteip', clientIp);

  const { signal, release } = timeoutSignal(VERIFY_TIMEOUT_MS);
  let result: SiteverifyResult;
  try {
    const response = await fetchImpl(config.verifyUrl, { method: 'POST', body: form, signal });
    if (!response.ok) {
      throw new ApiError('unavailable', 'Verification is not available right now.', {
        detail: { reason: 'turnstile_status', status: response.status },
      });
    }
    result = (await response.json()) as SiteverifyResult;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('unavailable', 'Verification is not available right now.', {
      detail: { reason: isTimeoutError(error) ? 'turnstile_timeout' : 'turnstile_unreachable' },
    });
  } finally {
    release();
  }

  const failed = (reason: string): ApiError =>
    new ApiError('challenge_failed', 'Verification failed. Please try again.', {
      detail: { reason, errorCodes: result['error-codes'] },
    });

  if (result.success !== true) throw failed('turnstile_rejected');
  // A token solved on another site's widget is valid to Cloudflare but not for this API.
  if (config.hostname && String(result.hostname).toLowerCase() !== config.hostname) {
    throw failed('turnstile_hostname');
  }
  if (result.action !== undefined && result.action !== TURNSTILE_ACTION) {
    throw failed('turnstile_action');
  }
}
