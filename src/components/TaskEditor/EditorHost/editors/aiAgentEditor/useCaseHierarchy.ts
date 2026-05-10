/**
 * Tree helpers for hierarchical AI Agent use cases.
 */

import type { AIAgentUseCase } from '@types/aiAgentUseCases';

function compareLabelsAsc(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

/**
 * Reassigns sibling `sort_order` alphabetically by label for every parent group.
 */
export function normalizeUseCaseSortOrderAlphabetically(
  useCases: readonly AIAgentUseCase[]
): AIAgentUseCase[] {
  const byParent = new Map<string | null, AIAgentUseCase[]>();
  for (const useCase of useCases) {
    const group = byParent.get(useCase.parent_id) ?? [];
    group.push(useCase);
    byParent.set(useCase.parent_id, group);
  }

  const nextById = new Map<string, AIAgentUseCase>();
  for (const [parentId, group] of byParent.entries()) {
    const sorted = [...group].sort(
      (a, b) => compareLabelsAsc(String(a.label || ''), String(b.label || '')) || a.id.localeCompare(b.id)
    );
    sorted.forEach((item, index) => {
      nextById.set(item.id, {
        ...item,
        parent_id: parentId,
        sort_order: index,
      });
    });
  }

  return useCases.map((item) => nextById.get(item.id) ?? item);
}

/**
 * Returns `rootId` plus every descendant id reachable via `parent_id` links.
 */
export function collectUseCaseSubtreeIds(
  useCases: readonly AIAgentUseCase[],
  rootId: string
): Set<string> {
  const byParent = new Map<string | null, string[]>();
  for (const u of useCases) {
    const p = u.parent_id;
    if (!byParent.has(p)) byParent.set(p, []);
    byParent.get(p)!.push(u.id);
  }
  const out = new Set<string>();
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    if (out.has(id)) continue;
    out.add(id);
    for (const childId of byParent.get(id) ?? []) {
      stack.push(childId);
    }
  }
  return out;
}

