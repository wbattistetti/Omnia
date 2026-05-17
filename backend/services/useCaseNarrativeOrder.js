/**
 * Riordino deterministico degli use case dopo il pass narrativo LLM (depth-first + sort_order).
 */

/**
 * @param {readonly object[]} useCases
 * @returns {object[]}
 */
function flattenUseCasesDepthFirst(useCases) {
  if (!Array.isArray(useCases) || useCases.length === 0) return [];
  const ids = new Set(useCases.map((u) => u.id));
  const byParent = new Map();
  for (const u of useCases) {
    let p = u.parent_id;
    if (typeof p === 'string') {
      const t = p.trim();
      p = t.length > 0 && ids.has(t) && t !== u.id ? t : null;
    } else {
      p = null;
    }
    const arr = byParent.get(p) ?? [];
    arr.push(u);
    byParent.set(p, arr);
  }
  for (const arr of byParent.values()) {
    arr.sort((a, b) => a.sort_order - b.sort_order || String(a.label).localeCompare(String(b.label)));
  }
  const out = [];
  const walk = (parentId) => {
    for (const k of byParent.get(parentId) ?? []) {
      out.push(k);
      walk(k.id);
    }
  };
  walk(null);
  return out;
}

/**
 * Riallinea sort_order tra fratelli usando la prima occorrenza nell'array piatto.
 * @param {readonly object[]} useCases
 * @returns {object[]}
 */
function reindexSiblingSortOrderFromFlatOrder(useCases) {
  const firstIndex = new Map();
  useCases.forEach((u, i) => {
    if (!firstIndex.has(u.id)) firstIndex.set(u.id, i);
  });
  const ids = new Set(useCases.map((u) => u.id));
  const byParent = new Map();
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
  const nextById = new Map();
  for (const [parentId, group] of byParent.entries()) {
    const sorted = [...group].sort((a, b) => {
      const ia = firstIndex.get(a.id) ?? 0;
      const ib = firstIndex.get(b.id) ?? 0;
      if (ia !== ib) return ia - ib;
      return String(a.id).localeCompare(String(b.id));
    });
    sorted.forEach((item, index) => {
      nextById.set(item.id, { ...item, parent_id: parentId, sort_order: index });
    });
  }
  return useCases.map((item) => nextById.get(item.id) ?? item);
}

/**
 * Applica l'ordine depth-first restituito dal modello; valida che tutti gli id siano presenti.
 * @param {object[]} useCases
 * @param {string[]} orderedIds
 * @returns {object[]}
 */
function applyNarrativeOrder(useCases, orderedIds) {
  if (!Array.isArray(useCases) || useCases.length === 0) return [];
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    throw new Error('Narrative reorder: ordered_use_case_ids must be a non-empty array');
  }
  const byId = new Map(useCases.map((u) => [u.id, u]));
  const want = new Set(byId.keys());
  const seen = new Set();
  const ordered = [];
  for (const raw of orderedIds) {
    const id = typeof raw === 'string' ? raw.trim() : '';
    if (!id || !want.has(id) || seen.has(id)) continue;
    seen.add(id);
    ordered.push(byId.get(id));
  }
  if (seen.size !== want.size) {
    const missing = [...want].filter((id) => !seen.has(id));
    throw new Error(
      `Narrative reorder: ordered_use_case_ids incomplete (missing: ${missing.slice(0, 8).join(', ')})`
    );
  }
  return reindexSiblingSortOrderFromFlatOrder(ordered);
}

module.exports = {
  flattenUseCasesDepthFirst,
  reindexSiblingSortOrderFromFlatOrder,
  applyNarrativeOrder,
};
