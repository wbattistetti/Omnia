/**
 * Pure helpers to merge engine-specific fields into DataContract.engines.
 * Single place for contract updates used by inline editors and RecognitionEditor.
 */

import type { DataContract } from '@components/DialogueDataEngine/contracts/contractLoader';

function cloneEngines(base: DataContract | null | undefined): any[] {
  return [...(base?.engines || [])];
}

function shellContract(base: DataContract | null | undefined): DataContract {
  if (base && typeof base === 'object') {
    return { ...base, engines: cloneEngines(base) };
  }
  return {
    subDataMapping: {},
    engines: [],
    outputCanonical: { format: 'value' },
  };
}

/**
 * Applies a normalized regex pattern to the regex engine (creates engine if missing).
 */
export function applyRegexPatternToContract(
  base: DataContract | null | undefined,
  pattern: string
): DataContract {
  const next = shellContract(base);
  const engines = next.engines || [];
  const idx = engines.findIndex((e: any) => e.type === 'regex');
  if (idx >= 0) {
    engines[idx] = { ...engines[idx], patterns: [pattern] };
  } else {
    engines.push({
      type: 'regex',
      enabled: true,
      patterns: [pattern],
      examples: [],
    });
  }
  next.engines = engines;
  return next;
}

/**
 * Applies rules (deterministic) extractor TypeScript source to the rules engine.
 */
export function applyRulesExtractorCodeToContract(
  base: DataContract | null | undefined,
  extractorCode: string
): DataContract {
  const next = shellContract(base);
  const engines = next.engines || [];
  const idx = engines.findIndex((e: any) => e.type === 'rules');
  if (idx >= 0) {
    engines[idx] = { ...engines[idx], extractorCode };
  } else {
    engines.push({
      type: 'rules',
      enabled: true,
      extractorCode,
      validators: [],
    });
  }
  next.engines = engines;
  return next;
}

/**
 * Applies NER entity type list to the ner engine.
 */
export function applyNerEntityTypesToContract(
  base: DataContract | null | undefined,
  entityTypes: string[],
  defaultConfidence = 0.6
): DataContract {
  const next = shellContract(base);
  const engines = next.engines || [];
  const idx = engines.findIndex((e: any) => e.type === 'ner');
  if (idx >= 0) {
    const prev = engines[idx] as { confidence?: number };
    engines[idx] = {
      ...engines[idx],
      entityTypes,
      confidence: prev.confidence ?? defaultConfidence,
    };
  } else {
    engines.push({
      type: 'ner',
      enabled: true,
      entityTypes,
      confidence: defaultConfidence,
    });
  }
  next.engines = engines;
  return next;
}
