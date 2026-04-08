/**
 * Rules for dragging task rows onto nodes that expose a subflow portal (child canvas).
 * Routing a row into a child subflow runs applyTaskMoveToSubflow (variables + interfaces);
 * that path is not supported for Subflow (flow) tasks until cross-subflow reference rules exist.
 */

import { TaskType } from '@types/taskTypes';

/** When true, the portal listener must not route the row into the child flow — keep it on the parent canvas. */
export function shouldBlockPortalRoutingForSubflowTaskRow(taskType: TaskType | undefined): boolean {
  return taskType === TaskType.Subflow;
}
