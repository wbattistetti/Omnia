/**
 * Flow graph migration utilities: FlowStore-led structural edits, DnD payload contracts.
 */

export { FLOW_GRAPH_MIGRATION, warnLocalGraphMutation } from './flowGraphMigrationConfig';
export type { DragRowPayload, DndRowCommandKind } from './dndRowPayloadTypes';
export {
  buildCrossNodeRowMoveDetail,
  inferDndRowCommandKind,
  type CrossNodeRowMoveDetail,
} from './dndRowCommandDispatch';
