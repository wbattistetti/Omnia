/**
 * Decides when the editor should persist TaskTree main nodes into Task.subTasks
 * (embedded row, no catalogue templateId), so MaterializationOrchestrator can reload without template materialization.
 */

import type { Task, TaskTree, TaskTreeNode } from '@types/taskTypes';
import { TaskType, TemplateSource } from '@types/taskTypes';
import { getTemplateId } from '@utils/taskHelpers';
import { inferTaskKind } from '@utils/taskKind';
import { getMainNodes } from '@responseEditor/core/domain';

const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isGuidTemplateBinding(templateId: string | null): boolean {
  return typeof templateId === 'string' && GUID_RE.test(templateId.trim());
}

/**
 * Returns true when the current task row should store a standalone structure snapshot
 * from the live TaskTree (main nodes only).
 */
export function shouldPersistStandaloneInstanceSnapshot(task: Task, taskTree: TaskTree): boolean {
  const main = getMainNodes(taskTree);
  if (main.length === 0) {
    return false;
  }

  if (task.source === TemplateSource.Factory) {
    return false;
  }

  // Single-flow utterance rows: node-level state (dataContract, grammarflow, tester columns, etc.)
  // must round-trip on save. Do this before inferTaskKind / GUID heuristics:
  // - Catalogue templateIds are often UUIDs (was blocked by isGuidTemplateBinding).
  // - Semantic ids like "UtteranceInterpretation" infer as 'instance', which previously skipped
  //   the snapshot before the Utterance branch could run.
  if (
    task.type === TaskType.UtteranceInterpretation &&
    !(task.subTasksIds && task.subTasksIds.length > 0)
  ) {
    return true;
  }

  const tid = getTemplateId(task);
  if (isGuidTemplateBinding(tid)) {
    return false;
  }

  const inferred = inferTaskKind(task);

  if (inferred === 'embedded') {
    return true;
  }

  if (inferred === 'instance' || inferred === 'factoryTemplate') {
    return false;
  }

  return false;
}

/**
 * Deep-clones main nodes for persistence (no shared references with the editor tree).
 */
export function cloneMainNodesForInstancePersistence(taskTree: TaskTree): TaskTreeNode[] {
  const main = getMainNodes(taskTree);
  try {
    if (typeof structuredClone === 'function') {
      return structuredClone(main) as TaskTreeNode[];
    }
  } catch {
    /* fall through */
  }
  return JSON.parse(JSON.stringify(main)) as TaskTreeNode[];
}
