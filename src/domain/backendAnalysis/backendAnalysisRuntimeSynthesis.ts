/**
 * Sintesi analisi backend per contesto generazione use case / prompt designer.
 */

import type {
  ManualCatalogEntry,
  ProjectBackendCatalogBlob,
} from '@domain/backendCatalog/catalogTypes';
import { readAgentBackendAnalysisBundle } from './agentBackendAnalysisBundle';
import type { BackendAnalysisDocumentV2 } from './backendAnalysisDocumentV2';
import { buildUseOfBackendsBodyFromDocument } from './buildUseOfBackendsPromptSection';
import { markdownToBackendAnalysisV2 } from './migrateToBackendAnalysisV2';
import { taskRepository } from '@services/TaskRepository';

/** Costruisce blocco markdown sintetico da documento V2 (legacy / distill source). */
export function synthesizeBackendAnalysisFromDocument(
  doc: BackendAnalysisDocumentV2,
  manualEntries?: readonly ManualCatalogEntry[]
): string {
  return buildUseOfBackendsBodyFromDocument(doc, manualEntries);
}

/**
 * Legge analisi backend persistita per agente e restituisce sintesi (vuota se assente).
 */
export function buildBackendAnalysisContextBlock(
  catalog: ProjectBackendCatalogBlob | undefined,
  agentTaskId: string
): string {
  const id = String(agentTaskId ?? '').trim();
  if (!id || !catalog) return '';

  const bundle = readAgentBackendAnalysisBundle(catalog, id);
  const baseline = bundle.agentAnalysisBaselineMarkdown.trim();
  const markdown = bundle.analysisMarkdown.trim();

  if (!baseline && !markdown) return '';

  let doc = bundle.analysisDocument;
  if (!doc || Object.keys(doc.backends).length === 0) {
    if (!markdown) return '';
    const manual = catalog.manualEntries ?? [];
    doc = markdownToBackendAnalysisV2(markdown, manual, taskRepository.getAllTasks());
  }

  const manual = catalog.manualEntries ?? [];
  const synthesis = synthesizeBackendAnalysisFromDocument(doc, manual);
  if (!synthesis) return '';

  return synthesis;
}
