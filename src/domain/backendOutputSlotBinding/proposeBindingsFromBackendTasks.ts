/**
 * Propone righe `BackendOutputSlotBinding` dai task Backend Call collegati (euristica RECEIVE).
 */

import type { Task } from '@types/taskTypes';
import { TaskType } from '@types/taskTypes';
import type { AgentBackendOutputSlotBindings, BackendOutputSlotBindingRow } from './types';
import { inferFormatForSlotId, inferSlotIdFromApiPath } from './inferSlotIdFromApiPath';
import { syncSlotContractsFromRows } from './slotBackendContract';

/** Path RECEIVE unici dai backend collegati (per prompt IA compile). */
export function collectReceiveApiPathsFromBackendTasks(
  backendTaskIds: readonly string[],
  getTask: (taskId: string) => Task | null | undefined
): string[] {
  const paths = new Set<string>();
  for (const backendTaskId of backendTaskIds) {
    const task = getTask(backendTaskId);
    if (!task || task.type !== TaskType.BackendCall) continue;
    for (const { apiPath } of collectReceivePaths(task)) {
      paths.add(apiPath);
    }
  }
  return [...paths].sort();
}

function collectReceivePaths(task: Task): Array<{ apiPath: string }> {
  const outputs = Array.isArray((task as Task & { outputs?: unknown[] }).outputs)
    ? (task as Task & { outputs: Array<{ apiField?: string }> }).outputs
    : [];
  const out: Array<{ apiPath: string }> = [];
  for (const row of outputs) {
    const apiPath = String(row.apiField ?? '').trim();
    if (!apiPath) continue;
    out.push({ apiPath });
  }
  return out;
}

function rowKey(backendTaskId: string, apiPath: string): string {
  return `${backendTaskId}::${apiPath}`;
}

/**
 * Merge proposta euristica con binding esistenti: righe `approved` restano; nuovi path aggiunti.
 */
export function proposeBindingsFromBackendTasks(
  backendTaskIds: readonly string[],
  getTask: (taskId: string) => Task | null | undefined,
  existing: AgentBackendOutputSlotBindings
): AgentBackendOutputSlotBindings {
  const kept = new Map<string, BackendOutputSlotBindingRow>();
  for (const row of existing.rows) {
    kept.set(rowKey(row.backendTaskId, row.apiPath), row);
  }

  const proposed: BackendOutputSlotBindingRow[] = [];
  const ids = [...new Set(backendTaskIds.map((x) => String(x ?? '').trim()).filter(Boolean))];

  for (const backendTaskId of ids) {
    const task = getTask(backendTaskId);
    if (!task || task.type !== TaskType.BackendCall) continue;
    for (const { apiPath } of collectReceivePaths(task)) {
      const key = rowKey(backendTaskId, apiPath);
      const prev = kept.get(key);
      if (prev?.approved) {
        proposed.push(prev);
        continue;
      }
      const slotId = inferSlotIdFromApiPath(apiPath);
      if (!slotId) continue;
      const format = inferFormatForSlotId(slotId);
      const tokenInPhrase = slotId;
      proposed.push({
        backendTaskId,
        apiPath,
        slotId,
        tokenInPhrase,
        ...(format ? { format } : {}),
        approved: prev?.approved,
      });
    }
  }

  const next: AgentBackendOutputSlotBindings = {
    schemaVersion: existing.schemaVersion,
    rows: proposed,
    slotContracts: existing.slotContracts ?? [],
    ...(existing.sourceFingerprint ? { sourceFingerprint: existing.sourceFingerprint } : {}),
  };
  return {
    ...next,
    slotContracts: syncSlotContractsFromRows(next, getTask),
  };
}
