/**
 * Structural orchestrator context bound to an immutable workspace `flows` snapshot for a single transaction.
 * Does not call Dock/subflow adapter upserts: {@link txnStructuralCommitFlowSlices} only verifies that
 * `flowsNext` contains every slice the pipeline intends to merge; the flow workspace then commits
 * the snapshot via the `COMMIT_WORKSPACE_SNAPSHOT` store action.
 */

import type { StructuralOrchestratorContext } from '@domain/structural/StructuralOrchestrator';
import type { WorkspaceState } from '@flows/FlowTypes';
import { getSubflowSyncTranslations } from '@domain/taskSubflowMove/subflowSyncFlowsRef';
import { txnStructuralCommitFlowSlices } from './txnFlowSliceCommit';

export function createTxnStructuralOrchestratorContext(
  flowsSnapshot: WorkspaceState['flows'],
  projectId: string,
  projectDataOverride?: unknown
): StructuralOrchestratorContext {
  const pid = String(projectId || '').trim();
  return {
    projectId: pid,
    getFlows: () => flowsSnapshot,
    commitFlowSlices: txnStructuralCommitFlowSlices,
    projectData:
      projectDataOverride !== undefined
        ? projectDataOverride
        : typeof window !== 'undefined'
          ? (window as unknown as { __projectData?: unknown }).__projectData
          : undefined,
    getTranslations: () => getSubflowSyncTranslations(),
  };
}
