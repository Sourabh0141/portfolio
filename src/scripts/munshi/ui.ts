// Loaded on demand by main.ts the first time a visitor opens the chat, so a page view that
// never uses Munshi downloads none of this.
import { LIMITS } from '../../../shared/munshi';
import type { ChatMessage, SessionResponse } from '../../../shared/munshi';
import { createSession, isUserAbort, MunshiError, streamChat } from './client';
import type { FailureCode } from './client';
import { segment, stripEmphasis } from './linkify';
import { clearState, historyForRequest, isSessionFresh, loadState, saveState } from './store';
import type { StorageLike } from './store';
import { getTurnstileToken } from './turnstile';

const FAILURE_TEXT: Record<FailureCode | 'challenge', string> = {
  rate_limited: 'That’s a lot of questions in a short time. Please wait a minute and try again.',
  challenge_failed: 'The security check didn’t pass. Please try again.',
  challenge:
    'The security check couldn’t run. Check your connection or content blocker, then try again.',
  interrupted: 'The answer was cut off before it finished.',
  network: 'Munshi can’t be reached. Check your connection and try again.',
  unavailable: 'Munshi isn’t available right now. Please try again shortly, or email Sourabh.',
  invalid_request: 'That message couldn’t be sent. Try a shorter question.',
  payload_too_large: 'That message is too long. Try a shorter question.',
  // The rest mean the page and the Worker disagree, which a visitor cannot fix.
  unsupported_media_type: 'Munshi isn’t available right now. Please try again shortly.',
  forbidden_origin: 'Munshi isn’t available right now. Please try again shortly.',
  session_required: 'Munshi isn’t available right now. Please try again shortly.',
  session_expired: 'Munshi isn’t available right now. Please try again shortly.',
  not_found: 'Munshi isn’t available right now. Please try again shortly.',
  method_not_allowed: 'Munshi isn’t available right now. Please try again shortly.',
};

