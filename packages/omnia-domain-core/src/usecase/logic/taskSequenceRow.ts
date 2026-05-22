/**
 * Minimal task-sequence row shape and helpers (no ResponseEditor dependency).
 */

import { TaskType } from '@types/taskTypes';

export type TaskSequenceRow = {
  id?: string;
  type: number;
  templateId: string | null;
  parameters?: { parameterId: string; value: unknown }[];
  color?: string;
  label?: string;
  iconName?: string;
};

function isMessageSemanticTemplateId(templateId: string | null | undefined): boolean {
  if (templateId == null) return false;
  const s = String(templateId).toLowerCase();
  return s === 'saymessage' || s === 'message';
}

export function isMessageLikeEscalationTask(task: {
  type?: number;
  templateId?: string | null;
}): boolean {
  if (task.type === TaskType.SayMessage) return true;
  return isMessageSemanticTemplateId(task.templateId);
}

export function getParameterValue(task: unknown, parameterId: string): unknown {
  const params = (task as { parameters?: { parameterId?: string; value?: unknown }[] })
    ?.parameters;
  if (!Array.isArray(params)) return undefined;
  return params.find((p) => p?.parameterId === parameterId)?.value;
}

export function getScalarParameterValue(task: unknown, parameterId: string): string {
  const v = getParameterValue(task, parameterId);
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return '';
}
