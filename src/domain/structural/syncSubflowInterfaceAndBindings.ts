/**
 * Subflow OUTPUT merge + proxy bindings live in `applyTaskMoveToSubflow` (mergeChildFlowInterfaceOutputsForVariables,
 * syncProxyBindingsForSubflowTask). The structural orchestrator invokes that function after hydration — do not call
 * merge/sync helpers directly from UI hooks.
 */

export type SubflowSyncNote = 'use_applyTaskMoveToSubflow_via_orchestrator';
