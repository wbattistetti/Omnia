/**
 * After a task row is moved to a child flow canvas, ensures:
 * - the parent flow graph no longer references that row id;
 * - the child flow graph contains the row;
 * - TaskRepository holds one task with the same id, stable subTasks tree, and authoring scope on the child canvas.
 *
 * Task storage is global per project session (single TaskRepository map); there is no separate physical
 * "child repository" — coherence is by id + flow JSON placement + optional authoringFlowCanvasId.
 */

import type { Task } from '@types/taskTypes';
import type { WorkspaceState } from '@flows/FlowTypes';
import { taskRepository } from '@services/TaskRepository';
import { logTaskSubflowMove } from '@utils/taskSubflowMoveDebug';
import { flowContainsTaskRow, removeRowByIdFromFlow } from './moveTaskRowInFlows';

export { flowContainsTaskRow } from './moveTaskRowInFlows';

/** Key aligned with {@link Task.authoringFlowCanvasId}. */
export const TASK_AUTHORING_FLOW_CANVAS_ID = 'authoringFlowCanvasId' as const;

export type MaterializeMovedTaskResult = {
  flowsNext: WorkspaceState['flows'];
  ok: boolean;
  /** Parent canvas still had a row with this task id before final strip (should end false). */
  parentFlowContainedRowBeforeStrip: boolean;
  parentFlowContainsRowAfter: boolean;
  childFlowContainsRow: boolean;
  taskFoundInRepository: boolean;
  repositoryPatchApplied: boolean;
  errorMessage?: string;
};

/**
 * Strips any remaining row with `taskInstanceId` from the parent flow, verifies the child flow
 * contains the row, and re-persists the task (same id) with a deep clone of `subTasks` and
 * {@link TASK_AUTHORING_FLOW_CANVAS_ID} pointing at the child flow.
 */
export function materializeMovedTaskForSubflow(params: {
  projectId: string;
  parentFlowId: string;
  childFlowId: string;
  taskInstanceId: string;
  flows: WorkspaceState['flows'];
}): MaterializeMovedTaskResult {
  const { projectId, parentFlowId, childFlowId, taskInstanceId } = params;
  const pid = String(projectId || '').trim();
  const tid = String(taskInstanceId || '').trim();
  let flowsNext = params.flows;

  logTaskSubflowMove('materialize:enter', {
    projectId: pid,
    parentFlowId,
    childFlowId,
    taskInstanceId: tid,
  });

  const parentBefore = flowContainsTaskRow(flowsNext, parentFlowId, tid);
  if (parentBefore) {
    flowsNext = removeRowByIdFromFlow(flowsNext, parentFlowId, tid);
    logTaskSubflowMove('materialize:strippedParentRow', { parentFlowId, taskInstanceId: tid });
  }

  const parentAfter = flowContainsTaskRow(flowsNext, parentFlowId, tid);
  const childHas = flowContainsTaskRow(flowsNext, childFlowId, tid);
  const task = tid ? taskRepository.getTask(tid) : null;

  let repositoryPatchApplied = false;
  if (task && pid) {
    const patch: Partial<Task> = {
      authoringFlowCanvasId: String(childFlowId || '').trim(),
    };
    if (Array.isArray(task.subTasks) && task.subTasks.length > 0) {
      patch.subTasks = JSON.parse(JSON.stringify(task.subTasks)) as Task['subTasks'];
    }
    repositoryPatchApplied = taskRepository.updateTask(tid, patch, pid, {
      merge: true,
      skipSubflowInterfaceSync: true,
    });
    logTaskSubflowMove('materialize:repositoryPatch', {
      taskInstanceId: tid,
      authoringFlowCanvasId: patch.authoringFlowCanvasId,
      repositoryPatchApplied,
      hadSubTasksClone: Array.isArray(patch.subTasks) && patch.subTasks.length > 0,
    });
  }

  const ok = Boolean(
    tid && childHas && !parentAfter && task && repositoryPatchApplied
  );

  let errorMessage: string | undefined;
  if (!tid) {
    errorMessage = 'missing_task_instance_id';
  } else if (!task) {
    errorMessage = 'task_not_found_in_repository';
  } else if (!childHas) {
    errorMessage = 'child_flow_missing_task_row';
  } else if (parentAfter) {
    errorMessage = 'parent_flow_still_contains_task_row';
  } else if (!repositoryPatchApplied) {
    errorMessage = 'repository_update_failed';
  }

  logTaskSubflowMove('materialize:result', {
    ok,
    parentFlowContainedRowBeforeStrip: parentBefore,
    parentFlowContainsRowAfter: parentAfter,
    childFlowContainsRow: childHas,
    taskFoundInRepository: !!task,
    repositoryPatchApplied,
    errorMessage,
  });

  return {
    flowsNext,
    ok,
    parentFlowContainedRowBeforeStrip: parentBefore,
    parentFlowContainsRowAfter: parentAfter,
    childFlowContainsRow: childHas,
    taskFoundInRepository: !!task,
    repositoryPatchApplied,
    ...(errorMessage && !ok ? { errorMessage } : {}),
  };
}
