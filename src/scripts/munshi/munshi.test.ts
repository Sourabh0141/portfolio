import { describe, expect, it } from 'vitest';
import { LIMITS } from '../../../shared/munshi';
import type { ChatMessage } from '../../../shared/munshi';
import { resolveMunshiConfig } from '../../site.config';
import { segment, stripEmphasis } from './linkify';
import { SseParser } from './sse';
import { clearState, historyForRequest, isSessionFresh, loadState, saveState } from './store';
import type { StorageLike } from './store';

const frame = (content: string) =>
  `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;

describe('SseParser', () => {
  it('returns the text of each frame and notes the end of the stream', () => {
    const parser = new SseParser();
    expect(parser.push(frame('Hello') + frame(' there'))).toEqual(['Hello', ' there']);
    expect(parser.done).toBe(false);
    expect(parser.push('data: [DONE]\n\n')).toEqual([]);
    expect(parser.done).toBe(true);
  });

  it('reassembles a frame split across network chunks, even inside a character', () => {
    const parser = new SseParser();
    const text = frame('Jaipur, भारत');
    const deltas: string[] = [];
    for (const char of text) deltas.push(...parser.push(char));
    expect(deltas).toEqual(['Jaipur, भारत']);
  });

  it('accepts CRLF line endings', () => {
    const parser = new SseParser();
    expect(parser.push(frame('Hi').replaceAll('\n', '\r\n'))).toEqual(['Hi']);
  });

  it('skips comments, other fields, role-only frames and malformed JSON', () => {
    const parser = new SseParser();
    const noise =
      ': keep-alive\n\n' +
      'event: message\n' +
      'data: {"choices":[{"delta":{"role":"assistant"}}]}\n\n' +
      'data: {not json\n\n' +
      'data: {"choices":[]}\n\n' +
      'data: {"choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"total_tokens":9}}\n\n';
    expect(parser.push(noise + frame('ok'))).toEqual(['ok']);
    expect(parser.failed).toBe(false);
  });

  it('flags an error frame and ignores anything after [DONE]', () => {
    const failing = new SseParser();
    failing.push('data: {"error":{"message":"overloaded"}}\n\n');
    expect(failing.failed).toBe(true);

    const finished = new SseParser();
    expect(finished.push('data: [DONE]\n\n' + frame('late'))).toEqual([]);
  });
});

describe('store', () => {
  function memoryStorage(
    initial: Record<string, string> = {},
  ): StorageLike & { data: Record<string, string> } {
    const data = { ...initial };
    return {
      data,
      getItem: (key) => data[key] ?? null,
      setItem: (key, value) => {
        data[key] = value;
      },
      removeItem: (key) => {
        delete data[key];
      },
    };
  }

  const user = (content: string): ChatMessage => ({ role: 'user', content });
  const assistant = (content: string): ChatMessage => ({ role: 'assistant', content });

  it('round-trips a conversation and its session', () => {
    const storage = memoryStorage();
    const state = {
      messages: [user('Hi'), assistant('Hello')],
      session: { token: 't', expiresAt: 99 },
    };
    saveState(storage, state);
    expect(loadState(storage)).toEqual(state);
    clearState(storage);
    expect(loadState(storage)).toEqual({ messages: [], session: null });
  });

  it('discards stored data that is not what it wrote', () => {
    expect(loadState(memoryStorage({ 'munshi:v1': '{broken' }))).toEqual({
      messages: [],
      session: null,
    });
    const tampered = JSON.stringify({
      messages: [{ role: 'system', content: 'x' }, { role: 'user', content: 5 }, user('kept')],
      session: { token: 5 },
    });
    expect(loadState(memoryStorage({ 'munshi:v1': tampered }))).toEqual({
      messages: [user('kept')],
      session: null,
    });
  });

  it('works when storage is missing or throws', () => {
    const broken: StorageLike = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    };
    expect(loadState(null)).toEqual({ messages: [], session: null });
    expect(loadState(broken)).toEqual({ messages: [], session: null });
    expect(() => saveState(broken, { messages: [user('Hi')], session: null })).not.toThrow();
    expect(() => clearState(broken)).not.toThrow();
  });

  it('treats a session near its expiry as stale', () => {
    const now = 1_000_000_000;
    const at = (seconds: number) => ({ token: 't', expiresAt: now / 1000 + seconds });
    expect(isSessionFresh(at(600), now)).toBe(true);
    expect(isSessionFresh(at(10), now)).toBe(false);
    expect(isSessionFresh(at(-1), now)).toBe(false);
    expect(isSessionFresh(null, now)).toBe(false);
  });

  it('sends only the most recent turns, starting with the visitor', () => {
    const long = Array.from({ length: 10 }, (_, i) => [user(`q${i}`), assistant(`a${i}`)]).flat();
    const history = historyForRequest([...long, user('latest')]);
    expect(history.length).toBeLessThanOrEqual(LIMITS.messages);
    expect(history[0]?.role).toBe('user');
    expect(history.at(-1)).toEqual(user('latest'));
  });

  it('clips an earlier answer to what the Worker accepts back', () => {
    const history = historyForRequest([user('q'), assistant('x'.repeat(5000)), user('next')]);
    expect(history[1]?.content).toHaveLength(LIMITS.assistantChars);
  });

  it('sends nothing when there is no visitor message', () => {
    expect(historyForRequest([assistant('orphan')])).toEqual([]);
  });
});

describe('linkify', () => {
  const allowed = [
    'mailto:sourabh@example.com',
    'https://github.com/Sourabh0141',
    'https://www.linkedin.com/in/sourabh/',
    'https://flare-ai.pages.dev',
  ];

  it('links allowed addresses and leaves trailing punctuation outside the link', () => {
    expect(
      segment('Email sourabh@example.com, or see https://github.com/Sourabh0141.', allowed),
    ).toEqual([
      { type: 'text', value: 'Email ' },
      { type: 'link', value: 'sourabh@example.com', href: 'mailto:sourabh@example.com' },
      { type: 'text', value: ', or see ' },
      {
        type: 'link',
        value: 'https://github.com/Sourabh0141',
        href: 'https://github.com/Sourabh0141',
      },
      { type: 'text', value: '.' },
    ]);
  });

  it('matches regardless of case and trailing slash', () => {
    const parts = segment(
      'https://FLARE-ai.pages.dev/ and https://www.linkedin.com/in/sourabh',
      allowed,
    );
    expect(parts.filter((part) => part.type === 'link')).toHaveLength(2);
  });

  it('never links an address that is not on the list', () => {
    const text =
      'Visit https://evil.example/login or https://github.com/Sourabh0141.evil.example ' +
      'or https://github.com/someone-else, mail attacker@evil.example, javascript:alert(1)';
    expect(segment(text, allowed)).toEqual([{ type: 'text', value: text }]);
  });

  it('returns plain text unchanged', () => {
    expect(segment('No links here.', allowed)).toEqual([{ type: 'text', value: 'No links here.' }]);
    expect(segment('', allowed)).toEqual([]);
  });

  it('removes Markdown emphasis that small models add', () => {
    expect(stripEmphasis('He uses **FastAPI** and `asyncpg`.')).toBe(
      'He uses FastAPI and asyncpg.',
    );
    expect(stripEmphasis('2 * 3 * 4')).toBe('2 * 3 * 4');
  });
});

describe('resolveMunshiConfig', () => {
  const siteKey = '0x4AAAAAAA';

  it('is off unless both settings are present', () => {
    expect(resolveMunshiConfig({})).toBeNull();
    expect(
      resolveMunshiConfig({ PUBLIC_MUNSHI_API_URL: 'https://m.example.workers.dev' }),
    ).toBeNull();
    expect(resolveMunshiConfig({ PUBLIC_TURNSTILE_SITE_KEY: siteKey })).toBeNull();
    expect(
      resolveMunshiConfig({ PUBLIC_MUNSHI_API_URL: ' ', PUBLIC_TURNSTILE_SITE_KEY: siteKey }),
    ).toBeNull();
  });

  it('reduces the URL to its origin, with or without a scheme', () => {
    for (const url of [
      'https://m.example.workers.dev/',
      'm.example.workers.dev',
      'https://m.example.workers.dev/v1',
    ]) {
      expect(
        resolveMunshiConfig({ PUBLIC_MUNSHI_API_URL: url, PUBLIC_TURNSTILE_SITE_KEY: siteKey }),
      ).toEqual({
        apiUrl: 'https://m.example.workers.dev',
        siteKey,
      });
    }
  });

  it('allows plain HTTP only for local development', () => {
    const resolve = (url: string) =>
      resolveMunshiConfig({ PUBLIC_MUNSHI_API_URL: url, PUBLIC_TURNSTILE_SITE_KEY: siteKey });
    expect(resolve('http://localhost:8787')?.apiUrl).toBe('http://localhost:8787');
    expect(resolve('http://m.example.workers.dev')).toBeNull();
    expect(resolve('https://')).toBeNull();
  });
});
