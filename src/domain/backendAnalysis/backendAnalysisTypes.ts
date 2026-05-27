/**
 * Per-agent backend usage analysis persisted on project.backendCatalog.
 */

import type { BackendAnalysisDocumentV2 } from './backendAnalysisDocumentV2';

/** Snapshot analisi backend per task agente (chiave = agentTaskId). */
export type AgentBackendAnalysisSnapshot = {
  /** Fonte di verità strutturata (schema 2). */
  analysisDocument?: BackendAnalysisDocumentV2;
  /** Export markdown per LLM / review (derivato dal documento). */
  analysisMarkdown: string;
  /** Ultima versione stabilizzata dall'agente (baseline diff osservazioni). */
  agentAnalysisBaselineMarkdown: string;
  /** Baseline per sezione Monaco (chiave = {@link BackendAnalysisSectionId}). */
  sectionBaselines?: Record<string, string>;
  /** Distillazione estrema LLM per runtime (cache). */
  runtimeDistilledMarkdown?: string;
  runtimeDistillSourceHash?: string;
};

export function normalizeAgentBackendAnalysisSnapshot(
  raw: unknown
): AgentBackendAnalysisSnapshot {
  if (!raw || typeof raw !== 'object') {
    return { analysisMarkdown: '', agentAnalysisBaselineMarkdown: '' };
  }
  const r = raw as Record<string, unknown>;
  const analysisDocument =
    r.analysisDocument && typeof r.analysisDocument === 'object'
      ? (r.analysisDocument as BackendAnalysisDocumentV2)
      : undefined;
  const sectionBaselines =
    r.sectionBaselines && typeof r.sectionBaselines === 'object'
      ? Object.fromEntries(
          Object.entries(r.sectionBaselines as Record<string, unknown>).filter(
            (entry): entry is [string, string] => typeof entry[1] === 'string'
          )
        )
      : undefined;

  return {
    analysisDocument,
    analysisMarkdown:
      typeof r.analysisMarkdown === 'string' ? r.analysisMarkdown : '',
    agentAnalysisBaselineMarkdown:
      typeof r.agentAnalysisBaselineMarkdown === 'string'
        ? r.agentAnalysisBaselineMarkdown
        : '',
    sectionBaselines,
    runtimeDistilledMarkdown:
      typeof r.runtimeDistilledMarkdown === 'string' ? r.runtimeDistilledMarkdown : undefined,
    runtimeDistillSourceHash:
      typeof r.runtimeDistillSourceHash === 'string' ? r.runtimeDistillSourceHash : undefined,
  };
}
