/**
 * Removes a use case subtree and linked invalidation KB documents (shared Omnia + review portal).
 */

import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import type { StagedKbDocument } from '@domain/knowledgeBase/kbDocumentTypes';
import { removeInvalidationKbFromDocuments } from '@domain/knowledgeBase/useCaseInvalidationKb';
import { collectUseCaseSubtreeIds } from '@omnia/domain-core/usecase/tree/useCaseHierarchy';

export type DeleteUseCaseWithInvalidationKbResult = {
  nextUseCases: AIAgentUseCase[];
  nextKbDocuments: StagedKbDocument[];
  kbChanged: boolean;
  removeIds: ReadonlySet<string>;
};

/** Computes next use case list and KB list after deleting a subtree. */
export function applyDeleteUseCaseWithInvalidationKb(params: {
  useCases: readonly AIAgentUseCase[];
  useCaseId: string;
  knowledgeBaseDocuments: readonly StagedKbDocument[];
}): DeleteUseCaseWithInvalidationKbResult | null {
  const useCaseId = String(params.useCaseId ?? '').trim();
  if (!useCaseId || !params.useCases.some((u) => u.id === useCaseId)) {
    return null;
  }
  const removeIds = collectUseCaseSubtreeIds(params.useCases, useCaseId);
  let nextKb = params.knowledgeBaseDocuments as StagedKbDocument[];
  for (const id of removeIds) {
    nextKb = removeInvalidationKbFromDocuments(nextKb, id);
  }
  return {
    nextUseCases: params.useCases.filter((u) => !removeIds.has(u.id)),
    nextKbDocuments: nextKb,
    kbChanged: nextKb.length !== params.knowledgeBaseDocuments.length,
    removeIds,
  };
}
