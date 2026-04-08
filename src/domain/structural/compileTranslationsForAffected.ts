/**
 * Translation compilation for reference scanning runs inside `applyTaskMoveToSubflow` after hydration.
 * Re-export for callers that need the same compiler outside a full apply (tests / future split).
 */

export { compileTranslationsToInternalMap } from '../taskSubflowMove/referenceScanCompile';
