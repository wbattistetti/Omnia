export type Lang = 'it'|'en'|'pt';

export type Variant = { id: string; text: string; lang: Lang };

export type Intent = {
  id: string;
  name: string;
  description?: string;
  langs: Lang[];
  threshold: number; // 0..1
  status: 'draft'|'ready';
  enabled?: boolean; // ✅ Default true, se false l'intento è disabilitato
  variants: {
    curated: Variant[];
    staging: Variant[];
    hardNeg: Variant[];
  };
  signals: {
    keywords: { t: string; w: number }[];
    synonymSets: { name: string; terms: string[] }[];
    patterns: string[]; // regex-like
  };
};

export type TrainConfig = {
  alpha: number;
  topK: number;
  globalThreshold: number;
  entropyMax: number;
};

export type TestResult = {
  decision: 'MATCH'|'LOW_CONFIDENCE'|'NO_MATCH';
  intentId?: string;
  score: number; // 0..1
  top: { intentId: string; name: string; fused: number }[];
  explain: {
    keywords: string[];
    pattern?: string;
    nearestExample?: string;
  };
  latency: { a: number; b: number; total: number };
};


