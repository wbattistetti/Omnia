/**
 * Task Context Helpers
 *
 * Utilities for checking if tasks can be used in specific contexts.
 */

import { TaskContext, EscalationStepType, AllowedContext, parseAllowedContext } from '../types/taskContext';

export interface TaskWithContexts {
  allowedContexts?: AllowedContext[];
}

/**
 * Check if a task is allowed in a specific context
 *
 * @param task - Task object with allowedContexts property
 * @param context - The context to check (e.g., TaskContext.ESCALATION)
 * @param stepType - Optional step type for escalation contexts (e.g., EscalationStepType.START)
 * @returns true if the task can be used in the specified context
 *
 * @example
 * // Check if task can be used in any escalation
 * isTaskAllowedInContext(task, TaskContext.ESCALATION)
 *
 * // Check if task can be used in escalation start step
 * isTaskAllowedInContext(task, TaskContext.ESCALATION, EscalationStepType.START)
 */
export function isTaskAllowedInContext(
  task: TaskWithContexts,
  context: TaskContext,
  stepType?: EscalationStepType
): boolean {
  // ✅ FALLBACK: Se allowedContexts non è specificato, permettere ESCALATION per retrocompatibilità
  // Questo permette ai task legacy di essere mostrati nel pannello Tasks
  if (!task.allowedContexts || task.allowedContexts.length === 0) {
    // Se il contesto è ESCALATION e non ci sono allowedContexts, assumi che sia permesso (retrocompatibilità)
    if (context === TaskContext.ESCALATION) {
      return true;
    }
    return false; // Default: not allowed if not specified for other contexts
  }

  // Check for generic context (e.g., 'escalation' allows all escalation steps)
  if (task.allowedContexts.includes(context)) {
    return true;
  }

  // Check for specific context (e.g., 'escalation:start')
  if (stepType) {
    const specificContext = `${context}:${stepType}` as AllowedContext;
    if (task.allowedContexts.includes(specificContext)) {
      return true;
    }
  }

  return false;
}

/**
 * Filter tasks by context
 *
 * @param tasks - Array of tasks to filter
 * @param context - The context to filter by
 * @param stepType - Optional step type for escalation contexts
 * @returns Filtered array of tasks allowed in the specified context
 */
export function filterTasksByContext<T extends TaskWithContexts>(
  tasks: T[],
  context: TaskContext,
  stepType?: EscalationStepType
): T[] {
  return tasks.filter(task => isTaskAllowedInContext(task, context, stepType));
}

/**
 * Get all contexts where a task is allowed
 *
 * @param task - Task object with allowedContexts property
 * @returns Array of parsed contexts with their step types
 */
export function getTaskContexts(task: TaskWithContexts): Array<{
  context: TaskContext;
  stepType?: EscalationStepType;
}> {
  if (!task.allowedContexts || task.allowedContexts.length === 0) {
    return [];
  }

  return task.allowedContexts.map(parseAllowedContext);
}
