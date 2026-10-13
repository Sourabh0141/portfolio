import { isErrorCode, ROUTES } from '../../../shared/munshi';
import type { ChatMessage, ErrorCode, SessionResponse } from '../../../shared/munshi';
import { SseParser } from './sse';

/** Longest wait for the Worker to start responding. The Worker gives the model 15 seconds. */
const RESPONSE_TIMEOUT_MS = 30_000;
/** Longest silence tolerated in the middle of an answer. */
const STALL_TIMEOUT_MS = 20_000;

export type FailureCode =
  | ErrorCode
  /** The request never got an HTTP response: offline, blocked, or timed out. */
  | 'network'
  /** The answer started and then stopped before the model finished. */
  | 'interrupted';

export class MunshiError extends Error {
  readonly code: FailureCode;
  /** Text received before an `interrupted` failure. */
  readonly partial: string;

  constructor(code: FailureCode, partial = '') {
    super(code);
    this.name = 'MunshiError';
    this.code = code;
    this.partial = partial;
  }
}

/** True when the visitor pressed stop, as opposed to a timeout aborting the request. */
export function isUserAbort(error: unknown, signal: AbortSignal): boolean {
  return signal.aborted && !(error instanceof MunshiError);
}

async function toError(response: Response): Promise<MunshiError> {
  try {
    const body = (await response.json()) as { error?: { code?: unknown } };
    if (isErrorCode(body.error?.code)) return new MunshiError(body.error.code);
  } catch {
    // Not the Worker's error envelope: an edge error page, for example.
  }
  return new MunshiError(response.status === 429 ? 'rate_limited' : 'unavailable');
}

/**
 * fetch with a deadline that also honours the caller's signal. Returns the response and a
 * function that moves the deadline, so a long answer is only cut off when it stalls.
 */
async function request(
  url: string,
  init: RequestInit,
  signal: AbortSignal | undefined,
): Promise<{ response: Response; extend: (ms: number) => void; release: () => void }> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();

  let timer = window.setTimeout(abort, RESPONSE_TIMEOUT_MS);
  const extend = (ms: number) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(abort, ms);
  };
  const release = () => {
    window.clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  };

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    return { response, extend, release };
  } catch (error) {
    release();
    // The visitor's own stop is passed on as it is. Anything else is a network failure.
    if (signal?.aborted) throw error;
    throw new MunshiError('network');
  }
}

export async function createSession(
  apiUrl: string,
  turnstileToken: string,
  signal?: AbortSignal,
): Promise<SessionResponse> {
  const { response, release } = await request(
    `${apiUrl}${ROUTES.session}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ turnstileToken }),
    },
    signal,
  );
  try {
    if (!response.ok) throw await toError(response);
    const session = (await response.json()) as Partial<SessionResponse>;
    if (typeof session.token !== 'string' || typeof session.expiresAt !== 'number') {
      throw new MunshiError('unavailable');
    }
    return { token: session.token, expiresAt: session.expiresAt };
  } finally {
    release();
  }
}

export interface StreamChatOptions {
  apiUrl: string;
  token: string;
  messages: ChatMessage[];
  signal?: AbortSignal;
  /** Called with each piece of the answer as it arrives. */
  onDelta: (delta: string) => void;
}

/** Sends the conversation and resolves with the complete answer once the model has finished. */
export async function streamChat(options: StreamChatOptions): Promise<string> {
  const { response, extend, release } = await request(
    `${options.apiUrl}${ROUTES.chat}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${options.token}`,
      },
      body: JSON.stringify({ messages: options.messages }),
    },
    options.signal,
  );

  let answer = '';
  try {
    if (!response.ok) throw await toError(response);
    if (!response.body) throw new MunshiError('unavailable');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const parser = new SseParser();

    while (!parser.done) {
      extend(STALL_TIMEOUT_MS);
      const { value, done } = await reader.read();
      if (done) break;
      for (const delta of parser.push(decoder.decode(value, { stream: true }))) {
        answer += delta;
        options.onDelta(delta);
      }
    }

    if (parser.failed || !parser.done || answer.trim() === '') {
      throw new MunshiError(answer.trim() === '' ? 'unavailable' : 'interrupted', answer);
    }
    return answer;
  } catch (error) {
    if (error instanceof MunshiError) throw error;
    if (options.signal?.aborted) throw error;
    // A stalled or dropped connection after the answer had begun.
    throw new MunshiError(answer.trim() === '' ? 'network' : 'interrupted', answer);
  } finally {
    release();
  }
}
