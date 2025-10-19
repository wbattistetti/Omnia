import type { NodeData as BaseNodeData, EdgeData as BaseEdgeData } from '../../hooks/useNodeManager';

export interface NodeData extends BaseNodeData {
  isTemporary?: boolean;
  hidden?: boolean;
  createdAt?: number;
  batchId?: string;
}

export interface EdgeData extends BaseEdgeData {
  // Eventuali estensioni specifiche per flowchart
}

export interface TemporaryNodeResult {
  tempNodeId: string;
  tempEdgeId: string;
  position: { x: number; y: number };
}
