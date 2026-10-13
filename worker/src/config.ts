import type { Bindings } from './env.ts';
import { ApiError } from './errors.ts';

export interface Config {
  version: string;
  enabled: boolean;
  allowedOrigins: string[];
  deepinfra: { baseUrl: string; model: string; apiKey: string };
  turnstile: { verifyUrl: string; hostname: string | undefined; secretKey: string };
  sessionKey: string;
}

/** HMAC-SHA256 keys shorter than the 32-byte digest weaken the signature. */
const MIN_SESSION_KEY_CHARS = 32;

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/** Splits `ALLOWED_ORIGINS` (comma separated) into a clean, lowercased list. */
export function parseAllowedOrigins(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function isEnabled(env: Bindings): boolean {
  return nonEmpty(env.MUNSHI_ENABLED)?.toLowerCase() !== 'false';
}

/**
 * Builds the validated config for a request. A missing var or secret becomes `unavailable`
 * with the missing names in the log, instead of an obscure failure further down.
 */
export function loadConfig(env: Bindings): Config {
  const missing: string[] = [];
  const required = (name: keyof Bindings): string => {
    const value = nonEmpty(env[name] as string | undefined);
    if (!value) missing.push(name);
    return value ?? '';
  };

  const config: Config = {
    version: nonEmpty(env.APP_VERSION) ?? 'dev',
    enabled: isEnabled(env),
    allowedOrigins: parseAllowedOrigins(env.ALLOWED_ORIGINS),
    deepinfra: {
      baseUrl: required('DEEPINFRA_BASE_URL').replace(/\/+$/, ''),
      model: required('DEEPINFRA_MODEL'),
      apiKey: required('DEEPINFRA_API_KEY'),
    },
    turnstile: {
      verifyUrl: required('TURNSTILE_VERIFY_URL'),
      hostname: nonEmpty(env.TURNSTILE_HOSTNAME)?.toLowerCase(),
      secretKey: required('TURNSTILE_SECRET_KEY'),
    },
    sessionKey: required('MUNSHI_SESSION_KEY'),
  };

  if (config.allowedOrigins.length === 0) missing.push('ALLOWED_ORIGINS');
  if (config.sessionKey && config.sessionKey.length < MIN_SESSION_KEY_CHARS) {
    missing.push(`MUNSHI_SESSION_KEY (needs ${MIN_SESSION_KEY_CHARS}+ characters)`);
  }

  if (missing.length > 0) {
    throw new ApiError('unavailable', 'Munshi is not available right now.', {
      detail: { reason: 'not_configured', missing },
    });
  }
  return config;
}
