/**
 * Derives edge caption / condition-binding state for UI (colors, toolbar) and clear payloads.
 */

export type EdgeLike = {
  label?: string | null;
  conditionId?: string | null;
  isElse?: boolean | null;
  data?: Record<string, any> | null;
};

/** Prefer `data.label` so it wins over stale top-level `label` after context updates. */
export function resolveEdgeCaption(edgeLike: EdgeLike): string | undefined {
  const raw = edgeLike.data?.label ?? edgeLike.label;
  if (raw === undefined || raw === null) return undefined;
  const s = String(raw).trim();
  return s.length ? s : undefined;
}

/** True if the link is semantically conditioned (else branch, project condition, or script flag). */
export function edgeHasConditionBinding(edgeLike: EdgeLike): boolean {
  const d = edgeLike.data || {};
  if (edgeLike.isElse || d.isElse) return true;
  const cid = edgeLike.conditionId ?? d.conditionId;
  if (cid != null && String(cid).length > 0) return true;
  if (d.hasConditionScript) return true;
  return false;
}

/** Caption visible but not tied to a condition → muted (gray) styling. */
export function edgeCaptionRequiresMutedStyle(edgeLike: EdgeLike): boolean {
  return !!resolveEdgeCaption(edgeLike) && !edgeHasConditionBinding(edgeLike);
}

/**
 * Full reset to an unconditioned link: clears caption, condition id, else, and UI data flags.
 */
export function buildClearEdgeConditionUpdates(): Record<string, any> {
  return {
    label: undefined,
    conditionId: undefined,
    isElse: false,
    data: {
      isElse: false,
      hasConditionScript: false,
      conditionId: undefined,
      actType: undefined,
    },
  };
}
