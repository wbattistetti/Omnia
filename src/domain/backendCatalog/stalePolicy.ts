/**
 * Policy badge stale (solo designer-time): confronta fingerprint endpoint vs meta import.
 */

import { structuralFingerprint } from './canonicalKey';
import type { CatalogBinding, ManualCatalogEntry } from './catalogTypes';
import { SpecStaleReason } from './catalogTypes';

export interface StaleEvaluateInput {
  method: string;
  endpointUrl: string;
  importState: 'none' | 'ok' | 'error';
  /** Fingerprint salvato all’ultimo import OK (da meta task/voce manuale). */
  fingerprintAtLastOkImport: string | null;
}

/**
 * Valuta stale per un endpoint.
 * - NO_CONTRACT: mai import ok registrato.
 * - IMPORT_ERROR: ultimo stato errore.
 * - STRUCTURAL_DRIFT: fingerprint corrente ≠ fingerprint salvato all’ultimo import ok.
 * - FRESH: import ok e fingerprint allineato.
 */
export function evaluateSpecStale(input: StaleEvaluateInput): SpecStaleReason {
  const currentFp = structuralFingerprint(input.method, input.endpointUrl);
  if (input.importState === 'error') {
    return SpecStaleReason.IMPORT_ERROR;
  }
  if (input.importState === 'none') {
    return SpecStaleReason.NO_CONTRACT;
  }
  if (!input.fingerprintAtLastOkImport || input.fingerprintAtLastOkImport !== currentFp) {
    return SpecStaleReason.STRUCTURAL_DRIFT;
  }
  return SpecStaleReason.FRESH;
}

/** Badge stale per una riga binding aggregata. */
export function staleReasonForBinding(binding: CatalogBinding): SpecStaleReason {
  const fpOk =
    binding.frozenMeta.importState === 'ok'
      ? binding.frozenMeta.structuralFingerprintAtLastOkImport ?? null
      : null;
  return evaluateSpecStale({
    method: binding.method,
    endpointUrl: binding.endpointUrl,
    importState: binding.frozenMeta.importState,
    fingerprintAtLastOkImport: fpOk,
  });
}

/** Stale per voce manuale catalogo (stessa policy dei binding aggregati). */
export function staleReasonForManualEntry(entry: ManualCatalogEntry): SpecStaleReason {
  const method = (entry.method || 'GET').toUpperCase();
  return evaluateSpecStale({
    method,
    endpointUrl: entry.endpointUrl,
    importState: entry.frozenMeta.importState,
    fingerprintAtLastOkImport: entry.frozenMeta.structuralFingerprintAtLastOkImport ?? null,
  });
}
