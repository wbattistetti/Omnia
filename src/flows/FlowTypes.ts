import type { FlowVariableDefinition } from './flowVariableTypes';

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
    /** Author-defined flow variables (internal / input / output / inout). */
    variables?: FlowVariableDefinition[];
  };
  /**
   * Step 3: True after server data was applied for this flow (or after a successful project save sync).
   */
  hydrated?: boolean;
  /**
   * Step 3: True when local nodes/edges were edited since last persisted sync (UPDATE_FLOW_GRAPH).
   */
  hasLocalChanges?: boolean;
};

export type WorkspaceState<NodeT = any, EdgeT = any> = {
  flows: Record<FlowId, Flow<NodeT, EdgeT>>;
  openFlows: FlowId[];
  activeFlowId: FlowId;
};


