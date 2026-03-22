/**
 * Order hierarchical use cases depth-first (parent before children, siblings by sort_order).
 */

import type { AIAgentUseCase } from '@types/aiAgentUseCases';

/** Returns ordered list and depth (0 = root) per use case id. */
export function orderUseCasesWithDepth(
  cases: readonly AIAgentUseCase[]
): { ordered: AIAgentUseCase[]; depthById: Record<string, number> } {
  const byParent = new Map<string | null, AIAgentUseCase[]>();
  for (const c of cases) {
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
