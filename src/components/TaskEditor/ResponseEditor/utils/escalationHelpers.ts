import { getTaskLabel } from '@responseEditor/taskMeta';

/**
 * Genera un GUID valido
 */
export function generateGuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Ottiene il testo di una task da visualizzare
 */
export function getTaskText(
  task: any,
  translations: Record<string, string>
): string {
  // 🔍 DEBUG: Log per capire cosa succede
  const debugEnabled = typeof localStorage !== 'undefined' && localStorage.getItem('debug.getTaskText') === '1';

  // Se ha text diretto, usalo
  if (task.text && typeof task.text === 'string' && task.text.trim().length > 0) {
    return task.text;
  }

  // Altrimenti cerca textKey nei parameters
  const textKeyParam = task.parameters?.find((p: any) => p?.parameterId === 'text');
  const textKey = textKeyParam?.value;

  if (textKey && typeof textKey === 'string') {
    // Se è un GUID valido, cerca la traduzione
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(textKey)) {
      const translation = translations[textKey];

      // ❌ RIMOSSO: log verboso quando la traduzione viene trovata (non necessario)
      // ✅ MANTENUTO: log solo quando la traduzione NON viene trovata (utile per debug)
      if (debugEnabled && !translation) {
        console.warn('[getTaskText] ⚠️ GUID found but translation missing', {
          textKey,
          translationsCount: Object.keys(translations).length,
          taskId: task.id,
          templateId: task.templateId
        });
      }

      // ✅ Se la traduzione esiste, usala; altrimenti usa il label del template come fallback
      if (translation) {
        return translation;
      }
      // ✅ Fallback: usa il label del template invece del GUID
      if (task.templateId && task.templateId !== 'sayMessage') {
        const label = getTaskLabel(task.templateId);
        if (label && label !== task.templateId) {
          return label;
        }
      }
      // ✅ Se è sayMessage senza traduzione, mostra il GUID (è normale per sayMessage)
      // ✅ Altrimenti, se non abbiamo trovato il label, prova a usare task.label se presente
      if (task.label && typeof task.label === 'string' && task.label.trim().length > 0) {
        return task.label;
      }
      return textKey;
    }
    // Altrimenti usa direttamente il textKey (non è un GUID)
    return textKey;
  }

  // Se non ha text e non è sayMessage, usa il label del template
  if (task.templateId && task.templateId !== 'sayMessage') {
    const label = getTaskLabel(task.templateId);
    if (label && label !== task.templateId) {
      return label;
    }
    // Fallback a task.label se presente
    if (task.label && typeof task.label === 'string' && task.label.trim().length > 0) {
      return task.label;
    }
  }

  // Ultimo fallback: usa task.label se presente
  if (task.label && typeof task.label === 'string' && task.label.trim().length > 0) {
    return task.label;
  }

  return '';
}

/**
 * Normalizza una task per l'inserimento in escalation
 */
export function normalizeTaskForEscalation(
  task: any,
  generateGuidFn: () => string = generateGuid
): any {
  // ✅ CRITICAL: NO FALLBACK - type and templateId MUST be present
  if (task?.type === undefined || task?.type === null) {
    throw new Error(`[normalizeTaskForEscalation] Task is missing required field 'type'. Task: ${JSON.stringify(task, null, 2)}`);
  }

  if (task?.templateId === undefined) {
    // templateId can be null (standalone task), but must be explicitly set
    throw new Error(`[normalizeTaskForEscalation] Task is missing required field 'templateId' (must be explicitly null for standalone tasks). Task: ${JSON.stringify(task, null, 2)}`);
  }

  const templateId = task.templateId; // ✅ NO FALLBACK - must be present (can be null)

  return {
    id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,  // ✅ Standard: id (GUID univoco)
    type: task.type,  // ✅ NO FALLBACK - must be present
    templateId,  // ✅ NO FALLBACK - must be present (can be null)
    parameters: templateId === 'sayMessage' || templateId === null
      ? [{ parameterId: 'text', value: generateGuidFn() }]
      : (task.parameters || []),
    text: task.text,
    color: task.color,
    label: task.label,
    iconName: task.icon || task.iconName || task.icon
  };
}

/**
 * Genera il nome personalizzato dell'escalation
 */
export function getEscalationName(stepLabel: string, escalationIdx: number): string {
  return `${stepLabel} ${escalationIdx + 1}`;
}
