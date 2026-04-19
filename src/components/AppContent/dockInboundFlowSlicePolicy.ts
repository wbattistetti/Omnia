/**
 * Filters DockManager_subflowSync inbound upserts: structural/content authority stays in FlowStore /
 * structural pipeline; Dock may refresh layout (node positions) without clobbering rows, copy,
 * translations, or flow-document fields.
 */

/**
 * Discard Dock slices that carry no graph payload — prevents wiping store slices with empty upserts.
 * Matches `emptyNodesExplicit` from subflow sync when the sender marks an intentional empty graph.
 */
export function shouldSkipDockInboundBareEmptySlice(incoming: unknown): boolean {
  const inc = incoming as { emptyNodesExplicit?: boolean; nodes?: unknown } | null | undefined;
  if (inc?.emptyNodesExplicit === true) return true;
  const nodes = inc?.nodes;
  return Array.isArray(nodes) && nodes.length === 0;
}

/** Skip Dock upsert when it would replace a non-empty subflow graph with an empty nodes array. */
export function shouldSkipDockInboundEmptySubflowGraph(params: {
  flowId: string;
  incomingNodes: unknown;
  currentNodes: unknown;
}): boolean {
  const fid = String(params.flowId || '').trim();
  if (!fid.startsWith('subflow_')) return false;
  const inc = params.incomingNodes;
  const cur = params.currentNodes;
  const incomingEmpty = Array.isArray(inc) && inc.length === 0;
  const currentNonEmpty = Array.isArray(cur) && cur.length > 0;
  return incomingEmpty && currentNonEmpty;
}

/**
 * Keeps authoritative flow-document slices from the current workspace (`meta`, tasks, variables, bindings)
 * when the inbound payload is from Dock layout sync. Incoming `nodes` / `edges` / `title` still apply.
 */
export function mergeDockInboundWithAuthoritativeDocFields(inc: any, current: any | undefined | null): any {
  if (current == null) return inc;
  return {
    ...inc,
    meta: current.meta ?? inc?.meta,
    tasks: current.tasks ?? inc?.tasks,
    variables: current.variables ?? inc?.variables,
    bindings: current.bindings ?? inc?.bindings,
  };
}

/**
 * Dock inbound: apply only node **layout** from `incoming` (position / drag UI fields). Keeps node
 * `data` (rows, labels) and the whole flow document (`meta`, tasks, variables, bindings, title,
 * edges) from the authoritative store slice unless the node is new on the inbound payload.
 */
export function mergeDockInboundLayoutOnly(incoming: any, current: any | undefined | null): any {
  if (current == null) return incoming;
  const incNodes = Array.isArray(incoming?.nodes) ? incoming.nodes : [];
  const curNodes = Array.isArray(current?.nodes) ? current.nodes : [];
  const curById = new Map<string, any>(curNodes.map((n: any) => [String(n?.id ?? '').trim(), n]));

  const mergedNodes = incNodes.map((inc: any) => {
    const nid = String(inc?.id ?? '').trim();
    const cur = curById.get(nid);
    if (!cur) return inc;
    return {
      ...cur,
      position: inc?.position ?? cur.position,
      ...(inc?.positionAbsolute !== undefined ? { positionAbsolute: inc.positionAbsolute } : {}),
      selected: inc?.selected ?? cur.selected,
      dragging: inc?.dragging ?? cur.dragging,
      ...(typeof inc?.width === 'number' ? { width: inc.width } : {}),
      ...(typeof inc?.height === 'number' ? { height: inc.height } : {}),
      ...(inc?.style ? { style: { ...(cur.style || {}), ...inc.style } } : {}),
      zIndex: inc?.zIndex ?? cur.zIndex,
    };
  });

  return {
    ...incoming,
    id: incoming?.id ?? current?.id,
    nodes: mergedNodes,
    edges: Array.isArray(current?.edges) ? current.edges : incoming?.edges,
    meta: current.meta ?? incoming?.meta,
    tasks: current.tasks ?? incoming?.tasks,
    variables: current.variables ?? incoming?.variables,
    bindings: current.bindings ?? incoming?.bindings,
    title: current.title ?? incoming?.title,
  };
}
