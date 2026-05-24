/**
 * Shared use-case invalidation note + KB sync handlers for Omnia editor and review portal dock.
 */

import React from 'react';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import { isUseCaseInvalidated } from '@types/aiAgentUseCases';
import type { StagedKbDocument } from '@domain/knowledgeBase/kbDocumentTypes';
import {
  removeInvalidationKbFromDocuments,
  upsertInvalidationKbInDocuments,
} from '@domain/knowledgeBase/useCaseInvalidationKb';
import { applyDeleteUseCaseWithInvalidationKb } from './applyDeleteUseCaseWithInvalidationKb';

export type AgentDockUseCaseInvalidationHandlers = {
  onUseCaseInvalidationNoteChange: (useCaseId: string, note: string) => void;
  onUseCaseInvalidationStateChange: (useCaseId: string, isInvalid: boolean) => void;
  deleteUseCaseWithInvalidationKb: (useCaseId: string) => boolean;
};

export type UseAgentDockUseCaseInvalidationHandlersParams = {
  useCases: readonly AIAgentUseCase[];
  setUseCases: React.Dispatch<React.SetStateAction<AIAgentUseCase[]>>;
  knowledgeBaseDocuments: readonly StagedKbDocument[];
  knowledgeBaseReorderDocuments: (next: readonly StagedKbDocument[]) => void;
  /** Called after any persisted mutation (e.g. mark task dirty). */
  onMutate?: () => void;
};

/**
 * Single implementation for invalidation notes ↔ KB documents, used by task editor and review portal.
 */
export function useAgentDockUseCaseInvalidationHandlers(
  params: UseAgentDockUseCaseInvalidationHandlersParams
): AgentDockUseCaseInvalidationHandlers {
  const {
    useCases,
    setUseCases,
    knowledgeBaseDocuments,
    knowledgeBaseReorderDocuments,
    onMutate,
  } = params;

  const onUseCaseInvalidationNoteChange = React.useCallback(
    (useCaseId: string, note: string) => {
      const uc = useCases.find((u) => u.id === useCaseId);
      if (!uc || !isUseCaseInvalidated(uc)) return;
      const trimmed = String(note ?? '').trim();
      setUseCases((prev) =>
        prev.map((u) =>
          u.id === useCaseId ? { ...u, invalidationNote: trimmed || undefined } : u
        )
      );
      if (!trimmed) {
        knowledgeBaseReorderDocuments(
          removeInvalidationKbFromDocuments(knowledgeBaseDocuments, useCaseId)
        );
        setUseCases((prev) =>
          prev.map((u) =>
            u.id === useCaseId ? { ...u, invalidationKbDocumentId: undefined } : u
          )
        );
        onMutate?.();
        return;
      }
      const { documents: nextDocs, docId } = upsertInvalidationKbInDocuments(
        knowledgeBaseDocuments,
        { useCase: { ...uc, invalidationNote: trimmed }, note: trimmed }
      );
      knowledgeBaseReorderDocuments(nextDocs);
      setUseCases((prev) =>
        prev.map((u) => (u.id === useCaseId ? { ...u, invalidationKbDocumentId: docId } : u))
      );
      onMutate?.();
    },
    [useCases, knowledgeBaseDocuments, knowledgeBaseReorderDocuments, setUseCases, onMutate]
  );

  const onUseCaseInvalidationStateChange = React.useCallback(
    (useCaseId: string, isInvalid: boolean) => {
      if (isInvalid) {
        onMutate?.();
        return;
      }
      knowledgeBaseReorderDocuments(
        removeInvalidationKbFromDocuments(knowledgeBaseDocuments, useCaseId)
      );
      setUseCases((prev) =>
        prev.map((u) =>
          u.id === useCaseId
            ? {
                ...u,
                invalidationNote: undefined,
                invalidationKbDocumentId: undefined,
              }
            : u
        )
      );
      onMutate?.();
    },
    [knowledgeBaseDocuments, knowledgeBaseReorderDocuments, setUseCases, onMutate]
  );

  const deleteUseCaseWithInvalidationKb = React.useCallback(
    (useCaseId: string): boolean => {
      const result = applyDeleteUseCaseWithInvalidationKb({
        useCases,
        useCaseId,
        knowledgeBaseDocuments,
      });
      if (!result) return false;
      if (result.kbChanged) {
        knowledgeBaseReorderDocuments(result.nextKbDocuments);
      }
      setUseCases(result.nextUseCases);
      onMutate?.();
      return true;
    },
    [useCases, knowledgeBaseDocuments, knowledgeBaseReorderDocuments, setUseCases, onMutate]
  );

  return {
    onUseCaseInvalidationNoteChange,
    onUseCaseInvalidationStateChange,
    deleteUseCaseWithInvalidationKb,
  };
}
