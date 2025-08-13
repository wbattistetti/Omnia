export type LogEventKind =
  | 'input'
  | 'correctedInput'
  | 'mode'
  | 'subTarget';

export type LogEvent = { ts: number; kind: LogEventKind; message: string; data?: any };


