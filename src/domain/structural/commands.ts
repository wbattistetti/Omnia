/**
 * Structural mutation commands — single entry shape for {@link runStructuralCommand}.
 * Every command carries stable identity and provenance for logs and queues.
 */

import type { NodeRowData } from '@types/project';
import type { TaskType } from '@types/taskTypes';

export type StructuralCommandSource = 'dnd' | 'portal' | 'menu' | 'api';

export type StructuralCommandBase = {
  commandId: string;
  source: StructuralCommandSource;
};

/** Move a task row between nodes (optionally across flow canvases). */
export type MoveTaskRowCommand = StructuralCommandBase & {
  type: 'moveTaskRow';
  rowId: string;
  fromFlowId: string;
  toFlowId: string;
  fromNodeId: string;
  toNodeId: string;
};

/** Cross-flow canvas drop: create target node in-domain and move row in one atomic graph write (no empty UI node). */
export type MoveTaskRowToCanvasCommand = StructuralCommandBase & {
  type: 'moveTaskRowToCanvas';
  rowId: string;
  fromFlowId: string;
  toFlowId: string;
  fromNodeId: string;
  newNodeId: string;
  position: { x: number; y: number };
};

/** Portal / drag-into-subflow: append row to child flow after removing from parent. */
export type MoveTaskRowIntoSubflowCommand = StructuralCommandBase & {
  type: 'moveTaskRowIntoSubflow';
  rowId: string;
  rowData: NodeRowData;
  parentFlowId: string;
  childFlowId: string;
  targetNodeId: string;
  parentSubflowTaskRowId: string;
  subflowDisplayTitle: string;
};

/** Re-run interface merge + bindings for a task authored on a subflow canvas (no graph move). */
export type ResyncSubflowInterfaceCommand = StructuralCommandBase & {
  type: 'resyncSubflowInterface';
  taskInstanceId: string;
  taskType: TaskType;
  authoringFlowCanvasId: string;
  exposeAllTaskVariablesInChildInterface?: boolean;
};

/** Second wiring pass after variable store populated (variableStore:updated). */
export type SubflowWiringSecondPassCommand = StructuralCommandBase & {
  type: 'subflowWiringSecondPass';
  parentFlowId: string;
  childFlowId: string;
  taskInstanceId: string;
  subflowDisplayTitle: string;
  parentSubflowTaskRowId: string;
  exposeAllTaskVariablesInChildInterface?: boolean;
};

export type CreateSubflowCommand = StructuralCommandBase & {
  type: 'createSubflow';
  parentFlowId: string;
  anchorNodeId: string;
};

export type DuplicateTaskCommand = StructuralCommandBase & {
  type: 'duplicateTask';
  rowId: string;
  fromFlowId: string;
};

export type SwitchAuthoringCanvasCommand = StructuralCommandBase & {
  type: 'switchAuthoringCanvas';
  taskId: string;
  newFlowId: string;
};

export type StructuralCommand =
  | MoveTaskRowCommand
  | MoveTaskRowToCanvasCommand
  | MoveTaskRowIntoSubflowCommand
  | ResyncSubflowInterfaceCommand
  | SubflowWiringSecondPassCommand
  | CreateSubflowCommand
  | DuplicateTaskCommand
  | SwitchAuthoringCanvasCommand;

export function newCommandId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}
