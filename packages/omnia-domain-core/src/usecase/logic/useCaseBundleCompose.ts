/**
 * Pure use-case bundle mutations for review portal compose (add / delete / duplicate / reorder).
 */

import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import { newAgentUseCaseTurnId } from '@types/aiAgentUseCases';
import {
  applySiblingReorderForPersist,
  collectUseCaseSubtreeIds,
} from '../tree/useCaseHierarchy';
import { orderUseCasesWithDepth } from '../tree/useCaseTreeOrder';

function newUseCaseId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `uc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export interface CreateBlankUseCaseResult {
  useCases: AIAgentUseCase[];
  newId: string;
}

/** Appends a blank root-level use case with the next sibling `sort_order`. */
export function createBlankUseCaseInList(
  useCases: readonly AIAgentUseCase[],
  opts?: { parentId?: string | null; label?: string }
): CreateBlankUseCaseResult {
  const parentId = opts?.parentId ?? null;
  const siblings = useCases.filter((u) => (u.parent_id ?? null) === parentId);
  const sortOrder =
    siblings.length === 0 ? 0 : Math.max(...siblings.map((s) => s.sort_order)) + 1;
  const id = newUseCaseId();
  const turnId = newAgentUseCaseTurnId();
  const uc: AIAgentUseCase = {
    id,
    label: opts?.label?.trim() || 'Nuovo scenario',
    parent_id: parentId,
    sort_order: sortOrder,
    refinement_prompt: '',
    payoff: '',
    dialogue: [{ turn_id: turnId, role: 'assistant', content: '', editable: true }],
    notes: { behavior: '', tone: '' },
    bubble_notes: {},
  };
  return { useCases: [...useCases, uc], newId: id };
}

/** Removes `useCaseId` and its entire subtree. */
export function deleteUseCaseFromList(
  useCases: readonly AIAgentUseCase[],
  useCaseId: string
): AIAgentUseCase[] {
  if (!useCases.some((u) => u.id === useCaseId)) return [...useCases];
  const removeIds = collectUseCaseSubtreeIds(useCases, useCaseId);
  return useCases.filter((u) => !removeIds.has(u.id));
}

/** Deep-clones a use case subtree with fresh ids; duplicate is inserted after the source among siblings. */
export function duplicateUseCaseInList(
  useCases: readonly AIAgentUseCase[],
  useCaseId: string
): { useCases: AIAgentUseCase[]; newRootId: string | null } {
  const source = useCases.find((u) => u.id === useCaseId);
  if (!source) return { useCases: [...useCases], newRootId: null };

  const subtreeIds = collectUseCaseSubtreeIds(useCases, useCaseId);
  const idMap = new Map<string, string>();
  for (const id of subtreeIds) {
    idMap.set(id, newUseCaseId());
  }

  const { ordered } = orderUseCasesWithDepth(useCases.filter((u) => subtreeIds.has(u.id)));
  const parentId = source.parent_id ?? null;
  const siblings = useCases.filter((u) => (u.parent_id ?? null) === parentId);
  const rootSortOrder = Math.max(...siblings.map((s) => s.sort_order), -1) + 1;

  const clones = ordered.map((u) => {
    const newId = idMap.get(u.id)!;
    const mappedParent =
      u.id === useCaseId
        ? parentId
        : u.parent_id && idMap.has(u.parent_id)
          ? idMap.get(u.parent_id)!
          : parentId;
    const dialogue = (u.dialogue ?? []).map((t) => ({
      ...t,
      turn_id: newAgentUseCaseTurnId(),
    }));
    return {
      ...u,
      id: newId,
      parent_id: mappedParent,
      sort_order: u.id === useCaseId ? rootSortOrder : u.sort_order,
      label:
        u.id === useCaseId
          ? `${(u.label || 'Scenario').trim()} (copia)`.trim()
          : u.label,
      dialogue,
    };
  });

  return {
    useCases: [...useCases, ...clones],
    newRootId: idMap.get(useCaseId) ?? null,
  };
}

/** Moves a use case one step among its siblings (same `parent_id`). */
export function moveUseCaseAmongSiblings(
  useCases: readonly AIAgentUseCase[],
  useCaseId: string,
  direction: 'up' | 'down'
): AIAgentUseCase[] {
  const current = useCases.find((u) => u.id === useCaseId);
  if (!current) return [...useCases];
  const parentId = current.parent_id ?? null;
  const siblings = useCases
    .filter((u) => (u.parent_id ?? null) === parentId)
    .sort((a, b) => a.sort_order - b.sort_order || String(a.label).localeCompare(String(b.label)));
  const idx = siblings.findIndex((u) => u.id === useCaseId);
  if (idx < 0) return [...useCases];
  const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= siblings.length) return [...useCases];
  const target = siblings[targetIdx]!;
  const position = direction === 'up' ? 'before' : 'after';
  return applySiblingReorderForPersist(useCases, useCaseId, target.id, position);
}
