/**
 * Facade for the transactional flow workspace model: one event API, deterministic snapshot output.
 */

export { applyWorkspaceMachineEvent, type ApplyWorkspaceMachineEventOutcome } from './applyWorkspaceMachineEvent';
export type { WorkspaceMachineEvent, WorkspaceMachineSnapshot } from './WorkspaceMachineEvents';
export {
  isStrictStoreUpsertMergeEnabled,
  isViewerOnlyStoreAlignedRowsEnabled,
} from './flowMachineConfig';
export { createTxnStructuralOrchestratorContext } from './txnStructuralOrchestratorContext';
export { txnStructuralCommitFlowSlices } from './txnFlowSliceCommit';
