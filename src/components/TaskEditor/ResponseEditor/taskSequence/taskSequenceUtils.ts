/**
 * Pure helpers for TaskSequenceEditor: palette filter, focus targets, incoming task normalization.
 */

import {
  generateGuid,
  isMessageLikeEscalationTask,
  normalizeTaskForEscalation,
} from '@responseEditor/utils/escalationHelpers';
import { TaskType, templateIdToTaskType } from '@types/taskTypes';

export function matchesAllowedTemplateId(
  templateId: string | null | undefined,
  allowed: readonly string[]
): boolean {
  const t = String(templateId ?? '').toLowerCase();
  return allowed.some((a) => String(a).toLowerCase() === t);
}

/** First parameter to auto-focus after drop/append. */
export function firstFocusParameterId(task: unknown): string | null {
  if (isMessageLikeEscalationTask(task as Parameters<typeof isMessageLikeEscalationTask>[0])) {
    return 'text';
  }
  const params = (task as { parameters?: { parameterId?: string }[] })?.parameters;
  if (Array.isArray(params) && params.some((p) => p?.parameterId === 'smsText')) {
    return 'smsText';
  }
  return null;
}

/**
 * Normalizes a palette drop / append payload into an escalation task row.
 */
export function normalizeIncomingPaletteTask(incoming: unknown): ReturnType<typeof normalizeTaskForEscalation> {
  const raw = (incoming as { task?: unknown })?.task ?? incoming;
  const task = raw as Record<string, unknown>;

  const templateId =
    task?.templateId !== undefined ? task.templateId : (task?.id ?? null);

  let taskType: number | null =
    task?.type !== undefined && task?.type !== null ? (task.type as number) : null;
  if (taskType === null && templateId != null) {
    const inferred = templateIdToTaskType(String(templateId));
    if (inferred !== TaskType.UNDEFINED) {
      taskType = inferred;
    }
  }
  if (taskType === undefined || taskType === null) {
    throw new Error(
      `[normalizeIncomingPaletteTask] Task is missing required field "type": ${JSON.stringify(task).slice(0, 200)}`
    );
  }

  return normalizeTaskForEscalation(
    {
      ...task,
      type: taskType,
      templateId,
    },
    generateGuid
  );
}

export function reorderTasksInList<T>(
  tasks: readonly T[],
  fromIdx: number,
  toIdx: number,
  position: 'before' | 'after'
): T[] {
  const next = [...tasks];
  const moved = next[fromIdx];
  if (moved === undefined) return next;
  next.splice(fromIdx, 1);
  const insertIdx = position === 'after' ? toIdx + 1 : toIdx;
  const adjustedInsert = fromIdx < insertIdx ? insertIdx - 1 : insertIdx;
  next.splice(adjustedInsert, 0, moved);
  return next;
}
