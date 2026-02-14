import { v4 as uuidv4 } from 'uuid';
import type { IntentMessages } from '@responseEditor/components/IntentMessagesBuilder';
import { TaskType, templateIdToTaskType } from '@types/taskTypes';

/**
 * Converte IntentMessages in formato TaskTree steps e li salva nel TaskTree
 * ✅ AGGIORNATO: Usa steps a root level (non più nodes[0].steps)
 * ✅ AGGIORNATO: Non crea più kind: 'intent' - tutto è DataRequest
 * ✅ FASE 1.1: Genera GUID e salva traduzioni invece di usare testo letterale
 */
export function saveIntentMessagesToTaskTree(
  taskTree: any,
  messages: IntentMessages,
  addTranslation?: (guid: string, text: string) => void
): any {
  if (!taskTree || !messages) {
    console.warn('[saveIntentMessagesToTaskTree] Missing taskTree or messages');
    return taskTree;
  }

  // ✅ Get addTranslation from context if not provided
  const addTranslationFn = addTranslation || (() => {
    // Fallback: use window context if available
    if (typeof window !== 'undefined' && (window as any).__projectTranslationsContext) {
      const ctx = (window as any).__projectTranslationsContext;
      if (ctx.addTranslation) {
        return ctx.addTranslation;
      } else if (ctx.addTranslations) {
        return (guid: string, text: string) => ctx.addTranslations({ [guid]: text });
      }
    }
    return (guid: string, text: string) => {
      console.warn('[saveIntentMessagesToTaskTree] ⚠️ No translation context available, translation not saved:', { guid, text: text.substring(0, 50) });
    };
  })();

  // Crea una copia del TaskTree
  const updated = JSON.parse(JSON.stringify(taskTree));

  // ✅ Assicurati che nodes[0] esista (per struttura dati)
  if (!Array.isArray(updated.nodes) || updated.nodes.length === 0) {
    const firstMainId = uuidv4();
    updated.nodes = [{
      id: firstMainId,
      templateId: firstMainId,
      label: updated.label || 'Data',
      type: 'text', // Default type
      subNodes: []
    }];
  }

  const firstMain = updated.nodes[0];
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

  // ✅ FASE 1.1: Helper per creare una escalation con un messaggio (GUID → traduzione)
  const createEscalation = (text: string): any => {
    // ✅ STEP 1: Genera GUID per la chiave di traduzione
    const textKey = uuidv4();
    const taskId = uuidv4();
    const templateId = 'sayMessage';

    // ✅ STEP 2: Salva traduzione
    if (addTranslationFn && typeof addTranslationFn === 'function') {
      addTranslationFn(textKey, text);
    }

    // ✅ STEP 3: Determina taskType
    const taskType = templateIdToTaskType(templateId);
    if (taskType === TaskType.UNDEFINED) {
      throw new Error(`[saveIntentMessagesToTaskTree] Cannot determine task type from templateId '${templateId}'. This is a bug in task creation.`);
    }

    return {
      escalationId: uuidv4(),
      tasks: [
        {
          id: taskId,                 // ✅ Standard: id (GUID univoco)
          type: taskType,             // ✅ NO FALLBACK - must be present
          templateId: templateId,     // ✅ NO FALLBACK - must be present
          parameters: [
            {
              parameterId: 'text',
              value: textKey, // ✅ GUID invece di testo letterale
            },
          ],
        }
      ]
      // ❌ RIMOSSO: actions - legacy field, non più necessario
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

