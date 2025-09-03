export interface Logger {
  debug: (...args: any[]) => void;
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
  miEnabled?: boolean; // enable mixed-initiative traces
}

let current: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  miEnabled: false,
};

export function setLogger(partial: Partial<Logger>) {
  current = { ...current, ...(partial || {}) };
}

export function getLogger(): Logger {
  return current;
}

export type LogEventKind =
  | 'input'
  | 'correctedInput'
  | 'mode'
  | 'subTarget';

export type LogEvent = { ts: number; kind: LogEventKind; message: string; data?: any };


