/**
 * Tree helpers for hierarchical AI Agent use cases: sibling order either follows **dialogue/list flow**
 * (first occurrence in the design-time array — merge extend, ordine API) or **alphabetical labels**
 * (toolbar AB).
 */

import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import { orderUseCasesWithDepth } from './useCaseTreeOrder';

function compareLabelsAsc(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

/** Ordine tra fratelli: flusso dialogo (come da lista/API) vs alfabetico su etichetta. */
export type UseCaseSiblingSortMode = 'logical' | 'alphabetical';

function withSiblingOrderIfChanged(
  item: AIAgentUseCase,
  parentId: string | null,
  sortOrder: number
): AIAgentUseCase {
  const pid = parentId ?? null;
  if (item.parent_id === pid && item.sort_order === sortOrder) {
    return item;
  }
  return { ...item, parent_id: pid, sort_order: sortOrder };
}

function finalizeSiblingOrderList(
  useCases: readonly AIAgentUseCase[],
  nextById: Map<string, AIAgentUseCase>
): AIAgentUseCase[] {
  let changed = false;
  const next = useCases.map((item) => {
    const n = nextById.get(item.id) ?? item;
    if (n !== item) changed = true;
    return n;
  });
  return changed ? next : [...useCases];
}

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
      nextById.set(item.id, withSiblingOrderIfChanged(item, parentId, index));
    });
  }

  return finalizeSiblingOrderList(useCases, nextById);
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
      nextById.set(item.id, withSiblingOrderIfChanged(item, parentId, index));
    });
  }

  return finalizeSiblingOrderList(useCases, nextById);
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
  const pid = (u: AIAgentUseCase) => u.parent_id ?? null;
  if (!dragged || !target || pid(dragged) !== pid(target)) {
    return [...useCases];
  }
  const parentId = pid(dragged);
  const siblings = useCases
    .filter((u) => pid(u) === parentId)
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
    pid(u) === parentId && orderMap.has(u.id)
      ? { ...u, sort_order: orderMap.get(u.id) ?? 0, parent_id: parentId }
      : u
  );
}

/**
 * Applica {@link reorderUseCaseSibling} e riallinea l'array in ordine depth-first così
 * `normalizeUseCaseSortOrderLogical` (via `setUseCasesUser`) non annulla il nuovo `sort_order`
 * usando ancora i vecchi indici di prima occorrenza nell'array piatto.
 */
export function applySiblingReorderForPersist(
  useCases: readonly AIAgentUseCase[],
  draggedId: string,
  targetId: string,
  position: 'before' | 'after'
): AIAgentUseCase[] {
  const stepped = reorderUseCaseSibling(useCases, draggedId, targetId, position);
  const dragged = stepped.find((u) => u.id === draggedId);
  const target = stepped.find((u) => u.id === targetId);
  const pid = (u: AIAgentUseCase) => u.parent_id ?? null;
  if (!dragged || !target || pid(dragged) !== pid(target)) {
    return [...useCases];
  }
  const { ordered } = orderUseCasesWithDepth(stepped);
  return normalizeUseCaseSortOrderLogical(ordered);
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

