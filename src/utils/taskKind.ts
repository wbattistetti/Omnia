/**
 * Task row role inference for gradual migration (read-only helpers).
 * See docs/task-model-migration-step1-spec.md.
 */

import type { Task, TaskKind } from '@types/taskTypes';
import { TemplateSource } from '@types/taskTypes';

const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isGuid(value: string | null | undefined): boolean {
  return typeof value === 'string' && GUID_RE.test(value.trim());
}

/**
 * Infers TaskKind from persisted fields. Does not mutate. Safe for legacy rows without `kind`.
 */
export function inferTaskKind(task: Task | null | undefined): TaskKind {
  if (!task) {
    return 'instance';
  }

  if (task.kind) {
    return task.kind;
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

  if (tid === null || tid === undefined) {
    if (task.instanceNodes && task.instanceNodes.length > 0) {
      return 'standalone';
    }
    return 'projectTemplate';
  }

  return 'instance';
}

/**
 * True when the task references a persisted template row (non-sentinel id).
 * Used for materialization and save paths; null / UNDEFINED / empty → standalone shell.
 */
export function hasValidTemplateIdRef(task: Task | null | undefined): boolean {
  if (!task) return false;
  const tid = task.templateId;
  return tid != null && tid !== 'UNDEFINED' && String(tid).trim() !== '';
}

/** True when the task row represents a standalone instance (local schema). */
export function isStandalone(task: Task | null | undefined): boolean {
  return inferTaskKind(task) === 'standalone';
}

/** True when standalone fields that define structure are present. */
export function hasLocalSchema(task: Task | null | undefined): boolean {
  if (!task) return false;
  const nodes = task.instanceNodes;
  return Array.isArray(nodes) && nodes.length > 0;
}

/** Short English label for header/tooltips (UI). */
export function taskKindLabel(kind: TaskKind): string {
  switch (kind) {
    case 'standalone':
      return 'Standalone';
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
