/**
 * Task row inference: behaviour is driven only by templateId (null vs set) and structure
 * (subTasks, subTasksIds, source). No persisted "kind" flag.
 */

import type { Task, TaskKind } from '@types/taskTypes';
import { TemplateSource } from '@types/taskTypes';

const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isGuid(value: string | null | undefined): boolean {
  return typeof value === 'string' && GUID_RE.test(value.trim());
}

/**
 * Infers a display role from persisted fields only (templateId + graph). Does not read legacy `kind`.
 */
export function inferTaskKind(task: Task | null | undefined): TaskKind {
  if (!task) {
    return 'instance';
  }

  const tid = task.templateId;

  if (tid && tid !== 'UNDEFINED' && isGuid(String(tid))) {
    return 'instance';
  }

  if (task.source === TemplateSource.Factory) {
    return 'factoryTemplate';
  }

  if (task.subTasksIds && task.subTasksIds.length > 0) {
    return 'projectTemplate';
  }

  if (tid === null || tid === undefined || String(tid).trim() === '') {
    if (task.subTasks && task.subTasks.length > 0) {
      return 'embedded';
    }
    return 'projectTemplate';
  }

  return 'instance';
}

/**
 * True when the task references a persisted template row (non-sentinel id).
 */
export function hasValidTemplateIdRef(task: Task | null | undefined): boolean {
  if (!task) return false;
  const tid = task.templateId;
  return tid != null && tid !== 'UNDEFINED' && String(tid).trim() !== '';
}

/** @deprecated Use inferTaskKind === 'embedded' */
export function isStandalone(task: Task | null | undefined): boolean {
  return inferTaskKind(task) === 'embedded';
}

/**
 * True when the row holds a full Utterance graph on the task document (no catalogue templateId).
 */
export function isStandaloneMaterializedTaskRow(task: Task | null | undefined): boolean {
  return !hasValidTemplateIdRef(task) && hasLocalSchema(task);
}

/**
 * True when contract/steps for the row should resolve from embedded subTasks / node dataContract
 * rather than from the task row's templateId catalogue entry.
 */
export function taskRowUsesSubTasksContract(task: Task | null | undefined): boolean {
  if (!task) {
    return false;
  }
  return !hasValidTemplateIdRef(task);
}

/** True when persisted subTasks defines structure. */
export function hasLocalSchema(task: Task | null | undefined): boolean {
  if (!task) return false;
  const nodes = task.subTasks;
  return Array.isArray(nodes) && nodes.length > 0;
}

/** Short English label for header/tooltips (UI). */
export function taskKindLabel(kind: TaskKind): string {
  switch (kind) {
    case 'embedded':
      return 'Embedded';
    case 'instance':
      return 'Instance';
    case 'projectTemplate':
      return 'Project template';
    case 'factoryTemplate':
      return 'Factory template';
    default:
      return String(kind);
  }
}
