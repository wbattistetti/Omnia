// Moved from orchestrator/StepBuilder.ts for modular DDTAssembler structure.
import { StepGroup, Escalation, Action, KNOWN_ACTIONS } from './types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Builds a pure ActionInstance object and returns it along with the translation key/value to add.
 */
export function buildActionInstance(
  stepType: string,
  message: string,
  ddtId: string,
  translations: Record<string, string>
): Action {
  const actionId = stepType === 'start' ? 'askQuestion' : 'sayMessage';
  const guid = uuidv4(); // Use full GUID for uniqueness
  const actionInstanceId = `${actionId}_${guid}`;
  const parameterId = KNOWN_ACTIONS[actionId].defaultParameter;
  const valueKey = `runtime.${ddtId}.${stepType}.${actionId}.${guid}.text`;
  // Salva la coppia chiave-testo direttamente
  translations[valueKey] = message;
  return {
    actionId,
    actionInstanceId,
    parameters: [
      { parameterId, value: valueKey }
    ]
  };
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
  const actions = messages.map(msg =>
    buildActionInstance(stepType, msg, ddtId, translations)
  );
  return {
    escalationId,
    actions
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