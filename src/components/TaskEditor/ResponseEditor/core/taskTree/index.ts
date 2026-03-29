/**
 * Path-based TaskTree utilities (immutable updates, id backfill).
 */

export type { NodePath } from './taskTreeTypes';
export {
  createManualTaskTreeNode,
  ensureTaskTreeNodeIds,
  getNodeByPath,
  getChildrenOfParent,
  updateNodeByPath,
  replaceNodeAtPath,
  removeNodeByPath,
  insertChildAt,
  reorderSiblings,
  findPathById,
} from './taskTreeUtils';
export {
  createDefaultManualStepDictionary,
  createManualTaskTreeNodeWithDefaultBehaviour,
  mergeTaskTreeStepsForTemplate,
  withDefaultManualBehaviourSteps,
} from './manualDefaultBehaviourSteps';
export { ensureTaskTreeStepSlicesForAllNodes } from './ensureTaskTreeStepSlicesForAllNodes';
