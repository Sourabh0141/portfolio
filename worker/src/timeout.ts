/**
 * Returns an AbortSignal that fires after `ms`, and a `release` function that clears the timer
 * once the guarded work has finished.
 */
export function timeoutSignal(ms: number): { signal: AbortSignal; release: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new DOMException('Timed out', 'TimeoutError')),
    ms,
  );
  return { signal: controller.signal, release: () => clearTimeout(timer) };
}

export function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
}
