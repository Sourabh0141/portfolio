type LogLevel = 'info' | 'warn' | 'error';

export type LogFields = Record<string, unknown>;

/**
 * Structured JSON logger. Workers Logs indexes JSON fields, so every line is one object with
 * a stable `event` name. Fields bound at creation (request id, route) are on every line.
 */
export class Logger {
  constructor(private readonly bound: LogFields = {}) {}

  child(fields: LogFields): Logger {
    return new Logger({ ...this.bound, ...fields });
  }

  info(event: string, fields?: LogFields): void {
    this.emit('info', event, fields);
  }

  warn(event: string, fields?: LogFields): void {
    this.emit('warn', event, fields);
  }

  error(event: string, fields?: LogFields): void {
    this.emit('error', event, fields);
  }

  private emit(level: LogLevel, event: string, fields?: LogFields): void {
    const line = JSON.stringify({ level, event, ...this.bound, ...fields }, replaceErrors);
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
  }
}

function replaceErrors(_key: string, value: unknown): unknown {
  if (value instanceof Error) return { name: value.name, message: value.message };
  return value;
}

export const rootLogger = new Logger({ service: 'munshi' });
