/**
 * Order hierarchical use cases depth-first (parent before children, siblings by sort_order).
 * Sanitizes `parent_id`: empty/whitespace → root; unknown id (not in catalog) → root; self → root.
 */

import type { AIAgentUseCase } from '@types/aiAgentUseCases';

/** Returns ordered list and depth (0 = root) per use case id. */
export function orderUseCasesWithDepth(
  cases: readonly AIAgentUseCase[]
): { ordered: AIAgentUseCase[]; depthById: Record<string, number> } {
  const ids = new Set(cases.map((c) => c.id));
  const sanitized: AIAgentUseCase[] = cases.map((c) => {
    let p: string | null = c.parent_id;
    if (typeof p === 'string') {
      const t = p.trim();
      p = t.length > 0 ? t : null;
    } else {
      p = null;
    }
    if (p !== null && !ids.has(p)) {
      p = null;
    }
    if (p === c.id) {
      p = null;
    }
    return p === c.parent_id ? c : { ...c, parent_id: p };
  });
  const byParent = new Map<string | null, AIAgentUseCase[]>();
  for (const c of sanitized) {
    const p = c.parent_id;
    const arr = byParent.get(p) ?? [];
    arr.push(c);
    byParent.set(p, arr);
  }
  for (const arr of byParent.values()) {
    arr.sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label));
  }
  const ordered: AIAgentUseCase[] = [];
  const depthById: Record<string, number> = {};
  const walk = (parentId: string | null, depth: number) => {
    const kids = byParent.get(parentId) ?? [];
    for (const k of kids) {
      ordered.push(k);
      depthById[k.id] = depth;
      walk(k.id, depth + 1);
    }
  };
  walk(null, 0);
  return { ordered, depthById };
}
