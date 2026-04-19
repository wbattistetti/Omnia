/**
 * Flow graph migration utilities: FlowStore-led structural edits, DnD payload contracts.
 */

export {
  FLOW_GRAPH_MIGRATION,
  warnLocalGraphMutation,
  logDndRouting,
} from './flowGraphMigrationConfig';
export type { DragRowPayload, DndRowCommandKind } from './dndRowPayloadTypes';
export {
  newDndTraceId,
  buildCrossNodeRowMoveDetail,
  inferDndRowCommandKind,
  buildCreateNodeFromRowDetail,
  buildDragPayloadSameNodeReorder,
  buildDragPayloadCanvasExtract,
  type CrossNodeRowMoveDetail,
  type CreateNodeFromRowEventDetail,
} from './dndRowCommandDispatch';
