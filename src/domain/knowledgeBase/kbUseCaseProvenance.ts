/**
 * KB → use case provenance stored in `bubble_notes` (no bundle schema bump).
 */

import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import type { KbPromotedUseCaseDraft } from './kbPromotedUseCaseDraft';

export const KB_BUBBLE_SOURCE_DOCUMENT = 'kb_sourceDocumentId';
export const KB_BUBBLE_LINKED_RULES = 'kb_linkedRuleIds';
export const KB_BUBBLE_SOURCE_FILE = 'kb_sourceFileName';

export function attachKbProvenanceToUseCase(
  uc: AIAgentUseCase,
  draft: KbPromotedUseCaseDraft,
  sourceFileName?: string
): AIAgentUseCase {
  return {
    ...uc,
    id: draft.useCaseId,
    bubble_notes: {
      ...uc.bubble_notes,
      [KB_BUBBLE_SOURCE_DOCUMENT]: draft.sourceDocumentId,
      [KB_BUBBLE_LINKED_RULES]: draft.linkedRuleIds.join(','),
      ...(sourceFileName?.trim()
        ? { [KB_BUBBLE_SOURCE_FILE]: sourceFileName.trim() }
        : {}),
    },
  };
}

export function collectPromotedRuleIds(
  promotedDrafts: readonly KbPromotedUseCaseDraft[]
): Set<string> {
  const ids = new Set<string>();
  for (const d of promotedDrafts) {
    for (const rid of d.linkedRuleIds) ids.add(rid);
  }
  return ids;
}

export function kbBundleHasUseCaseId(
  useCases: readonly AIAgentUseCase[],
  useCaseId: string
): boolean {
  return useCases.some((u) => u.id === useCaseId);
}

/** Documents with analysis started but not marked complete. */
export function listIncompleteKbDocuments(
  docs: readonly { name: string; kbAnalysisComplete?: boolean; consentGiven?: boolean; rules?: readonly unknown[] }[]
): string[] {
  return docs
    .filter((d) => {
      if (d.kbAnalysisComplete) return false;
      const started = Boolean(d.consentGiven) || (Array.isArray(d.rules) && d.rules.length > 0);
      return started;
    })
    .map((d) => d.name);
}
