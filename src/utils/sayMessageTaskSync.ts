/**
 * Sync helpers for SayMessage tasks: body lives in ProjectTranslations (canonical `task:<uuid>` key)
 * under task.parameters (parameterId === 'text'). No task.text.
 */

import { generateSafeGuid } from '@utils/idGenerator';
import type { Task } from '@types/taskTypes';
import { TaskType } from '@types/taskTypes';
import { taskRepository } from '@services/TaskRepository';
import { getProjectTranslationsTable } from '@utils/projectTranslationsRegistry';
import { isCanonicalTranslationKey, isUuidString, makeTranslationKey, parseTranslationKey } from './translationKeys';

function isTaskTranslationStorageKey(s: string): boolean {
  return parseTranslationKey(s)?.kind === 'task';
}

/** Writes plaintext into project translations for the given key (when context is mounted). */
export function trySeedSayMessageTranslation(textKey: string, plaintext: string): void {
  if (plaintext == null || plaintext === '') return;
  if (typeof window === 'undefined') return;
  const ctx = (window as unknown as { __projectTranslationsContext?: { addTranslation?: (g: string, t: string) => void } })
    .__projectTranslationsContext;
  ctx?.addTranslation?.(textKey, plaintext);
}

/** Resolves text from the same merged map as TaskContentResolver and flowchart "has content" checks. */
function readSayMessageTranslation(textKey: string): string {
  if (!textKey) return '';
  const map = getProjectTranslationsTable();
  if (map && typeof map[textKey] === 'string') return map[textKey];
  return '';
}

/**
 * Resolved message body: translation by canonical key from merged project registry; legacy `runtime.*` keys;
 * non-key strings treated as inline literal only when not a bare UUID.
 */
export function getSayMessageSyncedBody(task: Task | null | undefined): string {
  if (!task || task.type !== TaskType.SayMessage) return '';
  const params = (task as Task & { parameters?: Array<{ parameterId?: string; value?: string }> }).parameters;
  const param = params?.find((p) => p?.parameterId === 'text');
  const key = typeof param?.value === 'string' ? param.value.trim() : '';
  if (!key) return '';
  if (isUuidString(key)) return '';
  const fromStore = readSayMessageTranslation(key);
  if (fromStore) return fromStore;
  if (isCanonicalTranslationKey(key) || key.startsWith('runtime.')) return '';
  return key;
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

  if (!textKey || !isTaskTranslationStorageKey(textKey)) {
    textKey =
      textKey && isUuidString(textKey) ? makeTranslationKey('task', textKey) : makeTranslationKey('task', generateSafeGuid());
    const next = (prevParams as any[]).filter((p) => p?.parameterId !== 'text');
    next.push({ parameterId: 'text', value: textKey });
    taskRepository.updateTask(taskId, { parameters: next } as Partial<Task>, projectId);
  }

  trySeedSayMessageTranslation(textKey, plainText);
}
