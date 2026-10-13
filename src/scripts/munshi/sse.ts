/**
 * Incremental parser for a streamed chat completion. The Worker forwards the model
 * provider's server-sent events untouched, so the browser does the parsing:
 *
 *   data: {"choices":[{"delta":{"content":"Hel"}}]}
 *   data: [DONE]
 *
 * Network chunks split lines anywhere, so text is buffered until a full line has arrived.
 */
export class SseParser {
  /** True once `[DONE]` has been seen. A stream that ends without it was cut off. */
  done = false;
  /** True if the provider reported an error part-way through the answer. */
  failed = false;

  private buffer = '';

  /** Feeds one decoded chunk and returns the text deltas it completed, in order. */
  push(chunk: string): string[] {
    this.buffer += chunk;
    const deltas: string[] = [];

    let newline = this.buffer.indexOf('\n');
    while (newline >= 0) {
      const line = this.buffer.slice(0, newline).replace(/\r$/, '');
      this.buffer = this.buffer.slice(newline + 1);
      newline = this.buffer.indexOf('\n');

      const delta = this.parseLine(line);
      if (delta) deltas.push(delta);
    }
    return deltas;
  }

  private parseLine(line: string): string | null {
    // Blank separators, `: keep-alive` comments and `event:` lines carry no text.
    if (this.done || !line.startsWith('data:')) return null;

    const payload = line.slice(5).trim();
    if (payload === '[DONE]') {
      this.done = true;
      return null;
    }

    let frame: unknown;
    try {
      frame = JSON.parse(payload);
    } catch {
      return null;
    }
    if (typeof frame !== 'object' || frame === null) return null;

    if ('error' in frame) {
      this.failed = true;
      return null;
    }

    const choices = (frame as { choices?: unknown }).choices;
    if (!Array.isArray(choices)) return null;
    const content = (choices[0] as { delta?: { content?: unknown } } | undefined)?.delta?.content;
    return typeof content === 'string' && content.length > 0 ? content : null;
  }
}
