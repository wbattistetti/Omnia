/**
 * Sezione compatta knowledge base per prompt esterno / deploy.
 */

import { resolveKbTextForConvaiUpload } from '@domain/convai/resolveKbTextForConvaiUpload';
import type { StagedKbDocument } from '@domain/knowledgeBase/kbDocumentTypes';
import { kbDocumentsEligibleForUseCaseContext } from '@domain/knowledgeBase/useCaseInvalidationKb';

export const KNOWLEDGE_BASE_PROMPT_HEADER = '## KNOWLEDGE BASE:';

const KB_PROMPT_SECTION_MAX = 6_000;

function buildKbBlocks(documents: readonly StagedKbDocument[]): string[] {
  const blocks: string[] = [];
  for (const doc of kbDocumentsEligibleForUseCaseContext(documents)) {
    const text = resolveKbTextForConvaiUpload(doc);
    if (!text) continue;
    blocks.push(`**${doc.name}**\n${text.slice(0, KB_PROMPT_SECTION_MAX)}`);
  }
  return blocks;
}

/** Sezione markdown KB (vuota se nessun documento analizzato). */
export function buildKbRuntimePromptSection(documents: readonly StagedKbDocument[]): string {
  const blocks = buildKbBlocks(documents);
  if (blocks.length === 0) return '';
  return `${KNOWLEDGE_BASE_PROMPT_HEADER}\n\n${blocks.join('\n\n')}`;
}
