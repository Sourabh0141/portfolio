export type Segment =
  { type: 'text'; value: string } | { type: 'link'; value: string; href: string };

const CANDIDATE = /https?:\/\/[^\s<>"'()[\]]+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const TRAILING_PUNCTUATION = /[.,;:!?]+$/;

/** Scheme and host are case-insensitive, and a trailing slash does not change the page. */
function normalise(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/\/+$/, '')}`.toLowerCase();
  } catch {
    return '';
  }
}

/** The model is asked for plain text, but small models still reach for Markdown emphasis. */
export function stripEmphasis(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/`([^`\n]+)`/g, '$1');
}

/**
 * Splits an answer into plain text and links. Only addresses on the allowlist become links:
 * the allowlist is the portfolio's own email and URLs, so a model that has been talked into
 * printing some other address produces inert text, never a clickable link on this site.
 *
 * The caller builds DOM nodes from the segments. Nothing here is ever parsed as HTML.
 */
export function segment(text: string, allowed: readonly string[]): Segment[] {
  const emails = new Set<string>();
  const urls = new Set<string>();
  for (const entry of allowed) {
    if (entry.startsWith('mailto:')) emails.add(entry.slice(7).toLowerCase());
    else urls.add(normalise(entry));
  }

  const segments: Segment[] = [];
  const pushText = (value: string) => {
    if (!value) return;
    const last = segments.at(-1);
    if (last?.type === 'text') last.value += value;
    else segments.push({ type: 'text', value });
  };

  let cursor = 0;
  for (const match of text.matchAll(CANDIDATE)) {
    const raw = match[0];
    const value = raw.replace(TRAILING_PUNCTUATION, '');
    const start = match.index;

    let href: string | null = null;
    if (value.includes('://')) {
      if (urls.has(normalise(value))) href = value;
    } else if (emails.has(value.toLowerCase())) {
      href = `mailto:${value}`;
    }

    pushText(text.slice(cursor, start));
    if (href) {
      segments.push({ type: 'link', value, href });
      pushText(raw.slice(value.length));
    } else {
      pushText(raw);
    }
    cursor = start + raw.length;
  }
  pushText(text.slice(cursor));
  return segments;
}
