/**
 * Sync helpers for SayMessage tasks: body lives in ProjectTranslations (by GUID)
 * under task.parameters (parameterId === 'text'). No task.text.
 */

import { v4 as uuidv4 } from 'uuid';
import type { Task } from '@types/taskTypes';
import { TaskType } from '@types/taskTypes';
import { taskRepository } from '@services/TaskRepository';

const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Writes plaintext into project translations for the given key (when context is mounted). */
export function trySeedSayMessageTranslation(textKey: string, plaintext: string): void {
  if (plaintext == null || plaintext === '') return;
  if (typeof window === 'undefined') return;
  const ctx = (window as unknown as { __projectTranslationsContext?: { addTranslation?: (g: string, t: string) => void } })
    .__projectTranslationsContext;
  ctx?.addTranslation?.(textKey, plaintext);
}

function readTranslationFromWindow(textKey: string): string {
  if (!textKey || typeof window === 'undefined') return '';
  const map = (window as unknown as { __projectTranslationsContext?: { translations?: Record<string, string> } })
    .__projectTranslationsContext?.translations;
  if (map && typeof map[textKey] === 'string') return map[textKey];
  return '';
}

/**
 * Resolved message body: translation by GUID from window context, else non-GUID param value as literal.
 */
export function getSayMessageSyncedBody(task: Task | null | undefined): string {
  if (!task || task.type !== TaskType.SayMessage) return '';
  const params = (task as Task & { parameters?: Array<{ parameterId?: string; value?: string }> }).parameters;
  const param = params?.find((p) => p?.parameterId === 'text');
  const key = typeof param?.value === 'string' ? param.value.trim() : '';
  if (!key) return '';
  const fromStore = readTranslationFromWindow(key);
  if (fromStore) return fromStore;
  if (!GUID_RE.test(key)) return key;
  return '';
}

/**
 * Ensures a GUID text parameter exists and stores plain label/body in translations.
 */
export function applySayMessagePlainTextToTask(taskId: string, plainText: string, projectId?: string): void {
  const task = taskRepository.getTask(taskId);
  if (!task || task.type !== TaskType.SayMessage) return;

  const prevParams = Array.isArray((task as Task & { parameters?: unknown[] }).parameters)
    ? [...((task as Task & { parameters: unknown[] }).parameters)]
    : [];
  const idx = prevParams.findIndex((p: any) => p?.parameterId === 'text');
  let textKey =
    idx >= 0 && typeof (prevParams[idx] as { value?: string })?.value === 'string'
      ? String((prevParams[idx] as { value: string }).value).trim()
      : '';

  if (!textKey || !GUID_RE.test(textKey)) {
    textKey = uuidv4();
    const next = (prevParams as any[]).filter((p) => p?.parameterId !== 'text');
    next.push({ parameterId: 'text', value: textKey });
    taskRepository.updateTask(taskId, { parameters: next } as Partial<Task>, projectId);
  }

  trySeedSayMessageTranslation(textKey, plainText);
}
