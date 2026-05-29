/**
 * Rileva analisi backend obsoleta dopo «Recupera specifiche» (hash OpenAPI o parametri wire diversi).
 */

import type { ManualCatalogEntry } from '@domain/backendCatalog/catalogTypes';
import { TaskType, type Task } from '@types/taskTypes';
import type { BackendAnalysisBackendRecord } from './backendAnalysisDocumentV2';
import {
  catalogEntryHasCompleteIaAnalysis,
  catalogEntryHasSubstantiveAnalysis,
} from './mergeCatalogEntryAnalysis';
import { collectParamKeysFromBackendCallTask } from './realignBackendParametersFromOpenApiTask';

/** Hash OpenAPI corrente sul catalogo o sul task Backend Call. */
export function resolveCatalogEntryOpenApiContentHash(
  entry: ManualCatalogEntry,
  task: Task | null | undefined
): string | null {
  const fromEntry = entry.frozenMeta?.contentHash?.trim();
  if (fromEntry) return fromEntry;
  const meta = (task as Task & { backendCallSpecMeta?: { contentHash?: string | null } } | null)
    ?.backendCallSpecMeta;
  const fromTask = meta?.contentHash?.trim();
  return fromTask || null;
}

function wireParamSignature(task: Task): string {
  return collectParamKeysFromBackendCallTask(task)
    .map((p) => `${p.direction}:${p.paramKey.toLowerCase()}`)
    .sort()
    .join('|');
}

function analysisParamSignature(backend: BackendAnalysisBackendRecord): string {
  return Object.values(backend.parameters)
    .map((p) => `${p.direction}:${p.paramKey.toLowerCase()}`)
    .sort()
    .join('|');
}

/**
 * True se c’è già analisi sostanziale ma la firma OpenAPI o i parametri wire sono cambiati.
 */
export function catalogEntryAnalysisStaleAfterSpecRefresh(
  entry: ManualCatalogEntry,
  backend: BackendAnalysisBackendRecord | undefined,
  task: Task | null | undefined
): boolean {
  if (!backend) return false;
  const hasAnalysis =
    catalogEntryHasSubstantiveAnalysis(backend) || catalogEntryHasCompleteIaAnalysis(backend);
  if (!hasAnalysis) return false;

  const currentHash = resolveCatalogEntryOpenApiContentHash(entry, task ?? null);
  const analysisHash = backend.analysisOpenApiContentHash;
  if (analysisHash === null) {
    return Boolean(currentHash);
  }
  if (typeof analysisHash === 'string' && currentHash && analysisHash !== currentHash) {
    return true;
  }

  if (analysisHash === undefined && task && task.type === TaskType.BackendCall) {
    const wireSig = wireParamSignature(task);
    const analysisSig = analysisParamSignature(backend);
    if (wireSig && analysisSig && wireSig !== analysisSig) return true;
  }

  return false;
}

/** Aggiorna l’hash OpenAPI registrato al momento dell’ultima analisi IA. */
export function withAnalysisOpenApiContentHash(
  backend: BackendAnalysisBackendRecord,
  contentHash: string | null
): BackendAnalysisBackendRecord {
  return { ...backend, analysisOpenApiContentHash: contentHash };
}
