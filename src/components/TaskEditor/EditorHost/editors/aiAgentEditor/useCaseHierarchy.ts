/**
 * Tree helpers for hierarchical AI Agent use cases: sibling order either follows **dialogue/list flow**
 * (first occurrence in the design-time array — merge extend, ordine API) or **alphabetical labels**
 * (toolbar AB).
 */

import type { AIAgentUseCase } from '@types/aiAgentUseCases';

function compareLabelsAsc(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

/** Ordine tra fratelli: flusso dialogo (come da lista/API) vs alfabetico su etichetta. */
export type UseCaseSiblingSortMode = 'logical' | 'alphabetical';

/**
 * Reassigns sibling `sort_order` using **first occurrence** of each id in the input array.
 * Preserves designer/API narrative order (merge extend = esistenti poi nuovi; generazione = ordine array modello).
 */
export function normalizeUseCaseSortOrderLogical(useCases: readonly AIAgentUseCase[]): AIAgentUseCase[] {
  const firstIndex = new Map<string, number>();
  useCases.forEach((u, i) => {
    if (!firstIndex.has(u.id)) firstIndex.set(u.id, i);
  });

  const byParent = new Map<string | null, AIAgentUseCase[]>();
  for (const useCase of useCases) {
    const group = byParent.get(useCase.parent_id) ?? [];
    group.push(useCase);
    byParent.set(useCase.parent_id, group);
  }

  const nextById = new Map<string, AIAgentUseCase>();
  for (const [parentId, group] of byParent.entries()) {
    const sorted = [...group].sort((a, b) => {
      const ia = firstIndex.get(a.id) ?? 0;
      const ib = firstIndex.get(b.id) ?? 0;
      if (ia !== ib) return ia - ib;
      return a.id.localeCompare(b.id);
    });
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
 * Applica la modalità di ordinamento scelta dall’utente (toolbar AB).
 */
export function normalizeUseCaseSiblingOrder(
  useCases: readonly AIAgentUseCase[],
  mode: UseCaseSiblingSortMode
): AIAgentUseCase[] {
  return mode === 'alphabetical'
    ? normalizeUseCaseSortOrderAlphabetically(useCases)
    : normalizeUseCaseSortOrderLogical(useCases);
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
 * Sposta `draggedId` prima o dopo `targetId` tra **fratelli** con lo stesso `parent_id`.
 * Riassegna `sort_order` 0..n-1 nel gruppo. Se i due non condividono il parent o non esistono,
 * restituisce una copia shallow dell'array invariato.
 */
export function reorderUseCaseSibling(
  useCases: readonly AIAgentUseCase[],
  draggedId: string,
  targetId: string,
  position: 'before' | 'after'
): AIAgentUseCase[] {
  if (draggedId === targetId) return [...useCases];
  const dragged = useCases.find((u) => u.id === draggedId);
  const target = useCases.find((u) => u.id === targetId);
  if (!dragged || !target || dragged.parent_id !== target.parent_id) {
    return [...useCases];
  }
  const parentId = dragged.parent_id;
  const siblings = useCases
    .filter((u) => u.parent_id === parentId)
    .sort((a, b) => a.sort_order - b.sort_order || String(a.label).localeCompare(String(b.label)));
  const ids = siblings.map((u) => u.id);
  const fromIdx = ids.indexOf(draggedId);
  const targetIdx = ids.indexOf(targetId);
  if (fromIdx < 0 || targetIdx < 0) return [...useCases];
  const without = ids.filter((id) => id !== draggedId);
  let insertAt = position === 'before' ? targetIdx : targetIdx + 1;
  if (fromIdx < targetIdx) insertAt -= 1;
  const bounded = Math.max(0, Math.min(insertAt, without.length));
  const nextOrder = [...without.slice(0, bounded), draggedId, ...without.slice(bounded)];
  const orderMap = new Map(nextOrder.map((id, i) => [id, i]));
  return useCases.map((u) =>
    u.parent_id === parentId && orderMap.has(u.id)
      ? { ...u, sort_order: orderMap.get(u.id) ?? 0, parent_id: parentId }
      : u
  );
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

