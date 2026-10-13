import type { Config } from './config.ts';
import { ApiError } from './errors.ts';
import type { ModelMessage } from './prompt.ts';
import { isTimeoutError } from './timeout.ts';

/** Longest wait for the model to start answering. */
const FIRST_BYTE_TIMEOUT_MS = 15_000;
/** Longest a whole answer may take. 350 tokens normally finish in a few seconds. */
const TOTAL_TIMEOUT_MS = 45_000;
const RETRY_DELAY_MS = 300;
const ATTEMPTS = 2;

/** Low, so answers stay close to the supplied facts. */
export const TEMPERATURE = 0.2;
/** About 250 words. The prompt asks for 120; this is the hard stop on spend per answer. */
export const MAX_TOKENS = 350;

export interface ChatStream {
  body: ReadableStream<Uint8Array>;
  attempts: number;
  firstByteMs: number;
}

/**
 * Starts a streamed chat completion and returns the provider's body untouched.
 *
 * The Worker never reads the stream. Handing the body straight to the response lets the
 * runtime pipe it without running any JavaScript per chunk, which is what keeps a request
 * inside the free plan's 10 ms of CPU. The browser parses the server-sent events.
 *
 * One retry covers a dropped connection or a 429/5xx, and only before any bytes have been
 * sent: once the answer has started there is nothing safe to replay.
 */
export async function startChatStream(
  config: Config['deepinfra'],
  messages: ModelMessage[],
  fetchImpl: typeof fetch = fetch,
): Promise<ChatStream> {
  const body = JSON.stringify({
    model: config.model,
    messages,
    stream: true,
    temperature: TEMPERATURE,
    max_tokens: MAX_TOKENS,
  });

  const started = Date.now();
  let lastDetail: Record<string, unknown> = {};

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    if (attempt > 1) await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));

    const controller = new AbortController();
    const abort = () => controller.abort(new DOMException('Timed out', 'TimeoutError'));
    const firstByteTimer = setTimeout(abort, FIRST_BYTE_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetchImpl(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${config.apiKey}`,
          'content-type': 'application/json',
          accept: 'text/event-stream',
        },
        body,
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(firstByteTimer);
      if (isTimeoutError(error)) {
        // A slow model is unlikely to be faster on a second try, and the visitor is waiting.
        throw unavailable({ reason: 'upstream_timeout', attempts: attempt });
      }
      lastDetail = { reason: 'upstream_unreachable', error };
      continue;
    }
    clearTimeout(firstByteTimer);

    if (response.ok && response.body) {
      // Still bound the whole answer. If this fires mid-stream the body errors and the page
      // reports an interrupted answer. After a normal finish it has nothing left to abort.
      setTimeout(abort, Math.max(0, TOTAL_TIMEOUT_MS - (Date.now() - started)));
      return { body: response.body, attempts: attempt, firstByteMs: Date.now() - started };
    }

    const text = await response.text().catch(() => '');
    lastDetail = { reason: 'upstream_status', status: response.status, body: text.slice(0, 300) };
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable) break;
  }

  throw unavailable({ ...lastDetail, attempts: ATTEMPTS });
}

function unavailable(detail: Record<string, unknown>): ApiError {
  return new ApiError('unavailable', 'Munshi could not get an answer. Please try again.', {
    detail,
  });
}
