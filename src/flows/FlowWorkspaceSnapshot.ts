import type { Edge, Node } from 'reactflow';
import type { EdgeData, FlowNode } from '../components/Flowchart/types/flowTypes';

type SnapshotFlow = {
  nodes: Node<FlowNode>[];
  edges: Edge<EdgeData>[];
  title?: string;
};

/**
 * Workspace snapshot for non-React consumers.
 * Step 4: this replaces FlowStateBridge as nodes/edges source of truth.
 */
class FlowWorkspaceSnapshotStore {
  private flowsById: Record<string, SnapshotFlow> = {};
  private activeFlowId: string = 'main';

  setSnapshot(flowsById: Record<string, SnapshotFlow>, activeFlowId: string): void {
    this.flowsById = flowsById || {};
    this.activeFlowId = activeFlowId || 'main';
  }

  getActiveFlowId(): string {
    return this.activeFlowId;
  }

  getFlowById(flowId: string): SnapshotFlow | null {
    return this.flowsById?.[flowId] ?? null;
  }

  getActiveFlow(): SnapshotFlow {
    return this.getFlowById(this.activeFlowId) ?? { nodes: [], edges: [] };
  }

  getNodes(flowId?: string): Node<FlowNode>[] {
    if (flowId) return this.getFlowById(flowId)?.nodes ?? [];
    return this.getActiveFlow().nodes ?? [];
  }

  getEdges(flowId?: string): Edge<EdgeData>[] {
    if (flowId) return this.getFlowById(flowId)?.edges ?? [];
    return this.getActiveFlow().edges ?? [];
  }
}

export const FlowWorkspaceSnapshot = new FlowWorkspaceSnapshotStore();

