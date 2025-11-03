import { v4 as uuidv4 } from 'uuid';
import type { IntentMessages } from '../components/IntentMessagesBuilder';

/**
 * Converte IntentMessages in formato DDT steps e li salva nel DDT
 * Per ProblemClassification, i messaggi vanno nel root DDT (non in mainData)
 */
export function saveIntentMessagesToDDT(ddt: any, messages: IntentMessages): any {
  if (!ddt || !messages) return ddt;

  // Crea una copia del DDT
  const updated = JSON.parse(JSON.stringify(ddt));

  // Inizializza steps se non esiste
  if (!updated.steps) {
    updated.steps = {};
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

  // Crea steps per ogni tipo di messaggio
  if (messages.start && messages.start.length > 0) {
    updated.steps.start = createStep('start', messages.start);
  }

  if (messages.noInput && messages.noInput.length > 0) {
    updated.steps.noInput = createStep('noInput', messages.noInput);
  }

  if (messages.noMatch && messages.noMatch.length > 0) {
    updated.steps.noMatch = createStep('noMatch', messages.noMatch);
  }

  if (messages.confirmation && messages.confirmation.length > 0) {
    updated.steps.confirmation = createStep('confirmation', messages.confirmation);
  }

  return updated;
}

