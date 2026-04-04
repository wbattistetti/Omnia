import { TaskType } from '@types/taskTypes';
import { makeTranslationKey } from '@utils/translationKeys';

/** Built-in Message template ids (palette / escalation). */
export function isMessageSemanticTemplateId(templateId: string | null | undefined): boolean {
  if (templateId == null) return false;
  const s = String(templateId).toLowerCase();
  return s === 'saymessage' || s === 'message';
}

export function isMessageLikeEscalationTask(task: { type?: number; templateId?: string | null }): boolean {
  if (task.type === TaskType.SayMessage) return true;
  return isMessageSemanticTemplateId(task.templateId);
}

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

  const isMessageKind =
    task.type === TaskType.SayMessage || isMessageSemanticTemplateId(templateId);

  const baseParams = Array.isArray(task.parameters) ? [...task.parameters] : [];
  const hasTextParam = baseParams.some((p: any) => p?.parameterId === 'text');
  const parameters =
    isMessageKind && !hasTextParam
      ? [...baseParams, { parameterId: 'text', value: makeTranslationKey('task', generateGuidFn()) }]
      : baseParams;

  return {
    id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,  // ✅ Standard: id (GUID univoco)
    type: task.type,  // ✅ NO FALLBACK - must be present
    templateId,  // ✅ NO FALLBACK - must be present (can be null)
    parameters,
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
