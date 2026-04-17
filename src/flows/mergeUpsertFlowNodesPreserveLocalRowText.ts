/**
 * When an inbound UPSERT_FLOW replaces the canvas graph (e.g. DockManager subflow sync),
 * React node positions/topology can differ slightly from the last local graph edit while
 * `flowGraphSignature` in AppContent ignores row labels — stale `data.rows` can overwrite
 * the user's row text. If the slice already has local edits, preserve row `text` per row id.
 */

export function mergeUpsertNodesPreserveLocalRowText(
  prev: { nodes?: unknown[]; hasLocalChanges?: boolean } | undefined,
  incomingNodes: unknown[] | undefined
): unknown[] | undefined {
  if (!Array.isArray(incomingNodes) || incomingNodes.length === 0) {
    return incomingNodes;
  }
  if (!prev || prev.hasLocalChanges !== true || !Array.isArray(prev.nodes)) {
    return incomingNodes;
  }

  // Translation-only upserts reuse the same nodes array reference; skip per-node work.
  if ((incomingNodes as unknown) === (prev.nodes as unknown)) {
    return incomingNodes;
  }

  const prevNodeById = new Map<string, Record<string, unknown>>(
    (prev.nodes as Record<string, unknown>[]).map((n) => [String(n?.id ?? ''), n as Record<string, unknown>])
  );

  return incomingNodes.map((incNode) => {
    const node = incNode as Record<string, unknown>;
    const id = String(node?.id ?? '');
    const pNode = prevNodeById.get(id);
    const incRows = (node?.data as Record<string, unknown> | undefined)?.rows;
    const pRows = (pNode?.data as Record<string, unknown> | undefined)?.rows;
    if (!pNode || !Array.isArray(incRows) || !Array.isArray(pRows)) {
      return incNode;
    }

    const prevRowById = new Map<string, Record<string, unknown>>(
      (pRows as Record<string, unknown>[]).map((r) => [String(r?.id ?? ''), r as Record<string, unknown>])
    );

    const nextRows = (incRows as Record<string, unknown>[]).map((r) => {
      const rid = String(r?.id ?? '');
      const pr = prevRowById.get(rid);
      if (!pr) return r;
      const pt = pr.text;
      const ct = r.text;
      if (pt === ct) return r;
      return { ...r, text: pt };
    });

    return {
      ...node,
      data: {
        ...(node.data as object),
        rows: nextRows,
      },
    };
  });
}
