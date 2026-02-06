/**
 * Domain Layer - Barrel Export
 *
 * Centralized exports for all domain operations.
 * This provides a clean API for TaskTree and Node operations.
 */

// TaskTree operations
export {
  getMainNodes,
  getSubNodes,
  hasMultipleMainNodes,
  findNodeByIndices,
} from './taskTree';

// Node operations
export {
  getNodeStepKeys,
  getNodeStepData,
  getNodeLabel,
  removeNode,
} from './node';
