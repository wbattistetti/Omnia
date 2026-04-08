/**
 * Row pointer-drop flow semantics (see useNodeDragDrop + FlowInterfaceBottomPanel).
 *
 * - Source flow: canvas that owns the dragged row (`normalizeFlowCanvasId(flowCanvasId)` on the node).
 * - Target flow: DOM under the pointer (`data-flow-canvas-id` on Interface OUTPUT / Backend mapping).
 *
 * Hit-testing uses the topmost matching panel (any flow) so drops succeed even when the row's
 * `flowCanvasId` prop is missing or does not match the visible Interface panel.
 *
 * When `fromFlowCanvasId !== flowId` on an OUTPUT drop into a subflow, the Interface panel may run
 * `resyncSubflowInterfaceForTaskOnChildCanvas` so OUTPUT/bindings align with parent reference rules.
 */

export {
  normalizeFlowCanvasId,
  findInterfaceZoneHitAtPoint,
  findBackendMappingHitAtPoint,
} from '../../../FlowMappingPanel/flowInterfaceDragTypes';
