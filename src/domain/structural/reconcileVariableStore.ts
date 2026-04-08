/**
 * Reconciles the in-memory VariableStore with the TaskRepository using a full flow-graph snapshot.
 *
 * **Allowed call sites:**
 * - {@link runStructuralCommand} (pipeline step 6)
 * - Project bootstrap: {@link bootstrapProjectVariableStoreFromFlowGraph} (DockManager / FlowCanvasHost fingerprint)
 *
 * Do not call `VariableCreationService.hydrateVariablesFromFlow` directly elsewhere — use this module
 * so hydration policy stays centralized.
 */

import type { WorkspaceState } from '@flows/FlowTypes';
import { variableCreationService } from '@services/VariableCreationService';

export function reconcileUtteranceVariableStoreWithFlowGraph(
  projectId: string | null | undefined,
  flows: WorkspaceState['flows'] | null | undefined
): void {
  variableCreationService.hydrateVariablesFromFlow(projectId, flows);
}

/** Initial / fingerprint-driven hydration when the workspace loads or the canvas graph changes. */
export function bootstrapProjectVariableStoreFromFlowGraph(
  projectId: string | null | undefined,
  flows: WorkspaceState['flows'] | null | undefined
): void {
  variableCreationService.hydrateVariablesFromFlow(projectId, flows);
}
