/**
 * Pure helpers for TaskSequenceEditor: palette filter, focus targets, incoming task normalization.
 */

import {
  generateGuid,
  isMessageLikeEscalationTask,
  normalizeTaskForEscalation,
} from '@responseEditor/utils/escalationHelpers';
import { TaskType, templateIdToTaskType, taskTypeToTemplateId } from '@types/taskTypes';

/** Factory / Mongo template ids often end with `-template`; palette may omit `templateId`. */
const PALETTE_TEMPLATE_ALIASES: Record<string, string> = {
  readbackend: 'readFromBackend',
  readfrombackend: 'readFromBackend',
  writebackend: 'writeToBackend',
  writetobackend: 'writeToBackend',
  tohuman: 'escalateToHuman',
  escalatetohuman: 'escalateToHuman',
  waitagent: 'waitForAgent',
  waitforagent: 'waitForAgent',
  sendsms: 'sendSMS',
};

/**
 * Numeric types from `/api/factory/tasks` (VB escalation) — not always aligned with client `TaskType`.
 */
const FACTORY_ESCALATION_TYPE_TEMPLATE_ID: Record<number, string> = {
  6: 'sendSMS',
  8: 'escalateToHuman',
  10: 'readFromBackend',
  11: 'writeToBackend',
  19: 'waitForAgent',
};

function normalizeTemplateKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Canonical template id for allowlist checks (strips `-template`, aliases, factory type fallback).
 */
export function canonicalPaletteTemplateId(
  templateId: string | null | undefined,
  options?: { fallbackId?: string | null; taskType?: number | null }
): string {
  const stripSuffix = (raw: string): string => {
    const t = raw.trim();
    if (!t) return '';
    return t.replace(/-template$/i, '');
  };

  if (templateId != null && String(templateId).trim()) {
    const stripped = stripSuffix(String(templateId));
    const key = normalizeTemplateKey(stripped);
    return PALETTE_TEMPLATE_ALIASES[key] ?? stripped;
  }

  const fallback = options?.fallbackId != null ? stripSuffix(String(options.fallbackId)) : '';
  if (fallback) {
    const key = normalizeTemplateKey(fallback);
    if (PALETTE_TEMPLATE_ALIASES[key]) return PALETTE_TEMPLATE_ALIASES[key];
    if (!looksLikeTaskInstanceGuid(fallback)) {
      return fallback;
    }
  }

  const taskType = options?.taskType;
  if (typeof taskType === 'number' && !Number.isNaN(taskType)) {
    const factory = FACTORY_ESCALATION_TYPE_TEMPLATE_ID[taskType];
    if (factory) return factory;
    const fromClient = taskTypeToTemplateId(taskType as TaskType);
    if (fromClient) return fromClient;
  }

  return fallback;
}

function looksLikeTaskInstanceGuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

/** Coerce API / JSON task `type` (number or numeric string). */
export function coerceNumericTaskType(raw: unknown): number | null {
  if (typeof raw === 'number' && !Number.isNaN(raw)) return raw;
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

const FACTORY_TEMPLATE_TO_TYPE: Record<string, number> = {
  sendsms: 6,
  escalatetohuman: 8,
  readfrombackend: 10,
  writetobackend: 11,
  waitforagent: 19,
};

export function factoryTaskTypeFromTemplateId(templateId: string | null | undefined): number | null {
  const canonical = canonicalPaletteTemplateId(templateId);
  if (!canonical) return null;
  return FACTORY_TEMPLATE_TO_TYPE[normalizeTemplateKey(canonical)] ?? null;
}

/** Resolve template id from a palette drag item or post-`createTask` payload. */
export function resolveIncomingPaletteTemplateId(incoming: unknown): string {
  const envelope = incoming as { task?: Record<string, unknown> };
  const raw =
    envelope?.task && typeof envelope.task === 'object'
      ? envelope.task
      : (incoming as Record<string, unknown>);

  if (!raw || typeof raw !== 'object') return '';

  const templateId =
    raw.templateId !== undefined && raw.templateId !== null
      ? String(raw.templateId)
      : null;
  const id = raw.id !== undefined && raw.id !== null ? String(raw.id) : null;
  const taskType = coerceNumericTaskType(raw.type);

  return canonicalPaletteTemplateId(templateId, { fallbackId: id, taskType });
}

/** Messaggio quando il template non è nell'allowlist (sequenza generica / escalation). */
export const DROP_TEMPLATE_NOT_ALLOWED_MESSAGE =
  'Questa azione non è ammessa in questa sequenza: tipo di task non supportato.';

export function matchesAllowedTemplateId(
  templateId: string | null | undefined,
  allowed: readonly string[]
): boolean {
  const canonical = canonicalPaletteTemplateId(templateId);
  if (!canonical) return false;
  const t = canonical.toLowerCase();
  return allowed.some((a) => canonicalPaletteTemplateId(a).toLowerCase() === t);
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

  const templateId = resolveIncomingPaletteTemplateId(incoming) || null;

  let taskType: number | null = coerceNumericTaskType(task?.type);
  if (taskType === null && templateId != null) {
    taskType = factoryTaskTypeFromTemplateId(templateId);
  }
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
