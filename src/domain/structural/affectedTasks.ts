/**
 * Derives (taskInstanceId, flowCanvasId) pairs touched by a structural command for logging and DEV checks.
 */

import type { StructuralCommand } from './commands';

export type TaskFlowPair = { taskInstanceId: string; flowId: string };

export function affectedTaskFlowPairs(command: StructuralCommand): TaskFlowPair[] {
  switch (command.type) {
    case 'moveTaskRow':
    case 'moveTaskRowToCanvas':
      return [
        { taskInstanceId: command.rowId, flowId: command.fromFlowId },
        { taskInstanceId: command.rowId, flowId: command.toFlowId },
      ];
    case 'moveTaskRowIntoSubflow':
      return [
        { taskInstanceId: command.rowId, flowId: command.parentFlowId },
        { taskInstanceId: command.rowId, flowId: command.childFlowId },
      ];
    case 'resyncSubflowInterface':
      return [{ taskInstanceId: command.taskInstanceId, flowId: command.authoringFlowCanvasId }];
    case 'subflowWiringSecondPass':
      return [
        { taskInstanceId: command.taskInstanceId, flowId: command.parentFlowId },
        { taskInstanceId: command.taskInstanceId, flowId: command.childFlowId },
      ];
    case 'duplicateTask':
      return [{ taskInstanceId: command.rowId, flowId: command.fromFlowId }];
    case 'switchAuthoringCanvas':
      return [{ taskInstanceId: command.taskId, flowId: command.newFlowId }];
    case 'createSubflow':
      return [];
  }
}
