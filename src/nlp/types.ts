export type Confidence = number; // 0..1

export type ExtractResult<T> = {
  value?: T;
  confidence: Confidence;
  missing?: string[];
  reasons?: string[];
  candidates?: Array<{ value: T; confidence: Confidence }>; // optional for multi-candidate extractors
};

export interface DataExtractor<T> {
  extract: (text: string, prev?: Partial<T>) => ExtractResult<T>;
  validate: (value: T) => { ok: boolean; errors?: string[] };
  format: (value: T) => string;
}

export type Registry = Record<string, DataExtractor<any>>;

export type SlotDecision<T> =
  | { status: 'accepted'; value: T; source: 'deterministic' | 'ner'; confidence: Confidence }
  | { status: 'ask-more'; missing: string[]; hint?: string; value?: Partial<T>; confidence?: Confidence }
  | { status: 'reject'; reasons: string[] };

export type DOB = { day?: number; month?: number; year?: number };
export type Phone = { e164: string };
export type Email = string;


