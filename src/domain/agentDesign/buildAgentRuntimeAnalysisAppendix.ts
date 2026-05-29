/**
 * Sintesi runtime (KB + backend) da appendere al contesto agente in compile/deploy.
 */

import type { ProjectBackendCatalogBlob } from '@domain/backendCatalog/catalogTypes';
import { buildUseOfBackendsPromptSection } from '@domain/backendAnalysis/buildUseOfBackendsPromptSection';
import type { StagedKbDocument } from '@domain/knowledgeBase/kbDocumentTypes';
import {
  buildKbRuntimePromptSection,
  KNOWLEDGE_BASE_PROMPT_HEADER,
} from './buildKbRuntimePromptSection';

/** Header legacy nel blocco Context (appendice KB + backend). */
const RUNTIME_KB_HEADER = '#### Knowledge base (sintesi analisi documenti)';

/**
 * Blocco markdown compatto per sezione Context / runtime (vuoto se nessuna analisi).
 */
export function buildAgentRuntimeAnalysisAppendix(params: {
  documents: readonly StagedKbDocument[];
  backendCatalog?: ProjectBackendCatalogBlob;
  agentTaskId?: string;
  manualCatalogBackendTaskIds?: readonly string[];
}): string {
  const parts: string[] = [];

  const kbSection = buildKbRuntimePromptSection(params.documents);
  if (kbSection.trim()) {
    const kbBody = kbSection.startsWith(KNOWLEDGE_BASE_PROMPT_HEADER)
      ? kbSection.slice(KNOWLEDGE_BASE_PROMPT_HEADER.length).trim()
      : kbSection;
    parts.push(RUNTIME_KB_HEADER, '', kbBody);
  }

  const agentId = String(params.agentTaskId ?? '').trim();
  const backend = agentId
    ? buildUseOfBackendsPromptSection({
        catalog: params.backendCatalog,
        agentTaskId: agentId,
        manualCatalogBackendTaskIds: params.manualCatalogBackendTaskIds,
      })
    : '';
  if (backend.trim()) {
    parts.push(backend);
  }

  return parts.join('\n').trim();
}

/** Unisce sintesi analisi nella sezione context dell'IR (non sovrascrive testo designer). */
export function mergeRuntimeAnalysisIntoContext(
  contextMarkdown: string,
  appendix: string
): string {
  const base = contextMarkdown.trim();
  const extra = appendix.trim();
  if (!extra) return base;
  if (base.includes(RUNTIME_KB_HEADER) || base.includes('## USE OF BACKENDS:')) {
    return base;
  }
  const marker = '\n\n---\n\n### Riferimenti analisi (KB e backend)\n\n';
  return base ? `${base}${marker}${extra}` : `### Riferimenti analisi (KB e backend)\n\n${extra}`;
}
