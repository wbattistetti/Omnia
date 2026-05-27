/**
 * Export markdown LLM da BackendAnalysisDocumentV2 (non è la vista principale UI).
 */

import type { BackendAnalysisDocumentV2 } from './backendAnalysisDocumentV2';
import type {
  BackendAnalysisDocument,
  BackendAnalysisBackendSection,
} from './backendAnalysisDocumentTypes';
import { renderBackendAnalysisDocument } from './renderBackendAnalysisDocument';

function v2ToV1Render(doc: BackendAnalysisDocumentV2): BackendAnalysisDocument {
  const backends: BackendAnalysisBackendSection[] = Object.values(doc.backends).map(
    (b) => ({
      name: b.displayLabel,
      parameters: Object.values(b.parameters).map((p) => ({
        name: p.paramKey,
        direction: p.direction,
        kind: p.kind,
        role: p.role,
        description: p.descriptionShort,
      })),
      payoffData: {
        version: 1 as const,
        backend: b.displayLabel,
        entries: Object.values(b.parameters).map((p) => ({
          parameter: p.paramKey,
          payoffSummary: p.analysisSummary || p.descriptionShort,
          payoffDetail: p.analysisDetailMarkdown || p.descriptionShort,
        })),
      },
    })
  );

  const generalRules = Object.values(doc.backends)
    .map((b) => b.howToUseMarkdown.trim())
    .filter(Boolean);

  const missingBackends = doc.global.proposedBackends.map((p) => ({
    name: p.suggestedName,
    reason: p.specMarkdown.trim().slice(0, 500),
  }));

  const systemPromptLines = doc.global.agentSystemPromptMarkdown
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-*]\s+/, '').trim())
    .filter(Boolean);

  return {
    summary: [],
    backends,
    generalRules,
    missingBackends,
    monacoTags: Object.values(doc.backends).flatMap((b) =>
      Object.values(b.parameters).map((p) => ({ name: p.paramKey, kind: p.kind }))
    ),
    systemPromptLines,
  };
}

export function exportBackendAnalysisV2Markdown(doc: BackendAnalysisDocumentV2): string {
  return renderBackendAnalysisDocument(v2ToV1Render(doc));
}
