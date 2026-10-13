import type { SessionResponse } from '../../shared/munshi.ts';
import { ApiError } from './errors.ts';

/**
 * Stateless session tokens. A visitor passes Turnstile once and receives a token that the
 * Worker can verify with one HMAC, so chat requests need no storage and no second network call.
 *
 *   v1.<expiry unix seconds>.<random id>.<base64url HMAC-SHA256 of everything before it>
 */

const VERSION = 'v1';
export const SESSION_TTL_SECONDS = 30 * 60;

const encoder = new TextEncoder();

/** Importing a key is the slow part. One isolate serves many requests with the same secret. */
let cachedKey: { secret: string; key: Promise<CryptoKey> } | undefined;

function importKey(secret: string): Promise<CryptoKey> {
  if (cachedKey?.secret !== secret) {
    cachedKey = {
      secret,
      key: crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign', 'verify'],
      ),
    };
  }
  return cachedKey.key;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

export async function issueSession(
  secret: string,
  now: number = Date.now(),
): Promise<SessionResponse> {
  const expiresAt = Math.floor(now / 1000) + SESSION_TTL_SECONDS;
  const id = toBase64Url(crypto.getRandomValues(new Uint8Array(12)));
  const payload = `${VERSION}.${expiresAt}.${id}`;
  const signature = await crypto.subtle.sign(
    'HMAC',
    await importKey(secret),
    encoder.encode(payload),
  );
  return { token: `${payload}.${toBase64Url(new Uint8Array(signature))}`, expiresAt };
}

/**
 * Returns the session id, or throws `session_required` (no usable token) or `session_expired`
 * (a genuine token past its expiry). The page reacts to the second by quietly getting a new one.
 */
export async function verifySession(
  secret: string,
  token: string | null,
  now: number = Date.now(),
): Promise<string> {
  const required = () =>
    new ApiError('session_required', 'Start a chat session before sending a message.');
  if (!token || token.length > 200) throw required();

  const parts = token.split('.');
  const [version, expiry, id, signature] = parts;
  if (parts.length !== 4 || version !== VERSION || !expiry || !id || !signature) throw required();

  const signatureBytes = fromBase64Url(signature);
  if (!signatureBytes || !/^\d{1,12}$/.test(expiry)) throw required();

  // `verify` compares in constant time, so the signature cannot be guessed byte by byte.
  const valid = await crypto.subtle.verify(
    'HMAC',
    await importKey(secret),
    signatureBytes,
    encoder.encode(`${version}.${expiry}.${id}`),
  );
  if (!valid) throw required();

  if (Number(expiry) * 1000 <= now) {
    throw new ApiError('session_expired', 'Your chat session has expired.');
  }
  return id;
}

export function bearerToken(request: Request): string | null {
  const match = /^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization') ?? '');
  return match?.[1] ?? null;
}
