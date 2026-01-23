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
  parentRowAction?: string // Action type of parent row (DataRequest, ClassifyProblem, etc.)
): { tasks: CompiledTask[]; expansion: DDTExpansion } {
  const tasks: CompiledTask[] = [];
  const expansion: DDTExpansion = {
    parentNodeId,
    stepNodes: new Map(),
    recoveryNodes: new Map(),
    actionTasks: new Map()
  };

  // Get main data node
  const data = Array.isArray(ddt.data) ? ddt.data[0] : ddt.data;
  if (!data || !data.steps) {
    return { tasks, expansion };
  }

  // Process steps
  const steps = Array.isArray(data.steps) ? data.steps : [];

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
      const tasks = escalation.tasks || escalation.actions || [];

      for (let taskIndex = 0; taskIndex < tasks.length; taskIndex++) {
        const task = tasks[taskIndex];

        // ✅ UNIFIED MODEL: task is already a complete Task object (not a reference)
        if (!task.id) {
          console.warn(`[DDTExpander] Task missing id at index ${taskIndex}, skipping`);
          continue;
        }
        const taskId = task.id;
        const fullTask = task;

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
          const prevTask = tasks[taskIndex - 1];
          if (!prevTask.id) {
            console.warn(`[DDTExpander] Previous task missing id at index ${taskIndex - 1}`);
            continue;
          }
          const prevTaskId = prevTask.id;
          condition = buildRecoverySequentialCondition(prevTaskId);
        }

        // ✅ UNIFIED MODEL: Use getTemplateId() helper to get template type
        const templateId = getTemplateId(fullTask);

        // Create compiled task
        // Use fullTask.id directly (GUID) - no need to generate new ID
        const compiledTask: CompiledTask = {
          id: fullTask.id, // Use fullTask.id directly (GUID)
          action: templateId,  // ✅ Use templateId (CompiledTask.action is still string for now)
          // ✅ Campi diretti (niente wrapper value)
          ...Object.fromEntries(
            Object.entries(fullTask).filter(([key]) =>
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

