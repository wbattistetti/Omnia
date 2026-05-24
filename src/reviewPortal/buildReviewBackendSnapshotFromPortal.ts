/**
 * Builds {@link AgentReviewBackendSnapshot} from portal ProjectData backend catalog edits.
 * Preserves graph/tools rows from the previous published snapshot.
 */

import type { BackendPlaceholderInstance } from '@domain/agentPrompt';
import type { ManualCatalogEntry } from '@domain/backendCatalog/catalogTypes';
import { buildProjectBackendCatalogView } from '@domain/backendCatalog';
import type {
  AgentReviewBackendRowSnapshot,
  AgentReviewBackendSnapshot,
  AgentReviewManualBackendEntrySnapshot,
} from '@domain/agentReviewChannel/reviewSnapshots';
import { taskRepository } from '@services/TaskRepository';
import { TaskType, type Task } from '@types/taskTypes';
import {
  backendCallTaskWireFromTask,
  openApiFieldNamesFromTask,
} from './reviewBackendCallTaskWire';

function manualEntryToSnapshot(e: ManualCatalogEntry): AgentReviewManualBackendEntrySnapshot {
  const liveTask = taskRepository.getTask(e.id);
  const taskWire = backendCallTaskWireFromTask(liveTask);
  const openApiFieldNames = e.openApiFieldNames ?? openApiFieldNamesFromTask(liveTask);
  return {
    id: e.id,
    label: e.label,
    method: e.method,
    endpointUrl: e.endpointUrl,
    ...(e.operationId ? { operationId: e.operationId } : {}),
    ...(e.notes ? { notes: e.notes } : {}),
    frozenMeta: { ...e.frozenMeta },
    lastStructuralEditAt: e.lastStructuralEditAt,
    ...(openApiFieldNames ? { openApiFieldNames } : {}),
    ...(e.portalConnectionId ? { portalConnectionId: e.portalConnectionId } : {}),
    ...(e.creationMode ? { creationMode: e.creationMode } : {}),
    ...(e.importSpecRevealed != null ? { importSpecRevealed: e.importSpecRevealed } : {}),
    ...(taskWire ? { taskWire } : {}),
  };
}

function tasksForCatalog(
  taskInstanceId: string,
  taskLabel: string,
  manualEntries: readonly ManualCatalogEntry[]
): Task[] {
  const agent: Task = {
    id: taskInstanceId,
    type: TaskType.AIAgent,
    label: taskLabel || 'Agente AI',
  } as Task;
  const backendTasks = manualEntries.map(
    (e) =>
      ({
        id: e.id,
        type: TaskType.BackendCall,
        label: e.label || e.endpointUrl || 'Backend',
        endpointUrl: e.endpointUrl,
        method: e.method ?? 'GET',
      }) as Task
  );
  return [agent, ...backendTasks];
}

function manualRowsFromCatalog(
  manualEntries: readonly ManualCatalogEntry[],
  taskInstanceId: string,
  taskLabel: string
): AgentReviewBackendRowSnapshot[] {
  const { rows } = buildProjectBackendCatalogView(
    tasksForCatalog(taskInstanceId, taskLabel, manualEntries),
    [...manualEntries]
  );
  return rows
    .filter((row) => row.sources.manual)
    .map((row) => ({
      key: row.key,
      label: row.label,
      method: row.method,
      pathnameDisplay: row.pathnameDisplay,
      sources: { ...row.sources },
      bindings: row.bindings
        .filter((b) => b.source === 'manual')
        .map((b) => ({
          bindingId: b.manualEntryId ?? b.bindingId.replace(/^manual:/, ''),
          source: 'manual' as const,
          method: b.method,
          endpointUrl: b.endpointUrl,
        })),
    }));
}

/** Snapshot for review channel save after designer edits backend catalog in the portal. */
export function buildReviewBackendSnapshotFromPortal(params: {
  taskInstanceId: string;
  taskLabel: string;
  manualEntries: readonly ManualCatalogEntry[];
  backendPlaceholders: readonly BackendPlaceholderInstance[];
  previousSnapshot: AgentReviewBackendSnapshot | null;
}): AgentReviewBackendSnapshot | null {
  const manualSnapshots = params.manualEntries.map(manualEntryToSnapshot);
  const derivedRows = (params.previousSnapshot?.catalogRows ?? []).filter(
    (row) => row.sources.graph || row.sources.tools
  );
  const manualRows = manualRowsFromCatalog(
    params.manualEntries,
    params.taskInstanceId,
    params.taskLabel
  );
  const structuredPlaceholders = params.backendPlaceholders
    .filter((p) => p.id.trim() && p.definitionId.trim())
    .map((p) => ({ id: p.id.trim(), definitionId: p.definitionId.trim() }));

  const catalogRows = [...derivedRows, ...manualRows];

  if (
    catalogRows.length === 0 &&
    structuredPlaceholders.length === 0 &&
    manualSnapshots.length === 0
  ) {
    return null;
  }

  return {
    catalogRows,
    structuredPlaceholders,
    ...(manualSnapshots.length > 0 ? { manualEntries: manualSnapshots } : {}),
  };
}
