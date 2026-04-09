import type { MappingEntry } from '../components/FlowMappingPanel/mappingTypes';

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
    /** Flow-as-task: exposed Input / Output wiring (solo vista in store; persistenza opzionale in flow_meta). */
    flowInterface?: {
      input: MappingEntry[];
      output: MappingEntry[];
    };
  };
  /**
   * Step 3: True after server data was applied for this flow (or after a successful project save sync).
   */
  hydrated?: boolean;
  /**
   * True after {@link VariableCreationService.hydrateVariablesFromFlow} has run for the current workspace
   * snapshot and this flow slice is hydrated — child flow variable scope is consistent for interface UI.
   */
  variablesReady?: boolean;
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


