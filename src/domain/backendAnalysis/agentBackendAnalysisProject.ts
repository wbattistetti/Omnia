/**
 * Read/write per-agent backend analysis on project.backendCatalog.
 */

import type { ProjectBackendCatalogBlob } from '@domain/backendCatalog/catalogTypes';
import {
  normalizeAgentBackendAnalysisSnapshot,
  type AgentBackendAnalysisSnapshot,
} from './backendAnalysisTypes';

export function readAgentBackendAnalysis(
  catalog: ProjectBackendCatalogBlob | undefined,
  agentTaskId: string
): AgentBackendAnalysisSnapshot {
  const raw = catalog?.agentAnalysisByTaskId?.[agentTaskId];
  return normalizeAgentBackendAnalysisSnapshot(raw);
}

export function patchAgentBackendAnalysis(
  catalog: ProjectBackendCatalogBlob,
  agentTaskId: string,
  patch: Partial<AgentBackendAnalysisSnapshot>
): ProjectBackendCatalogBlob {
  const prev = readAgentBackendAnalysis(catalog, agentTaskId);
  return {
    ...catalog,
    agentAnalysisByTaskId: {
      ...(catalog.agentAnalysisByTaskId ?? {}),
      [agentTaskId]: {
        analysisDocument: patch.analysisDocument ?? prev.analysisDocument,
        analysisMarkdown: patch.analysisMarkdown ?? prev.analysisMarkdown,
        agentAnalysisBaselineMarkdown:
          patch.agentAnalysisBaselineMarkdown ?? prev.agentAnalysisBaselineMarkdown,
        sectionBaselines: patch.sectionBaselines ?? prev.sectionBaselines,
        runtimeDistilledMarkdown:
          patch.runtimeDistilledMarkdown ?? prev.runtimeDistilledMarkdown,
        runtimeDistillSourceHash:
          patch.runtimeDistillSourceHash ?? prev.runtimeDistillSourceHash,
      },
    },
  };
}
