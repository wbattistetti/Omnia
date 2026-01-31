// Moved from orchestrator/StepBuilder.ts for modular DDTAssembler structure.
import { StepGroup, Escalation, KNOWN_ACTIONS } from './types';
import type { Task } from '../../../types/taskTypes';
import { TaskType, templateIdToTaskType } from '../../../types/taskTypes';
import { v4 as uuidv4 } from 'uuid';

/**
 * Builds a complete Task object for escalation.
 *
 * Model:
 * - Each escalation has its own dedicated Task (not shared)
 * - Task is complete (not lightweight reference)
 * - Steps are always copied (disconnected from template)
 * - Contracts are inherited from template (unless overridden)
 */
export function buildTask(
  stepType: string,
  message: string,
  ddtId: string,
  translations: Record<string, string>
): Task {
  // ✅ Rimosso askQuestion, usa DataRequest per step 'start'
  const templateId = stepType === 'start' ? 'DataRequest' : 'sayMessage';
  const taskId = uuidv4(); // Unique Task ID
  const parameterId = KNOWN_ACTIONS[templateId]?.defaultParameter || 'text';
  const valueKey = `runtime.${ddtId}.${stepType}.${templateId}.${taskId}.text`;

  // Save translation key-value pair
  translations[valueKey] = message;

  // ✅ CRITICAL: NO FALLBACK - type MUST be derived from templateId
  const taskType = templateIdToTaskType(templateId);
  if (taskType === TaskType.UNDEFINED) {
    throw new Error(`[StepBuilder.buildTask] Cannot determine task type from templateId '${templateId}'. This is a bug in task creation.`);
  }

  // Return complete Task object
  return {
    id: taskId,
    type: taskType, // ✅ NO FALLBACK - must be present
    templateId: null, // Standalone task (not derived from template)
    text: message, // Direct text value
    // Store parameters for backward compatibility with old system
    params: {
      [parameterId]: valueKey
    },
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

// ✅ REMOVED: buildTaskReference - DEPRECATED
// Usa buildTask direttamente

export function buildActionInstance(
  stepType: string,
  message: string,
  ddtId: string,
  translations: Record<string, string>
): Task {
  return buildTask(stepType, message, ddtId, translations);
}

/**
 * Builds a pure Escalation object and returns it along with all translation key/values to add.
 */
export function buildEscalation(
  stepType: string,
  messages: string[],
  ddtId: string,
  translations: Record<string, string>
): Escalation {
  const escalationId = uuidv4();
  const tasks = messages.map(msg =>
    buildTask(stepType, msg, ddtId, translations)
  );
  return {
    escalationId,
    tasks
    // ❌ RIMOSSO: actions - legacy field, non più necessario
  };
}

/**
 * Builds a pure StepGroup object and returns it along with all translation key/values to add.
 */
export function buildStepGroup(
  stepType: StepGroup['type'],
  messagesArr: string[][],
  ddtId: string,
  translations: Record<string, string>
): StepGroup {
  const escalations = messagesArr.map(messages =>
    buildEscalation(stepType, messages, ddtId, translations)
  );
  return {
    type: stepType,
    escalations
  };
}