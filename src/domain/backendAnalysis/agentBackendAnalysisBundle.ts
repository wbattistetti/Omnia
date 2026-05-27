/**
 * Bundle analisi backend per agente: documento V2 + export markdown.
 */

import type { ProjectBackendCatalogBlob } from '@domain/backendCatalog/catalogTypes';
import {
  createEmptyBackendAnalysisDocumentV2,
  normalizeBackendAnalysisDocumentV2,
  type BackendAnalysisDocumentV2,
} from './backendAnalysisDocumentV2';
import { exportBackendAnalysisV2Markdown } from './exportBackendAnalysisV2Markdown';
import { normalizeAgentBackendAnalysisSnapshot } from './backendAnalysisTypes';

export type AgentBackendAnalysisBundle = {
  analysisDocument: BackendAnalysisDocumentV2;
  analysisMarkdown: string;
  agentAnalysisBaselineMarkdown: string;
  sectionBaselines: Record<string, string>;
  runtimeDistilledMarkdown: string;
  runtimeDistillSourceHash: string;
};

export function readAgentBackendAnalysisBundle(
  catalog: ProjectBackendCatalogBlob | undefined,
  agentTaskId: string
): AgentBackendAnalysisBundle {
  const snap = normalizeAgentBackendAnalysisSnapshot(
    catalog?.agentAnalysisByTaskId?.[agentTaskId]
  );
  const doc = snap.analysisDocument
    ? normalizeBackendAnalysisDocumentV2(snap.analysisDocument)
    : createEmptyBackendAnalysisDocumentV2();
  const markdown =
    snap.analysisMarkdown.trim() ||
    (doc.backends && Object.keys(doc.backends).length > 0
      ? exportBackendAnalysisV2Markdown(doc)
      : '');
  return {
    analysisDocument: doc,
    analysisMarkdown: markdown,
    agentAnalysisBaselineMarkdown: snap.agentAnalysisBaselineMarkdown,
    sectionBaselines: { ...(snap.sectionBaselines ?? {}) },
    runtimeDistilledMarkdown: String(snap.runtimeDistilledMarkdown ?? ''),
    runtimeDistillSourceHash: String(snap.runtimeDistillSourceHash ?? ''),
  };
}

export function patchAgentBackendAnalysisBundle(
  catalog: ProjectBackendCatalogBlob,
  agentTaskId: string,
  patch: Partial<{
    analysisDocument: BackendAnalysisDocumentV2;
    analysisMarkdown: string;
    agentAnalysisBaselineMarkdown: string;
    sectionBaselines: Record<string, string>;
    runtimeDistilledMarkdown: string;
    runtimeDistillSourceHash: string;
  }>
): ProjectBackendCatalogBlob {
  const prev = readAgentBackendAnalysisBundle(catalog, agentTaskId);
  const analysisDocument = patch.analysisDocument
    ? normalizeBackendAnalysisDocumentV2(patch.analysisDocument)
    : prev.analysisDocument;
  const analysisMarkdown =
    patch.analysisMarkdown ??
    (patch.analysisDocument ? exportBackendAnalysisV2Markdown(analysisDocument) : prev.analysisMarkdown);
  return {
    ...catalog,
    agentAnalysisByTaskId: {
      ...(catalog.agentAnalysisByTaskId ?? {}),
      [agentTaskId]: {
        analysisDocument,
        analysisMarkdown,
        agentAnalysisBaselineMarkdown:
          patch.agentAnalysisBaselineMarkdown ?? prev.agentAnalysisBaselineMarkdown,
        sectionBaselines: patch.sectionBaselines
          ? { ...prev.sectionBaselines, ...patch.sectionBaselines }
          : prev.sectionBaselines,
        runtimeDistilledMarkdown:
          patch.runtimeDistilledMarkdown ?? prev.runtimeDistilledMarkdown,
        runtimeDistillSourceHash:
          patch.runtimeDistillSourceHash ?? prev.runtimeDistillSourceHash,
      },
    },
  };
}
