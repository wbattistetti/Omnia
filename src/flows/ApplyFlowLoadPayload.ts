/**
 * Payload merged into a flow slice when applying server/project load results.
 * Separate from FlowStore to avoid circular imports between the reducer and domain transitions.
 */

import type { Task } from '../types/taskTypes';
import type { VariableInstance } from '../types/variableTypes';
import type { FlowSubflowBindingPersisted } from '../domain/flowDocument/FlowDocument';

export type ApplyFlowLoadPayload<NodeT = any, EdgeT = any> = {
  nodes: NodeT[];
  edges: EdgeT[];
  meta?: Record<string, unknown>;
  tasks?: Task[];
  variables?: VariableInstance[];
  bindings?: FlowSubflowBindingPersisted[];
};
