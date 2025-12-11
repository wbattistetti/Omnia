// Moved from orchestrator/StepBuilder.ts for modular DDTAssembler structure.
import { StepGroup, Escalation, TaskReference, KNOWN_ACTIONS } from './types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Builds a TaskReference object and returns it along with the translation key/value to add.
 * ✅ RENAMED: buildActionInstance → buildTaskReference (for clarity)
 */
export function buildTaskReference(
  stepType: string,
  message: string,
  ddtId: string,
  translations: Record<string, string>
): TaskReference {
  const templateId = stepType === 'start' ? 'askQuestion' : 'sayMessage';  // ✅ Renamed from actionId
  const guid = uuidv4(); // Use full GUID for uniqueness
  const taskId = `${templateId}_${guid}`;  // ✅ Renamed from actionInstanceId
  const parameterId = KNOWN_ACTIONS[templateId].defaultParameter;
  const valueKey = `runtime.${ddtId}.${stepType}.${templateId}.${guid}.text`;
  // Salva la coppia chiave-testo direttamente
  translations[valueKey] = message;
  return {
    templateId,  // ✅ Renamed from actionId
    taskId,      // ✅ Renamed from actionInstanceId
    parameters: [
      { parameterId, value: valueKey }
    ]
  };
}

// Legacy function name for backward compatibility
// @deprecated Use buildTaskReference instead
export function buildActionInstance(
  stepType: string,
  message: string,
  ddtId: string,
  translations: Record<string, string>
) {
  return buildTaskReference(stepType, message, ddtId, translations);
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
    buildTaskReference(stepType, msg, ddtId, translations)
  );
  return {
    escalationId,
    tasks,  // ✅ Renamed from actions
    actions: tasks  // ✅ Legacy alias for backward compatibility
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