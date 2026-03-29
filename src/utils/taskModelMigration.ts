/**
 * Task row migration — public API surface (kind, standalone materialization, wizard snapshot, promotion).
 * See docs/task-model-migration-step1-spec.md.
 */

export { materializeTask, materializeTaskFromRepository } from './MaterializationOrchestrator';
export { inferTaskKind, isStandalone, hasLocalSchema, taskKindLabel } from './taskKind';
export { buildStandaloneTaskTreeView } from './buildStandaloneTaskTreeView';
export { persistWizardInstanceFirstRow } from './wizard/persistWizardInstanceFirstRow';
export {
  canPromoteStandaloneToProjectTemplateMvp,
  promoteStandaloneToProjectTemplate,
  collectInstanceNodesPostOrder,
} from './promoteStandaloneToProjectTemplate';
