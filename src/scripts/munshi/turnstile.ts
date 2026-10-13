import { TURNSTILE_ACTION } from '../../../shared/munshi';

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const CHALLENGE_TIMEOUT_MS = 120_000;

interface TurnstileApi {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      appearance: 'always' | 'execute' | 'interaction-only';
      callback: (token: string) => void;
      'error-callback': () => void;
      'timeout-callback': () => void;
    },
  ): string;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let loading: Promise<TurnstileApi> | undefined;

/**
 * Loads Cloudflare's script the first time a visitor sends a message. Until then the page
 * makes no request to a third party, which is why this is not a `<script>` tag in the layout.
 */
function loadTurnstile(): Promise<TurnstileApi> {
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error('Turnstile did not initialise'));
    };
    script.onerror = () => reject(new Error('Turnstile failed to load'));
    document.head.append(script);
  }).catch((error: unknown) => {
    // Allow another attempt: the visitor may have been offline or behind a blocker.
    loading = undefined;
    throw error;
  });
  return loading;
}

/**
 * Runs one challenge and resolves with its token. Most visitors see nothing: with
 * "interaction-only" the widget appears in `container` only when Cloudflare wants a click.
 * The token is single-use, so the widget is removed as soon as it has produced one.
 *
 * The container must stay rendered: Turnstile does not run inside a hidden element.
 */
export async function getTurnstileToken(container: HTMLElement, siteKey: string): Promise<string> {
  const turnstile = await loadTurnstile();

  return new Promise<string>((resolve, reject) => {
    // Set once render returns. A callback can only fire after that.
    const widget: { id?: string } = {};
    const finish = (settle: () => void) => {
      window.clearTimeout(timer);
      if (widget.id !== undefined) turnstile.remove(widget.id);
      settle();
    };
    const timer = window.setTimeout(
      () => finish(() => reject(new Error('Turnstile timed out'))),
      CHALLENGE_TIMEOUT_MS,
    );

    widget.id = turnstile.render(container, {
      sitekey: siteKey,
      action: TURNSTILE_ACTION,
      appearance: 'interaction-only',
      callback: (token) => finish(() => resolve(token)),
      'error-callback': () => finish(() => reject(new Error('Turnstile reported an error'))),
      'timeout-callback': () => finish(() => reject(new Error('Turnstile challenge expired'))),
    });
  });
}
