// DDT Expander: Expands DDT structure into flat tasks

import type { AssembledDDT } from '../types';
import type { CompiledTask, DDTExpansion } from './types';
import { buildStepCondition, buildRecoveryFirstActionCondition, buildRecoverySequentialCondition } from './conditionBuilder';

// Types for DDT structure (simplified, can be extended)
interface StepGroup {
  type?: string;
  escalations?: Escalation[];
}

interface Escalation {
  escalationId?: string;
  actions?: Action[];
}

interface Action {
  actionId?: string;
  actionInstanceId?: string;
  [key: string]: any;
}

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

  for (const stepGroup of steps as StepGroup[]) {
    const stepType = stepGroup.type || 'start';
    const stepId = `ddt-step-${parentNodeId}-${stepType}`;

    expansion.stepNodes.set(stepType, stepId);

    // Step condition: based on retrieval state
    const stepCondition = buildStepCondition(stepType);

    // Process escalations (recoveries) in step
    const escalations = stepGroup.escalations || [];

    for (let escIndex = 0; escIndex < escalations.length; escIndex++) {
      const escalation = escalations[escIndex] as Escalation;
      const recoveryId = escalation.escalationId || `recovery-${stepType}-${escIndex + 1}`;

      expansion.recoveryNodes.set(recoveryId, recoveryId);

      // Process tasks in recovery (renamed from actions)
      // ✅ MIGRATION: Support both tasks (new) and actions (legacy)
      const taskRefs = escalation.tasks || escalation.actions || [];

      for (let taskIndex = 0; taskIndex < taskRefs.length; taskIndex++) {
        const taskRef = taskRefs[taskIndex] as any;
        // ✅ NO FALLBACK: Solo id per tasks, actionInstanceId per actions legacy
        const taskId = taskRef.id || taskRef.actionInstanceId || taskRef.templateId || taskRef.actionId || `task-${recoveryId}-${taskIndex + 1}`;

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
          const prevTaskRef = taskRefs[taskIndex - 1] as any;
          const prevTaskId = prevTaskRef.id || prevTaskRef.actionInstanceId || prevTaskRef.templateId || prevTaskRef.actionId || `task-${recoveryId}-${taskIndex}`;
          condition = buildRecoverySequentialCondition(prevTaskId);
        }

        // Create compiled task
        // Use task.id directly (GUID) - no need to generate new ID
        // ✅ Fields directly on task (no value wrapper) - copy all fields except id, templateId, createdAt, updatedAt
        const { id, templateId, createdAt, updatedAt, ...taskFields } = task;

        const compiledTask: CompiledTask = {
          id: task.id, // Use task.id directly (GUID)
          action: task.action || task.templateId,
          value: taskFields, // ✅ All fields directly (no wrapper)
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

