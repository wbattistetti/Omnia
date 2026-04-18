/**
 * Canonical payload from row DnD hit-test → structural routing (incremental adoption).
 * Mirrors fields already carried on crossNodeRowMove / orchestrator hints.
 */

import type { CrossNodeDropTargetRegion } from '@components/Flowchart/utils/crossNodeRowDropHitTest';
import type { NodeRowData } from '@types/project';

/** Structural move intent for a dragged task row between flows/nodes/canvas/subflow. */
export type DragRowPayload = {
  operation: 'move';
  /** Row / task identity (same as DOM row id). */
  rowId: string;
  rowData: NodeRowData;
  sourceFlowId: string;
  sourceNodeId: string | null;
  /** Index in source node rows at drag start (same-node reorder). */
  sourceIndex: number;
  targetFlowId: string;
  targetNodeId: string | null;
  targetRowId: string | null;
  targetRegion: CrossNodeDropTargetRegion;
  /** Optional DOM-derived insert index on target node. */
  targetRowInsertIndex?: number;
};

/** Named command kinds for logs and routing (maps to StructuralOrchestrator / handlers). */
export type DndRowCommandKind =
  | 'MoveRowWithinNode'
  | 'MoveRowToNode'
  | 'MoveRowToCanvas'
  | 'MoveRowToSubflow'
  | 'MoveRowFromSubflowToParent';