function sessionStore(): StorageLike | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function need<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Munshi markup is missing ${selector}`);
  return element;
}

export interface Munshi {
  open(opener?: HTMLElement | null): void;
  close(): void;
  isOpen(): boolean;
}

export function createMunshi(root: HTMLElement): Munshi {
  const apiUrl = root.dataset['apiUrl'] ?? '';
  const siteKey = root.dataset['siteKey'] ?? '';
  const allowedLinks = JSON.parse(root.dataset['links'] ?? '[]') as string[];

  const panel = need<HTMLElement>(root, '[data-munshi-panel]');
  const log = need<HTMLElement>(root, '[data-munshi-log]');
  const empty = need<HTMLElement>(root, '[data-munshi-empty]');
  const form = need<HTMLFormElement>(root, '[data-munshi-form]');
  const input = need<HTMLTextAreaElement>(root, '[data-munshi-input]');
  const sendButton = need<HTMLButtonElement>(root, '[data-munshi-send]');
  const stopButton = need<HTMLButtonElement>(root, '[data-munshi-stop]');
  const counter = need<HTMLElement>(root, '[data-munshi-counter]');
  const status = need<HTMLElement>(root, '[data-munshi-status]');
  const challenge = need<HTMLElement>(root, '[data-munshi-challenge]');
  const launcher = need<HTMLButtonElement>(root, '[data-munshi-launcher]');

  const storage = sessionStore();
  const state = loadState(storage);
  let busy = false;
  let abort: AbortController | null = null;
  let opener: HTMLElement | null = null;
  /** Bumped by "new chat". An answer that finishes for an earlier conversation is dropped. */
  let epoch = 0;

  // --- Rendering. Every string from the model or the visitor is set as text, never as HTML.

  function setText(target: HTMLElement, text: string, linkify: boolean): void {
    const clean = stripEmphasis(text);
    if (!linkify) {
      target.textContent = clean;
      return;
    }
    target.replaceChildren(
      ...segment(clean, allowedLinks).map((part) => {
        if (part.type === 'text') return document.createTextNode(part.value);
        const link = document.createElement('a');
        link.href = part.href;
        link.textContent = part.value;
        if (!part.href.startsWith('mailto:')) {
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
        }
        return link;
      }),
    );
  }

  function addMessage(role: ChatMessage['role'], text: string): HTMLElement {
    empty.hidden = true;
    const item = document.createElement('div');
    item.className = `munshi__msg munshi__msg--${role}`;

    const who = document.createElement('p');
    who.className = 'munshi__who label';
    who.textContent = role === 'user' ? 'You' : 'Munshi';

    const body = document.createElement('div');
    body.className = 'munshi__text';
    setText(body, text, role === 'assistant');

    item.append(who, body);
    log.append(item);
    scrollToEnd();
    return body;
  }

  function addFailure(text: string, retry: boolean): void {
    const item = document.createElement('div');
    item.className = 'munshi__msg munshi__msg--error';
    const body = document.createElement('p');
    body.className = 'munshi__text';
    body.textContent = text;
    item.append(body);

    if (retry) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn--small munshi__retry';
      button.textContent = 'Try again';
      button.addEventListener('click', () => {
        item.remove();
        void answer();
      });
      item.append(button);
    }
    log.append(item);
    scrollToEnd();
    announce(text);
  }

  function scrollToEnd(): void {
    log.scrollTop = log.scrollHeight;
  }

  /** The log itself is not a live region: a streamed answer would be read out word by word. */
  function announce(text: string): void {
    status.textContent = text;
  }

  function setBusy(next: boolean): void {
    busy = next;
    sendButton.hidden = next;
    stopButton.hidden = !next;
    root.toggleAttribute('data-busy', next);
    for (const chip of root.querySelectorAll<HTMLButtonElement>('[data-munshi-suggestion]')) {
      chip.disabled = next;
    }
    updateCounter();
  }

  function updateCounter(): void {
    const length = input.value.length;
    counter.textContent = `${length}/${LIMITS.userChars}`;
    sendButton.disabled = busy || input.value.trim().length === 0;
  }

  function persist(): void {
    saveState(storage, state);
  }

  // --- Session. One Turnstile check buys a token that lasts half an hour.

  async function ensureSession(signal: AbortSignal): Promise<SessionResponse> {
    if (state.session && isSessionFresh(state.session)) return state.session;

    let turnstileToken: string;
    try {
      turnstileToken = await getTurnstileToken(challenge, siteKey);
    } catch {
      throw new ChallengeError();
    }
    if (signal.aborted) throw new DOMException('Stopped', 'AbortError');

    state.session = await createSession(apiUrl, turnstileToken, signal);
    persist();
    return state.session;
  }

  // --- Conversation.

  function submit(text: string): void {
    const question = text.trim().slice(0, LIMITS.userChars);
    if (busy || question.length === 0) return;

    state.messages.push({ role: 'user', content: question });
    persist();
    addMessage('user', question);
    input.value = '';
    void answer();
  }

  /** Answers the latest question in `state.messages`. Also the retry path, so it adds no message. */
  async function answer(): Promise<void> {
    if (busy) return;
    setBusy(true);
    announce('Munshi is answering.');

    const mine = epoch;
    const controller = new AbortController();
    abort = controller;
    const body = addMessage('assistant', '');
    body.classList.add('munshi__text--pending');
    const item = body.parentElement;

    let text = '';
    const run = async (): Promise<string> => {
      const session = await ensureSession(controller.signal);
      return streamChat({
        apiUrl,
        token: session.token,
        messages: historyForRequest(state.messages),
        signal: controller.signal,
        onDelta: (delta) => {
          text += delta;
          body.classList.remove('munshi__text--pending');
          // Plain text while streaming. Links are built once, when the answer is complete.
          setText(body, text, false);
          scrollToEnd();
        },
      });
    };

    try {
      let full: string;
      try {
        full = await run();
      } catch (error) {
        // A token can expire between two messages. Get a new one once, without bothering the visitor.
        const stale =
          error instanceof MunshiError &&
          (error.code === 'session_expired' || error.code === 'session_required');
        if (!stale) throw error;
        state.session = null;
        full = await run();
      }
      if (mine !== epoch) return;
      keep(body, full);
      announce(`Munshi: ${stripEmphasis(full)}`);
    } catch (error) {
      if (mine !== epoch) return;
      if (isUserAbort(error, controller.signal)) {
        if (text.trim()) keep(body, text);
        else item?.remove();
        announce('Stopped.');
      } else if (error instanceof MunshiError && error.code === 'interrupted') {
        keep(body, error.partial);
        addFailure(FAILURE_TEXT.interrupted, false);
      } else {
        item?.remove();
        const code = error instanceof ChallengeError ? 'challenge' : failureCode(error);
        addFailure(FAILURE_TEXT[code], true);
      }
    } finally {
      abort = null;
      setBusy(false);
      if (panel.contains(document.activeElement) || document.activeElement === document.body) {
        input.focus();
      }
    }
  }

  /** Finalises an answer bubble and records it, so the next question carries the context. */
  function keep(body: HTMLElement, text: string): void {
    body.classList.remove('munshi__text--pending');
    setText(body, text, true);
    state.messages.push({ role: 'assistant', content: text });
    persist();
  }

  function reset(): void {
    epoch++;
    abort?.abort();
    state.messages = [];
    // The session token is kept: a new chat should not cost the visitor another check.
    if (state.session) persist();
    else clearState(storage);
    for (const item of log.querySelectorAll('.munshi__msg')) item.remove();
    empty.hidden = false;
    announce('Started a new chat.');
    input.focus();
  }

  // --- Panel.

  function isOpen(): boolean {
    return !panel.hidden;
  }

  function open(from?: HTMLElement | null): void {
    if (isOpen()) {
      input.focus();
      return;
    }
    opener = from ?? launcher;
    panel.hidden = false;
    launcher.setAttribute('aria-expanded', 'true');
    document.documentElement.classList.add('munshi-open');
    scrollToEnd();
    input.focus();
  }

  function close(): void {
    if (!isOpen()) return;
    panel.hidden = true;
    launcher.setAttribute('aria-expanded', 'false');
    document.documentElement.classList.remove('munshi-open');
    // Return focus to whatever opened the panel, or the launcher if that has gone.
    (opener?.isConnected ? opener : launcher).focus();
  }

  // --- Events.

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submit(input.value);
  });

  input.addEventListener('input', updateCounter);
  input.addEventListener('keydown', (event) => {
    // Enter sends, Shift+Enter makes a new line. isComposing keeps IME confirmation from sending.
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      submit(input.value);
    }
  });

  stopButton.addEventListener('click', () => abort?.abort());
  need<HTMLButtonElement>(root, '[data-munshi-reset]').addEventListener('click', reset);
  need<HTMLButtonElement>(root, '[data-munshi-close]').addEventListener('click', close);

  for (const chip of root.querySelectorAll<HTMLButtonElement>('[data-munshi-suggestion]')) {
    chip.addEventListener('click', () => submit(chip.textContent ?? ''));
  }

  panel.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
    }
  });

  // --- Restore an earlier conversation from this tab.

  for (const message of state.messages) addMessage(message.role, message.content);
  // A reload in the middle of an answer leaves a question with no reply. Offer to ask it again.
  if (state.messages.at(-1)?.role === 'user') {
    addFailure('This question wasn’t answered.', true);
    announce('');
  }
  setBusy(false);

  return { open, close, isOpen };
}

/** Turnstile could not produce a token: blocked script, offline, or an abandoned challenge. */
class ChallengeError extends Error {}

function failureCode(error: unknown): FailureCode {
  return error instanceof MunshiError ? error.code : 'unavailable';
}
