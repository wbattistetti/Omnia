import { v4 as uuidv4 } from 'uuid';
import type { IntentMessages } from '../components/IntentMessagesBuilder';
import { TaskType, templateIdToTaskType } from '../../../../types/taskTypes';

/**
 * Converte IntentMessages in formato DDT steps e li salva nel DDT
 * ✅ AGGIORNATO: Usa steps a root level (non più data[0].steps)
 * ✅ AGGIORNATO: Non crea più kind: 'intent' - tutto è DataRequest
 */
export function saveIntentMessagesToDDT(ddt: any, messages: IntentMessages): any {
  if (!ddt || !messages) {
    console.warn('[saveIntentMessagesToDDT] Missing ddt or messages');
    return ddt;
  }

  // Crea una copia del DDT
  const updated = JSON.parse(JSON.stringify(ddt));

  // ✅ Assicurati che data[0] esista (per struttura dati)
  if (!Array.isArray(updated.data) || updated.data.length === 0) {
    const firstMainId = uuidv4();
    updated.data = [{
      id: firstMainId,
      label: updated.label || 'Data',
      type: 'text', // Default type
      subData: []
    }];
  }

  const firstMain = updated.data[0];
  const firstMainId = firstMain.id || uuidv4();
  if (!firstMain.id) {
    firstMain.id = firstMainId;
  }

  // ✅ Inizializza steps a root level (non più in data[0])
  if (!updated.steps) {
    updated.steps = {};
  }
  if (!updated.steps[firstMainId]) {
    updated.steps[firstMainId] = {};
  }

  // Helper per creare una escalation con un messaggio
  const createEscalation = (text: string): any => {
    const taskId = uuidv4();
    const templateId = 'sayMessage';
    const taskType = templateIdToTaskType(templateId) || TaskType.SayMessage;
    return {
      escalationId: uuidv4(),
      tasks: [  // ✅ New field
        {
          type: taskType, // ✅ Aggiunto campo type (enum numerico)
          templateId: templateId,  // ✅ Renamed from actionId
          taskId: taskId,            // ✅ Renamed from actionInstanceId
          parameters: [
          {
            parameterId: 'text',
            value: text, // Direct text value (no textKey per semplicità iniziale)
          },
        ],
      }
      ],
      actions: [  // ✅ Legacy alias for backward compatibility
        {
          actionId: 'sayMessage',
          actionInstanceId: taskId,
          parameters: [
            {
              parameterId: 'text',
              value: text
            }
          ]
        }
      ]
    };
  };

  // Helper per creare uno step con escalations
  const createStep = (type: string, messageList: string[]): any => ({
    type,
    escalations: messageList.map(msg => createEscalation(msg)),
  });

  // ✅ Crea steps a root level (non più in data[0].steps)
  if (messages.start && messages.start.length > 0) {
    updated.steps[firstMainId].start = createStep('start', messages.start);
  }

  if (messages.noInput && messages.noInput.length > 0) {
    updated.steps[firstMainId].noInput = createStep('noInput', messages.noInput);
  }

  if (messages.noMatch && messages.noMatch.length > 0) {
    updated.steps[firstMainId].noMatch = createStep('noMatch', messages.noMatch);
  }

  if (messages.confirmation && messages.confirmation.length > 0) {
    updated.steps[firstMainId].confirmation = createStep('confirmation', messages.confirmation);
  }

  return updated;
}

