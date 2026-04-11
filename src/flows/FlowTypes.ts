import type { MappingEntry } from '../components/FlowMappingPanel/mappingTypes';
import type { Task } from '../types/taskTypes';
import type { VariableInstance } from '../types/variableTypes';
import type { FlowSubflowBindingPersisted } from '../domain/flowDocument/FlowDocument';

export type FlowId = string;

/**
 * Workspace slice for one flow: mirrors persisted {@link FlowDocument} (graph + embedded domain rows).
 * Tasks / variables / bindings are the flow-local authority for save; legacy services may still mirror them during migration.
 */
export type Flow<NodeT = any, EdgeT = any> = {
  id: FlowId;
  title: string;
  nodes: NodeT[];
  edges: EdgeT[];
  /** Tasks that belong only to this flow canvas (FlowDocument.tasks). */
  tasks?: Task[];
  /** Variable rows scoped to this flow (FlowDocument.variables). */
  variables?: VariableInstance[];
  /** Subflow interface bindings for Subflow tasks on this canvas (FlowDocument.bindings). */
  bindings?: FlowSubflowBindingPersisted[];
  meta?: {
    createdAt?: string;
    updatedAt?: string;
    fromTaskId?: string;
    /** Flow-local strings; `var:<guid>` values may be `{ [locale]: text }`. */
    translations?: Record<string, string | Record<string, string>>;
    /** Flow-as-task: Input / Output wiring (persisted; labels resolved via meta.translations[labelKey]). */
    flowInterface?: {
      input: MappingEntry[];
      output: MappingEntry[];
    };
    settings?: Record<string, unknown>;
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
  /**
   * FIX-MAIN-EMPTY — True after a successful apply of server flow data (loadFlow → APPLY_FLOW_LOAD_RESULT or
   * direct upsert from load). Used to avoid infinite GET loops when the project legitimately has an empty graph.
   */
  serverHydrationApplied?: boolean;
};

export type WorkspaceState<NodeT = any, EdgeT = any> = {
  flows: Record<FlowId, Flow<NodeT, EdgeT>>;
  openFlows: FlowId[];
  activeFlowId: FlowId;
};


