import { v4 as uuidv4 } from 'uuid';
import type { IntentMessages } from '../components/IntentMessagesBuilder';

/**
 * Converte IntentMessages in formato DDT steps e li salva nel DDT
 * Per ProblemClassification, i messaggi vanno in mainData[0].steps quando kind === "intent"
 */
export function saveIntentMessagesToDDT(ddt: any, messages: IntentMessages): any {
  console.log('[saveIntentMessagesToDDT][START]', {
    ddtId: ddt?.id,
    ddtLabel: ddt?.label,
    mainDataLength: ddt?.mainData?.length,
    firstMainKind: ddt?.mainData?.[0]?.kind,
    messages: {
      start: messages.start?.length || 0,
      noInput: messages.noInput?.length || 0,
      noMatch: messages.noMatch?.length || 0,
      confirmation: messages.confirmation?.length || 0
    }
  });

  if (!ddt || !messages) {
    console.warn('[saveIntentMessagesToDDT] Missing ddt or messages', { ddt: !!ddt, messages: !!messages });
    return ddt;
  }

  // Crea una copia del DDT
  const updated = JSON.parse(JSON.stringify(ddt));

  // ✅ Assicurati che mainData[0] esista e abbia kind === "intent"
  if (!Array.isArray(updated.mainData) || updated.mainData.length === 0) {
    // Se non c'è mainData, crealo con kind: "intent"
    updated.mainData = [{
      label: updated.label || 'Intent',
      kind: 'intent',
      steps: {},
      subData: []
    }];
  }

  const firstMain = updated.mainData[0];

  // ✅ Assicurati che kind === "intent"
  if (firstMain.kind !== 'intent') {
    firstMain.kind = 'intent';
  }

  // ✅ Inizializza steps in mainData[0] se non esiste
  if (!firstMain.steps) {
    firstMain.steps = {};
  }

  // Helper per creare una escalation con un messaggio
  const createEscalation = (text: string): any => ({
    escalationId: uuidv4(),
    actions: [
      {
        actionId: 'sayMessage',
        actionInstanceId: uuidv4(),
        parameters: [
          {
            parameterId: 'text',
            value: text, // Direct text value (no textKey per semplicità iniziale)
          },
        ],
      },
    ],
  });

  // Helper per creare uno step con escalations
  const createStep = (type: string, messageList: string[]): any => ({
    type,
    escalations: messageList.map(msg => createEscalation(msg)),
  });

  // ✅ Crea steps per ogni tipo di messaggio in mainData[0].steps
  if (messages.start && messages.start.length > 0) {
    firstMain.steps.start = createStep('start', messages.start);
  }

  if (messages.noInput && messages.noInput.length > 0) {
    firstMain.steps.noInput = createStep('noInput', messages.noInput);
  }

  if (messages.noMatch && messages.noMatch.length > 0) {
    firstMain.steps.noMatch = createStep('noMatch', messages.noMatch);
  }

  if (messages.confirmation && messages.confirmation.length > 0) {
    firstMain.steps.confirmation = createStep('confirmation', messages.confirmation);
  }

  console.log('[saveIntentMessagesToDDT][END]', {
    updatedDDTId: updated.id,
    firstMainKind: updated.mainData[0].kind,
    stepsCreated: Object.keys(firstMain.steps),
    stepDetails: Object.entries(firstMain.steps).map(([key, step]: [string, any]) => ({
      stepKey: key,
      escalationsCount: step.escalations?.length || 0,
      firstMessage: step.escalations?.[0]?.actions?.[0]?.parameters?.[0]?.value || 'N/A'
    }))
  });

  return updated;
}

