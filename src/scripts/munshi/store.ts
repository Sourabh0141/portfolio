import { LIMITS } from '../../../shared/munshi';
import type { ChatMessage, SessionResponse } from '../../../shared/munshi';

const KEY = 'munshi:v1';
/** Enough to scroll back through a long chat. Only the last few turns are ever sent. */
const MAX_STORED = 40;
/** A token this close to expiry would likely fail by the time the request arrives. */
const EXPIRY_MARGIN_SECONDS = 30;

export interface ChatState {
  messages: ChatMessage[];
  session: SessionResponse | null;
}

/** The subset of Storage this module needs, so tests can pass a plain object. */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function isMessage(value: unknown): value is ChatMessage {
  if (typeof value !== 'object' || value === null) return false;
  const { role, content } = value as Record<string, unknown>;
  return (role === 'user' || role === 'assistant') && typeof content === 'string' && content !== '';
}

function isSession(value: unknown): value is SessionResponse {
  if (typeof value !== 'object' || value === null) return false;
  const { token, expiresAt } = value as Record<string, unknown>;
  return typeof token === 'string' && typeof expiresAt === 'number';
}

/**
 * The conversation lives in sessionStorage: it survives a reload and ends with the tab.
 * Nothing is kept on the server. Storage can throw (private mode, quota), and the chat must
 * still work without it, so every access is guarded and stored data is treated as untrusted.
 */
export function loadState(storage: StorageLike | null): ChatState {
  const empty: ChatState = { messages: [], session: null };
  if (!storage) return empty;
  try {
    const parsed: unknown = JSON.parse(storage.getItem(KEY) ?? 'null');
    if (typeof parsed !== 'object' || parsed === null) return empty;
    const { messages, session } = parsed as Record<string, unknown>;
    return {
      messages: Array.isArray(messages) ? messages.filter(isMessage).slice(-MAX_STORED) : [],
      session: isSession(session) ? session : null,
    };
  } catch {
    return empty;
  }
}

export function saveState(storage: StorageLike | null, state: ChatState): void {
  if (!storage) return;
  try {
    storage.setItem(
      KEY,
      JSON.stringify({ messages: state.messages.slice(-MAX_STORED), session: state.session }),
    );
  } catch {
    // The conversation then lasts until the page is reloaded.
  }
}

export function clearState(storage: StorageLike | null): void {
  try {
    storage?.removeItem(KEY);
  } catch {
    // Nothing was stored, so there is nothing to clear.
  }
}

export function isSessionFresh(session: SessionResponse | null, now: number = Date.now()): boolean {
  return session !== null && session.expiresAt - EXPIRY_MARGIN_SECONDS > now / 1000;
}

/**
 * The history to send with a request: the most recent turns that fit the Worker's limits.
 * The Worker rejects a conversation that does not open with the visitor, and an earlier answer
 * longer than it accepts back, so both are fixed here instead of failing the request.
 */
export function historyForRequest(messages: readonly ChatMessage[]): ChatMessage[] {
  const recent = messages.slice(-LIMITS.messages);
  const firstUser = recent.findIndex((message) => message.role === 'user');
  if (firstUser < 0) return [];
  return recent.slice(firstUser).map((message) => ({
    role: message.role,
    content: message.content.slice(
      0,
      message.role === 'user' ? LIMITS.userChars : LIMITS.assistantChars,
    ),
  }));
}
