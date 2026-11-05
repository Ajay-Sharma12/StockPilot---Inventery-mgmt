import { env } from '../config/env.config';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  blue: '\x1b[34m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

class Logger {
  private currentLevelPriority: number;

  constructor() {
    this.currentLevelPriority = LEVEL_PRIORITY[env.LOG_LEVEL as LogLevel] ?? 1;
  }

  private format(level: LogLevel, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    const color =
      level === 'error'
        ? COLORS.red
        : level === 'warn'
        ? COLORS.yellow
        : level === 'info'
        ? COLORS.green
        : COLORS.blue;

    const prefix = `[${timestamp}] [${color}${level.toUpperCase()}${COLORS.reset}]`;
    const metaStr = meta ? `\n${COLORS.dim}${JSON.stringify(meta, null, 2)}${COLORS.reset}` : '';

    return `${prefix} ${message}${metaStr}`;
  }

  debug(message: string, meta?: any): void {
    if (this.currentLevelPriority <= LEVEL_PRIORITY.debug) {
      console.debug(this.format('debug', message, meta));
    }
  }

  info(message: string, meta?: any): void {
    if (this.currentLevelPriority <= LEVEL_PRIORITY.info) {
      console.info(this.format('info', message, meta));
    }
  }

  warn(message: string, meta?: any): void {
    if (this.currentLevelPriority <= LEVEL_PRIORITY.warn) {
      console.warn(this.format('warn', message, meta));
    }
  }

  error(message: string, meta?: any): void {
    if (this.currentLevelPriority <= LEVEL_PRIORITY.error) {
      console.error(this.format('error', message, meta));
    }
  }
}

export const logger = new Logger();
