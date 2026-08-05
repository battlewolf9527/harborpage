type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  module: string;
  message: string;
  timestamp: string;
  data?: unknown;
}

const isDev = import.meta.env?.DEV ?? true;

const consoleMethodMap: Record<LogLevel, (...args: unknown[]) => void> = {
  debug: console.debug.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

function formatEntry(entry: LogEntry): string {
  const prefix = `[${entry.timestamp}][${entry.level.toUpperCase()}][${entry.module}]`;
  return `${prefix} ${entry.message}`;
}

function createLogger(module: string) {
  const log = (level: LogLevel, message: string, data?: unknown) => {
    if (!isDev && level !== 'error') {
      return;
    }

    const entry: LogEntry = {
      level,
      module,
      message,
      timestamp: new Date().toISOString(),
      data,
    };

    const formatted = formatEntry(entry);
    const method = consoleMethodMap[level];
    if (data !== undefined) {
      method(formatted, data);
    } else {
      method(formatted);
    }
  };

  return {
    debug: (message: string, data?: unknown) => log('debug', message, data),
    info: (message: string, data?: unknown) => log('info', message, data),
    warn: (message: string, data?: unknown) => log('warn', message, data),
    error: (message: string, data?: unknown) => log('error', message, data),
  };
}

export default createLogger;