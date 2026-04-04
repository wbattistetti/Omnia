/**
 * Contract extraction: delegates to VB.NET ParserExtraction via /api/nlp/contract-extract.
 * No synchronous TS regex/heuristic path — tests must mock HTTP or pass fixtures into `advance()`.
 */

import type { NLPContract } from './contractLoader';
import { extractWithVbContract } from '../../../services/vbContractExtract';

export interface ExtractionResult {
  values: Record<string, any>;
  hasMatch: boolean;
  source: 'vb' | null;
  confidence?: number;
}

/**
 * Async extraction: same path as production (VB.NET).
 */
export async function extractWithContractAsync(
  text: string,
  contract: NLPContract,
  composite = false
): Promise<ExtractionResult> {
  if (!contract.engines || contract.engines.length === 0) {
    return { values: {}, hasMatch: false, source: null };
  }
  const r = await extractWithVbContract(text, contract, composite);
  return {
    values: r.values as Record<string, any>,
    hasMatch: r.hasMatch,
    source: 'vb',
    confidence: 0.85
  };
}
