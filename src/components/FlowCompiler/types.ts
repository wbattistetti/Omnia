// Flow Compiler Types
// Compiler transforms flowchart topology + DDT into flat list of Tasks with conditions

import type { Task } from '../../types/taskTypes';
import type { Node, Edge } from 'reactflow';
import type { NodeData, EdgeData } from '../Flowchart/types/flowTypes';
import type { AssembledDDT } from '../DialogueDataTemplateBuilder/DDTAssembler/currentDDT.types';

/**
 * Task State: Execution state of a task
 */
export type TaskState = 'UnExecuted' | 'Executed' | 'WaitingUserInput';

/**
 * Retrieval State: State of data retrieval in DDT
 */
export type RetrievalState = 'empty' | 'asrNoMatch' | 'asrNoInput' | 'saturated' | 'confirmed';

/**
 * Condition: Defines when a task can be executed
 */
export type Condition =
  | { type: 'Always' } // Always executable (entry node first row)
  | { type: 'TaskState'; taskId: string; state: TaskState } // Task state check
  | { type: 'RetrievalState'; state: RetrievalState } // DDT retrieval state
  | { type: 'StepActivated'; stepId: string } // Step is active
  | { type: 'EdgeCondition'; edgeId: string; condition: any } // Edge condition from flowchart
  | { type: 'And'; conditions: Condition[] } // All conditions must be true
  | { type: 'Or'; conditions: Condition[] } // At least one condition must be true
  | { type: 'Not'; condition: Condition }; // Negation (used for Else edges)

/**
 * CompiledTask: Task with condition and state for execution
 */
export interface CompiledTask {
  id: string; // Task.id (GUID) - same as row.id for flowchart tasks
  action: string; // Task.action (e.g., 'SayMessage', 'GetData')
  value: Record<string, any>; // Task.value
  condition: Condition | null; // Execution condition
  state: TaskState; // Current execution state
  source: {
    type: 'flowchart' | 'ddt-step' | 'ddt-recovery-action';
    nodeId?: string; // Flowchart node ID (if from flowchart)
    rowId?: string; // Flowchart row ID (if from flowchart)
    stepType?: string; // DDT step type (if from DDT)
    recoveryId?: string; // DDT recovery ID (if from recovery)
    actionId?: string; // DDT action ID (if from recovery)
    parentRowAction?: string; // Action type of parent row (GetData, ClassifyProblem, etc.)
  };
}

/**
 * TaskGroup: represents a node with all its tasks (rows)
 */
export interface TaskGroup {
  nodeId: string;
  execCondition?: Condition | null;
  tasks: CompiledTask[];
  executed?: boolean;
}

/**
 * Compilation Result: Output of compiler
 */
export interface CompilationResult {
  tasks: CompiledTask[];
  entryTaskId: string | null; // First task to execute (for frontend compatibility)
  taskMap: Map<string, CompiledTask>; // Fast lookup by task ID
  // VB.NET backend fields
  taskGroups?: TaskGroup[]; // TaskGroups (one per node) - from VB.NET compiler
  entryTaskGroupId?: string | null; // First TaskGroup to execute - from VB.NET compiler
}

/**
 * Execution State: Runtime state for engine
 */
export interface ExecutionState {
  executedTaskIds: Set<string>;
  variableStore: Record<string, any>;
  retrievalState: RetrievalState;
  currentNodeId: string | null;
  currentRowIndex: number;
}

/**
 * DDT Expansion: Temporary nodes/edges created from DDT
 */
export interface DDTExpansion {
  parentNodeId: string; // Flowchart node that triggered DDT expansion
  stepNodes: Map<string, string>; // stepType → nodeId
  recoveryNodes: Map<string, string>; // recoveryId → nodeId
  actionTasks: Map<string, string>; // actionId → taskId
}

