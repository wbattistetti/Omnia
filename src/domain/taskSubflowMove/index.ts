/**
 * Task → subflow move orchestration and reference scanning (see docs/SEMANTICA_TASK_VARIABLES_E_SUBFLOW.md).
 */

export * from './collectReferencedVarIds';
export * from './internalReferenceHaystack';
export * from './referenceScanCompile';
export * from './persistReferenceScanInternalText';
export * from './findSubflowPortal';
export * from './moveTaskRowInFlows';
export * from './materializeTaskInSubflow';
export * from './applyTaskMoveToSubflow';
export * from './taskMoveTranslationPipeline';
export { collectSayMessageTranslationKeysFromTask } from './collectSayMessageTranslationKeys';
export {
  registerSubflowWiringSecondPass,
  tryFlushSubflowSecondPassForTask,
  unregisterSubflowWiringSecondPass,
} from './subflowWiringAfterVariableStore';
export type { SubflowWiringSecondPassRequest } from './subflowWiringAfterVariableStore';
