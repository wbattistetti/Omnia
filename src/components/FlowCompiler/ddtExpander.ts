// DDT Expander: Expands DDT structure into flat tasks

import type { AssembledDDT, StepGroup, Escalation, Action } from '../DialogueDataTemplateBuilder/DDTAssembler/currentDDT.types';
import type { CompiledTask, DDTExpansion } from './types';
import { buildStepCondition, buildRecoveryFirstActionCondition, buildRecoverySequentialCondition } from './conditionBuilder';

/**
 * Expands DDT into compiled tasks
 * Returns tasks for all steps, recoveries, and actions
 */
export function expandDDT(
  ddt: AssembledDDT,
  parentNodeId: string,
  getTask: (taskId: string) => any, // Function to resolve Task from taskId
  parentRowAction?: string // Action type of parent row (GetData, ClassifyProblem, etc.)
): { tasks: CompiledTask[]; expansion: DDTExpansion } {
  const tasks: CompiledTask[] = [];
  const expansion: DDTExpansion = {
    parentNodeId,
    stepNodes: new Map(),
    recoveryNodes: new Map(),
    actionTasks: new Map()
  };

  // Get main data node
  const mainData = Array.isArray(ddt.mainData) ? ddt.mainData[0] : ddt.mainData;
  if (!mainData || !mainData.steps) {
    return { tasks, expansion };
  }

  // Process steps
  const steps = Array.isArray(mainData.steps) ? mainData.steps : [];

  for (const stepGroup of steps) {
    const stepType = stepGroup.type || 'start';
    const stepId = `ddt-step-${parentNodeId}-${stepType}`;

    expansion.stepNodes.set(stepType, stepId);

    // Step condition: based on retrieval state
    const stepCondition = buildStepCondition(stepType);

    // Process escalations (recoveries) in step
    const escalations = stepGroup.escalations || [];

    for (let escIndex = 0; escIndex < escalations.length; escIndex++) {
      const escalation = escalations[escIndex];
      const recoveryId = escalation.escalationId || `recovery-${stepType}-${escIndex + 1}`;

      expansion.recoveryNodes.set(recoveryId, recoveryId);

      // Process actions in recovery
      const actions = escalation.actions || [];

      for (let actionIndex = 0; actionIndex < actions.length; actionIndex++) {
        const action = actions[actionIndex];
        const actionId = action.actionInstanceId || action.actionId || `action-${recoveryId}-${actionIndex + 1}`;

        // Resolve task from action
        // Actions typically have actionId that maps to a Task
        const taskId = action.actionId || actionId;
        const task = getTask(taskId);

        if (!task) {
          console.warn(`[DDTExpander] Task not found for action: ${taskId}`);
          continue;
        }

        expansion.actionTasks.set(actionId, taskId);

        // Build condition for action
        let condition;
        if (actionIndex === 0) {
          // First action: step activated + retrieval state
          condition = {
            type: 'And',
            conditions: [
              stepCondition,
              buildRecoveryFirstActionCondition(stepId)
            ]
          };
        } else {
          // Subsequent actions: previous action completed
          const prevAction = actions[actionIndex - 1];
          const prevActionTaskId = prevAction.actionId || prevAction.actionInstanceId || `action-${recoveryId}-${actionIndex}`;
          condition = buildRecoverySequentialCondition(prevActionTaskId);
        }

        // Create compiled task
        // Use task.id directly (GUID) - no need to generate new ID
        const compiledTask: CompiledTask = {
          id: task.id, // Use task.id directly (GUID)
          action: task.action,
          value: task.value || {},
          condition,
          state: 'UnExecuted',
          source: {
            type: 'ddt-recovery-action',
            nodeId: parentNodeId, // ✅ Add nodeId so currentNodeId can be tracked for highlighting
            stepType,
            recoveryId,
            actionId,
            parentRowAction // Store parent row action type
          }
        };

        tasks.push(compiledTask);
      }
    }
  }

  return { tasks, expansion };
}

