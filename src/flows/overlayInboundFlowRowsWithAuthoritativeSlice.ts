/**
 * DockManager inbound `upsertFlow` often carries `{ ...slice, variables | tasks }` where `slice` was
 * captured earlier (VariableCreationService, async, or closure). Row `text` can lag behind the
 * FlowStore slice the user sees. Before applying UPSERT_FLOW, align row labels with the authoritative
 * canvas slice for the same flow id (`flowsSnapshotRef` in AppContent).
 */

export function overlayInboundFlowRowsWithAuthoritativeSlice(
  authoritative: { nodes?: unknown[] } | undefined,
  incoming: { nodes?: unknown[] } | undefined
): unknown[] | undefined {
  if (!incoming || !Array.isArray(incoming.nodes) || incoming.nodes.length === 0) {
    return incoming?.nodes;
  }
  if (!authoritative || !Array.isArray(authoritative.nodes)) {
    return incoming.nodes;
  }

  const authByNodeId = new Map<string, Record<string, unknown>>(
    (authoritative.nodes as Record<string, unknown>[]).map((n) => [String(n?.id ?? ''), n as Record<string, unknown>])
  );

  return incoming.nodes.map((incNode) => {
    const node = incNode as Record<string, unknown>;
    const nid = String(node?.id ?? '');
    const authNode = authByNodeId.get(nid);
    const incRows = (node?.data as Record<string, unknown> | undefined)?.rows;
    const authRows = (authNode?.data as Record<string, unknown> | undefined)?.rows;
    if (!authNode || !Array.isArray(incRows) || !Array.isArray(authRows)) {
      return incNode;
    }

    const authRowById = new Map<string, Record<string, unknown>>(
      (authRows as Record<string, unknown>[]).map((r) => [String(r?.id ?? ''), r as Record<string, unknown>])
    );

    const nextRows = (incRows as Record<string, unknown>[]).map((r) => {
      const rid = String(r?.id ?? '');
      const ar = authRowById.get(rid);
      if (!ar) return r;
      const at = ar.text;
      const it = r.text;
      if (at === it) return r;
      return { ...r, text: at };
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
