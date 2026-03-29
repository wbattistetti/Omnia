/**
 * Pure helpers for task parameter values and translation-backed strings.
 * No task.label fallback for translated content — missing translation => ''.
 */

import { getTaskLabel } from '@responseEditor/taskMeta';
import { isMessageLikeEscalationTask } from '@responseEditor/utils/escalationHelpers';

const GUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isGuid(value: unknown): value is string {
  return typeof value === 'string' && GUID_RE.test(value);
}

export function getParameterRecord(task: unknown, parameterId: string): { parameterId: string; value: unknown } | undefined {
  const params = (task as { parameters?: { parameterId?: string; value?: unknown }[] })?.parameters;
  if (!Array.isArray(params)) return undefined;
  return params.find((p) => p?.parameterId === parameterId) as { parameterId: string; value: unknown } | undefined;
}

export function getParameterValue(task: unknown, parameterId: string): unknown {
  return getParameterRecord(task, parameterId)?.value;
}

/** Returns translation store key (GUID) when the parameter value is a GUID; otherwise null. */
export function resolveTranslationKey(task: unknown, parameterId: string): string | null {
  const v = getParameterValue(task, parameterId);
  return isGuid(v) ? v : null;
}

export function getTranslatedParameterText(
  task: unknown,
  parameterId: string,
  translations: Record<string, string>
): string {
  const key = resolveTranslationKey(task, parameterId);
  if (!key) return '';
  return translations[key] ?? '';
}

export function getScalarParameterValue(task: unknown, parameterId: string): string {
  const v = getParameterValue(task, parameterId);
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return '';
}

export function getMessageText(task: unknown, translations: Record<string, string>): string {
  return getTranslatedParameterText(task, 'text', translations);
}

export function getSmsText(task: unknown, translations: Record<string, string>): string {
  return getTranslatedParameterText(task, 'smsText', translations);
}

/**
 * One-line preview for MessageReview / lists: message body or first translated param or template label.
 */
export function getEscalationTaskPreviewText(task: unknown, translations: Record<string, string>): string {
  if (isMessageLikeEscalationTask(task as Parameters<typeof isMessageLikeEscalationTask>[0])) {
    return getMessageText(task, translations);
  }
  const sms = getTranslatedParameterText(task, 'smsText', translations);
  if (sms) return sms;
  const tid = (task as { templateId?: string | null; id?: string })?.templateId ?? (task as { id?: string })?.id;
  return tid ? getTaskLabel(String(tid)) : '';
}
