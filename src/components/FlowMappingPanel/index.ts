/**
 * Unified flow mapping panel: backend wire (SEND/RECEIVE) vs subflow interface (INPUT/OUTPUT).
 */

export { UnifiedFlowMappingPanel } from './UnifiedFlowMappingPanel';
export type { UnifiedFlowMappingPanelProps } from './UnifiedFlowMappingPanel';
export { MappingRowShell } from './MappingRowShell';
export { MappingBlock } from './MappingBlock';
export { FlowMappingTree } from './FlowMappingTree';
export { LabelWithPencilEdit } from './LabelWithPencilEdit';
export { useContainerWidth } from './useContainerWidth';
export type { FlowMappingVariant, MappingEntry } from './types';
export { createMappingEntry } from './mappingTypes';
export { buildMappingTree, renameLeafSegment } from './mappingTreeUtils';
export type { MappingTreeNode } from './mappingTreeUtils';
