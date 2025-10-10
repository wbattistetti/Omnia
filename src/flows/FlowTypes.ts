export type FlowId = string;

export type Flow<NodeT = any, EdgeT = any> = {
  id: FlowId;
  title: string;
  nodes: NodeT[];
  edges: EdgeT[];
  meta?: {
    createdAt?: string;
    updatedAt?: string;
    fromTaskId?: string;
  };
};

export type WorkspaceState<NodeT = any, EdgeT = any> = {
  flows: Record<FlowId, Flow<NodeT, EdgeT>>;
  openFlows: FlowId[];
  activeFlowId: FlowId;
};


