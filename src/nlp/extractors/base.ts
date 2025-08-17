import type { DataExtractor } from '../types';

export function normalizeText(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{L}\p{N}\s@._-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export const notImplemented: DataExtractor<any> = {
  extract: () => ({ confidence: 0, reasons: ['not-implemented'] }),
  validate: () => ({ ok: false, errors: ['not-implemented'] }),
  format: (v: any) => String(v ?? ''),
};


