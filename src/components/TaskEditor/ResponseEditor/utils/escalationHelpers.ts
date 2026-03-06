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

  // ✅ FASE 3: Rimuovere fallback task.text - il task deve contenere solo GUID
  // ❌ RIMOSSO: Se ha text diretto, usalo
  // Il modello corretto è: task contiene solo GUID, traduzione in translations

  // Cerca textKey nei parameters
  const textKeyParam = task.parameters?.find((p: any) => p?.parameterId === 'text');
  const textKey = textKeyParam?.value;

  if (textKey && typeof textKey === 'string') {
    // Se è un GUID valido, cerca la traduzione
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(textKey)) {
      const translation = translations[textKey];

      // ✅ Log sempre quando la traduzione NON viene trovata (utile per debug)
      if (!translation) {
        // ✅ Verifica se il GUID è nei sub-nodi (non adattati) - questi dovrebbero avere traduzioni copiate dal template
        const isSubNode = task.templateId === 'sayMessage' && task.id !== textKey;

        // ✅ DEBUG: Verifica se il GUID è nel context globale
        const globalContext = typeof window !== 'undefined' ? (window as any).__projectTranslationsContext : null;
        const isInGlobalContext = globalContext?.translations?.[textKey] ? true : false;
        const globalContextText = globalContext?.translations?.[textKey] || null;

        console.warn('[getTaskText] ⚠️ GUID found but translation missing', {
          textKey,
          translationsCount: Object.keys(translations).length,
          taskId: task.id,
          templateId: task.templateId,
          isSubNode,
          availableGuids: Object.keys(translations).slice(0, 10), // Mostra primi 10 GUID disponibili
          isGUIDInTranslations: textKey in translations,
          // ✅ DEBUG: Verifica se il GUID è stato generato durante clonazione
          guidFormat: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(textKey) ? 'valid-uuid' : 'invalid',
          // ✅ DEBUG: Verifica se il GUID è nel context globale
          isInGlobalContext,
          globalContextTextPreview: globalContextText ? globalContextText.substring(0, 50) + '...' : null,
          globalContextCount: globalContext?.translations ? Object.keys(globalContext.translations).length : 0
        });
      }
      // ✅ Log rimosso: troppo verboso, intasa la console
      // Se serve debug, usare localStorage.setItem('debug.getTaskText', '1')

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
    // ❌ RIMOSSO: text: task.text - il task deve contenere solo GUID nei parameters
    // Il modello corretto è: task contiene solo GUID, traduzione in translations[textKey]
    color: task.color,
    label: task.label,
    // ✅ NO FALLBACKS: Use iconName as primary, icon as fallback (both are valid properties)
    iconName: task.iconName ?? task.icon ?? 'FileText'
  };
}

/**
 * Genera il nome personalizzato dell'escalation
 */
export function getEscalationName(stepLabel: string, escalationIdx: number): string {
  return `${stepLabel} ${escalationIdx + 1}`;
}
