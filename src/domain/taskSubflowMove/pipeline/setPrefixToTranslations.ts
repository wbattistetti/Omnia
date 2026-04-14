/**
 * Canonical step: apply a key prefix to translation entries (identity when prefix is empty).
 * Parent auto-rename uses a separate step; this hook exists for future key-namespace moves.
 */

import type { TranslationPatch } from '../types';

export type SetPrefixToTranslationsInput = {
  prefix: string;
  entries: Readonly<Record<string, string | Record<string, string>>>;
};

export type SetPrefixToTranslationsOutput = TranslationPatch;

export function SetPrefixToTranslations(input: SetPrefixToTranslationsInput): SetPrefixToTranslationsOutput {
  const p = String(input.prefix || '').trim();
  if (!p) {
    return { ...input.entries } as TranslationPatch;
  }
  const out: TranslationPatch = {};
  for (const [k, v] of Object.entries(input.entries)) {
    out[`${p}${k}`] = v;
  }
  return out;
}
