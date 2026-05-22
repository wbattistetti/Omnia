/**
 * Riordino deterministico use case dopo pass narrativo / categorizzazione (depth-first + sort_order).
 * Mirror di `backend/services/useCaseNarrativeOrder.js` per uso nel bundle browser.
 */

import type { AIAgentUseCase } from '@types/aiAgentUseCases';

function reindexSiblingSortOrderFromFlatOrder(useCases: readonly AIAgentUseCase[]): AIAgentUseCase[] {
  const firstIndex = new Map<string, number>();
  useCases.forEach((u, i) => {
    if (!firstIndex.has(u.id)) firstIndex.set(u.id, i);
  });
  const ids = new Set(useCases.map((u) => u.id));
  const byParent = new Map<string | null, AIAgentUseCase[]>();
  for (const u of useCases) {
    let p = u.parent_id;
    if (typeof p === 'string') {
      const t = p.trim();
      p = t.length > 0 && ids.has(t) && t !== u.id ? t : null;
    } else {
      p = null;
    }
    const group = byParent.get(p) ?? [];
    group.push(u);
    byParent.set(p, group);
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
      nextById.set(item.id, { ...item, parent_id: parentId, sort_order: index });
    });
  }
  return useCases.map((item) => nextById.get(item.id) ?? item);
}

/**
 * Applica ordine depth-first da lista id; tutti gli id del subset devono comparire.
 */
export function applyNarrativeOrder(
  useCases: readonly AIAgentUseCase[],
  orderedIds: readonly string[]
): AIAgentUseCase[] {
  if (useCases.length === 0) return [];
  if (!orderedIds.length) {
    throw new Error('Narrative reorder: ordered_use_case_ids must be a non-empty array');
  }
  const byId = new Map(useCases.map((u) => [u.id, u]));
  const want = new Set(byId.keys());
  const seen = new Set<string>();
  const ordered: AIAgentUseCase[] = [];
  for (const raw of orderedIds) {
    const id = typeof raw === 'string' ? raw.trim() : '';
    if (!id || !want.has(id) || seen.has(id)) continue;
    seen.add(id);
    const row = byId.get(id);
    if (row) ordered.push(row);
  }
  if (seen.size !== want.size) {
    const missing = [...want].filter((id) => !seen.has(id));
    throw new Error(
      `Narrative reorder: ordered_use_case_ids incomplete (missing: ${missing.slice(0, 8).join(', ')})`
    );
  }
  return reindexSiblingSortOrderFromFlatOrder(ordered);
}
