/**
 * Serializable payload pushed to FlowStateBridge for node/edge styling (no UI).
 */
export type DebuggerFlowHighlightPayload = {
  activeNodeId: string;
  passedNodeIds: string[];
  noMatchNodeIds: string[];
  activeEdgeId: string;
};
