/**
 * When loadFlow returns an empty graph but the workspace slice already has nodes from an
 * in-memory edit (e.g. task → subflow move not yet persisted), avoid replacing local state.
 */

export function shouldKeepLocalGraphOnEmptyServerResponse(params: {
  serverNodeCount: number;
  localNodeCount: number;
  hasLocalChanges: boolean | undefined;
  /** When set, empty server response never wipes a non-empty subflow canvas (flags can lag). */
  flowId?: string;
}): boolean {
  const { serverNodeCount, localNodeCount, hasLocalChanges, flowId } = params;
  if (serverNodeCount !== 0 || localNodeCount <= 0) return false;
  if (hasLocalChanges === true) return true;
  const id = String(flowId || '');
  return id.startsWith('subflow_');
}
