/**
 * Sintesi runtime (KB + backend) da appendere al contesto agente in compile/deploy.
 */

import type { ProjectBackendCatalogBlob } from '@domain/backendCatalog/catalogTypes';
import {
  resolveBackendRuntimeDistillTextSync,
  resolveKbRuntimeDistillTextSync,
} from '@domain/analysisRuntime/analysisRuntimeDistill';
import { kbDocumentHasUsableAnalysis } from '@domain/knowledgeBase/kbAnalysisRuntimeSynthesis';
import type { StagedKbDocument } from '@domain/knowledgeBase/kbDocumentTypes';
import { kbDocumentsEligibleForUseCaseContext } from '@domain/knowledgeBase/useCaseInvalidationKb';

const RUNTIME_KB_HEADER = '#### Knowledge base (sintesi analisi documenti)';
const RUNTIME_BACKEND_HEADER = '#### Backend (sintesi analisi)';

function buildKbRuntimeBlocks(documents: readonly StagedKbDocument[]): string[] {
  const blocks: string[] = [];
  for (const doc of kbDocumentsEligibleForUseCaseContext(documents)) {
    const raw = String(doc.documentAnalysisMarkdown ?? '').trim();
    if (!raw) continue;
    const text = kbDocumentHasUsableAnalysis(doc)
      ? resolveKbRuntimeDistillTextSync(doc, 6_000)
      : raw.slice(0, 4_000);
    if (!text.trim()) continue;
    blocks.push(`**${doc.name}**\n${text.slice(0, 6_000)}`);
  }
  return blocks;
}

/**
 * Blocco markdown compatto per sezione Context / runtime (vuoto se nessuna analisi).
 */
export function buildAgentRuntimeAnalysisAppendix(params: {
  documents: readonly StagedKbDocument[];
  backendCatalog?: ProjectBackendCatalogBlob;
  agentTaskId?: string;
}): string {
  const parts: string[] = [];

  const kbBlocks = buildKbRuntimeBlocks(params.documents);
  if (kbBlocks.length > 0) {
    parts.push(RUNTIME_KB_HEADER, '', ...kbBlocks.map((b) => `${b}\n`));
  }

  const agentId = String(params.agentTaskId ?? '').trim();
  const backend = agentId
    ? resolveBackendRuntimeDistillTextSync(params.backendCatalog, agentId)
    : '';
  if (backend.trim()) {
    parts.push(RUNTIME_BACKEND_HEADER, '', backend);
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
  if (base.includes(RUNTIME_KB_HEADER) || base.includes(RUNTIME_BACKEND_HEADER)) {
    return base;
  }
  const marker = '\n\n---\n\n### Riferimenti analisi (KB e backend)\n\n';
  return base ? `${base}${marker}${extra}` : `### Riferimenti analisi (KB e backend)\n\n${extra}`;
}
