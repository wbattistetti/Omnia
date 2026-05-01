/**
 * Collega una voce manuale del catalogo a un {@link Task} Backend Call sul grafo.
 * La risoluzione primaria usa lo stesso merge di {@link rebuildCatalog} del pannello catalogo.
 */

import { TaskType, type Task } from '../../types/taskTypes';
import type { ManualCatalogEntry } from './catalogTypes';
import { canonicalKey } from './canonicalKey';
import { deriveBackendRefsFromTasks } from './deriveFromTasks';
import { rebuildCatalog } from './rebuildCatalog';

/**
 * Se la voce manuale è sulla stessa riga aggregata di un binding `graph`, restituisce quel task.
 * Allineato a `buildProjectBackendCatalogView` / «Dal grafo e dagli agent».
 */
export function findGraphBackendTaskForManualCatalogEntry(
  tasks: readonly Task[],
  allManualEntries: readonly ManualCatalogEntry[],
  entryId: string
): Task | null {
  const derived = deriveBackendRefsFromTasks([...tasks]);
  const { rows } = rebuildCatalog({
    derived,
    manualEntries: [...allManualEntries],
  });
  const row = rows.find((r) =>
    r.bindings.some((b) => b.source === 'manual' && b.manualEntryId === entryId)
  );
  const graphBinding = row?.bindings.find((b) => b.source === 'graph' && b.taskId);
  if (!graphBinding?.taskId) return null;
  return tasks.find((t) => t.id === graphBinding.taskId) ?? null;
}

/**
 * Fallback: stessa chiave canonica tra voce manuale e task (senza passare dal merge righe).
 */
export function findBackendCallTaskForManualCatalogEntry(
  tasks: readonly Task[],
  entry: ManualCatalogEntry
): Task | null {
  const url = entry.endpointUrl?.trim();
  if (!url) return null;
  const entryKey = canonicalKey({
    method: entry.method || 'GET',
    endpointUrl: entry.endpointUrl,
    operationId: entry.operationId,
  });
  for (const task of tasks) {
    if (task.type !== TaskType.BackendCall) continue;
    const ep = (task as Task & { endpoint?: { url?: string; method?: string } }).endpoint;
    const taskKey = canonicalKey({
      method: ep?.method || 'GET',
      endpointUrl: ep?.url || '',
      operationId: undefined,
    });
    if (taskKey === entryKey) return task;
  }
  /** Se la voce ha `operationId` opzionale che il task non ha, riprova senza operationId sulla voce. */
  if (entry.operationId?.trim()) {
    const entryKeyNoOp = canonicalKey({
      method: entry.method || 'GET',
      endpointUrl: entry.endpointUrl,
      operationId: undefined,
    });
    for (const task of tasks) {
      if (task.type !== TaskType.BackendCall) continue;
      const ep = (task as Task & { endpoint?: { url?: string; method?: string } }).endpoint;
      const taskKey = canonicalKey({
        method: ep?.method || 'GET',
        endpointUrl: ep?.url || '',
        operationId: undefined,
      });
      if (taskKey === entryKeyNoOp) return task;
    }
  }
  return null;
}
