/**
 * Unified flow mapping panel: backend wire (SEND/RECEIVE) vs subflow interface (INPUT/OUTPUT).
 */

export { UnifiedFlowMappingPanel } from './UnifiedFlowMappingPanel';
export type { UnifiedFlowMappingPanelProps } from './UnifiedFlowMappingPanel';
export { InterfaceMappingEditor, BackendParameterDragChip } from './InterfaceMappingEditor';
export type { InterfaceMappingEditorProps } from './InterfaceMappingEditor';
export {
  backendInputsToMappingEntries,
  backendOutputsToMappingEntries,
  mappingEntriesToBackendInputs,
  mappingEntriesToBackendOutputs,
} from './backendCallMappingAdapter';
export type { BackendCallInputRow, BackendCallOutputRow } from './backendCallMappingAdapter';
export { MappingRowShell } from './MappingRowShell';
export { MappingBlock } from './MappingBlock';
export { FlowMappingTree } from './FlowMappingTree';
export { LabelWithPencilEdit } from './LabelWithPencilEdit';
export { useContainerWidth } from './useContainerWidth';
export type { FlowMappingVariant, MappingEntry } from './types';
export { createMappingEntry } from './mappingTypes';
export { buildMappingTree, renameLeafSegment } from './mappingTreeUtils';
export type { MappingTreeNode } from './mappingTreeUtils';
