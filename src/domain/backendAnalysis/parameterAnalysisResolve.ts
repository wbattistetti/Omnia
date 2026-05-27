/**
 * Risoluzione analisi parametro (Livello 2) dalla fonte V2.
 */

import type { ProjectBackendCatalogBlob } from '@domain/backendCatalog/catalogTypes';
import {
  normalizeBackendAnalysisDocumentV2,
  type BackendParameterAnalysisRecord,
} from './backendAnalysisDocumentV2';
import { readAgentBackendAnalysisBundle } from './agentBackendAnalysisBundle';

export function resolveParameterAnalysis(
  catalog: ProjectBackendCatalogBlob | undefined,
  agentTaskId: string,
  catalogEntryId: string,
  paramKey: string
): BackendParameterAnalysisRecord | null {
  const bundle = readAgentBackendAnalysisBundle(catalog, agentTaskId);
  const doc = bundle.analysisDocument;
  const backend = doc.backends[catalogEntryId];
  if (!backend) return null;
  const key = paramKey.trim();
  return backend.parameters[key] ?? backend.parameters[normalizeDotKey(key)] ?? null;
}

function normalizeDotKey(key: string): string {
  return key.replace(/\s+/g, '');
}

export function listParameterKeysForBackend(
  catalog: ProjectBackendCatalogBlob | undefined,
  agentTaskId: string,
  catalogEntryId: string
): string[] {
  const bundle = readAgentBackendAnalysisBundle(catalog, agentTaskId);
  const backend = bundle.analysisDocument.backends[catalogEntryId];
  if (!backend) return [];
  return Object.keys(backend.parameters).sort();
}
