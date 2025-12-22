// DDT Expander: Expands DDT structure into flat tasks

import type { AssembledDDT, StepGroup, Escalation, TaskReference } from '../DialogueDataTemplateBuilder/DDTAssembler/currentDDT.types';
import type { CompiledTask, DDTExpansion } from './types';
import { buildStepCondition, buildRecoveryFirstActionCondition, buildRecoverySequentialCondition } from './conditionBuilder';
import { getTemplateId } from '../../utils/taskHelpers';

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

      // Process tasks in recovery (renamed from actions)
      // ✅ MIGRATION: Support both tasks (new) and actions (legacy)
      const taskRefs = escalation.tasks || escalation.actions || [];

      for (let taskIndex = 0; taskIndex < taskRefs.length; taskIndex++) {
        const taskRef = taskRefs[taskIndex];
        // ✅ MIGRATION: Support both taskId (new) and actionInstanceId (legacy)
        const taskId = taskRef.taskId || taskRef.actionInstanceId || taskRef.templateId || taskRef.actionId || `task-${recoveryId}-${taskIndex + 1}`;

        // Resolve task from taskId
        const task = getTask(taskId);

        if (!task) {
          console.warn(`[DDTExpander] Task not found for taskId: ${taskId}`);
          continue;
        }

        expansion.actionTasks.set(taskId, taskId);

        // Build condition for task
        let condition;
        if (taskIndex === 0) {
          // First task: step activated + retrieval state
          condition = {
            type: 'And',
            conditions: [
              stepCondition,
              buildRecoveryFirstActionCondition(stepId)
            ]
          };
        } else {
          // Subsequent tasks: previous task completed
          const prevTaskRef = taskRefs[taskIndex - 1];
          const prevTaskId = prevTaskRef.taskId || prevTaskRef.actionInstanceId || prevTaskRef.templateId || prevTaskRef.actionId || `task-${recoveryId}-${taskIndex}`;
          condition = buildRecoverySequentialCondition(prevTaskId);
        }

        // ✅ MIGRATION: Use getTemplateId() helper instead of direct task.action access
        const templateId = getTemplateId(task);

        // Create compiled task
        // Use task.id directly (GUID) - no need to generate new ID
        const compiledTask: CompiledTask = {
          id: task.id, // Use task.id directly (GUID)
          action: templateId,  // ✅ Use templateId (CompiledTask.action is still string for now)
          // ✅ Campi diretti (niente wrapper value)
          ...Object.fromEntries(
            Object.entries(task).filter(([key]) =>
              !['id', 'templateId', 'createdAt', 'updatedAt'].includes(key)
            )
          ),
          condition,
          state: 'UnExecuted',
          source: {
            type: 'ddt-recovery-action',
            nodeId: parentNodeId, // ✅ Add nodeId so currentNodeId can be tracked for highlighting
            stepType,
            recoveryId,
            actionId: taskId,  // ✅ Use taskId instead of actionId
            parentRowAction // Store parent row action type (templateId)
          }
        };

        tasks.push(compiledTask);
      }
    }
  }

  return { tasks, expansion };
}

