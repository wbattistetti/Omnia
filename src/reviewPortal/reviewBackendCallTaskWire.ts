/**
 * Serialize / hydrate BackendCall task I/O for the review channel (portal ↔ Omnia).
 */

import type { AgentReviewBackendCallTaskWireSnapshot } from '@domain/agentReviewChannel/reviewSnapshots';
import type { ManualCatalogEntry } from '@domain/backendCatalog/catalogTypes';
import { TaskType, type Task } from '@types/taskTypes';

type BackendCallTask = Task & {
  inputs?: unknown[];
  outputs?: unknown[];
  backendCallSpecMeta?: Record<string, unknown>;
  backendToolDescription?: string;
  openapiSpecUrl?: string;
  endpoint?: { url?: string; method?: string; headers?: Record<string, string> };
};

function ioRowCount(rows: unknown): number {
  return Array.isArray(rows) ? rows.length : 0;
}

/** Extracts wire payload from a live BackendCall task (or undefined if empty). */
export function backendCallTaskWireFromTask(
  task: Task | null | undefined
): AgentReviewBackendCallTaskWireSnapshot | undefined {
  if (!task || task.type !== TaskType.BackendCall) return undefined;
  const t = task as BackendCallTask;
  const inputs = Array.isArray(t.inputs) ? t.inputs : [];
  const outputs = Array.isArray(t.outputs) ? t.outputs : [];
  const spec = t.backendCallSpecMeta;
  const toolDesc = String(t.backendToolDescription ?? '').trim();
  const specUrl = String(t.openapiSpecUrl ?? '').trim();
  const ep = t.endpoint;
  const endpoint =
    ep && typeof ep === 'object' && typeof ep.url === 'string'
      ? {
          url: ep.url.trim(),
          method: String(ep.method ?? 'GET').trim().toUpperCase(),
          ...(ep.headers && typeof ep.headers === 'object' ? { headers: ep.headers } : {}),
        }
      : undefined;

  if (
    inputs.length === 0 &&
    outputs.length === 0 &&
    !spec &&
    !toolDesc &&
    !specUrl &&
    !endpoint?.url
  ) {
    return undefined;
  }

  return {
    ...(inputs.length > 0 ? { inputs } : {}),
    ...(outputs.length > 0 ? { outputs } : {}),
    ...(spec ? { backendCallSpecMeta: spec } : {}),
    ...(toolDesc ? { backendToolDescription: toolDesc } : {}),
    ...(specUrl ? { openapiSpecUrl: specUrl } : {}),
    ...(endpoint?.url ? { endpoint } : {}),
  };
}

export function openApiFieldNamesFromTask(
  task: Task | null | undefined
): ManualCatalogEntry['openApiFieldNames'] | undefined {
  const wire = backendCallTaskWireFromTask(task);
  if (!wire) return undefined;
  const inputNames = (wire.inputs ?? [])
    .map((r) => {
      const row = r as { apiParam?: string; internalName?: string };
      return String(row.apiParam ?? row.internalName ?? '').trim();
    })
    .filter(Boolean);
  const outputNames = (wire.outputs ?? [])
    .map((r) => {
      const row = r as { apiField?: string; internalName?: string };
      return String(row.apiField ?? row.internalName ?? '').trim();
    })
    .filter(Boolean);
  if (inputNames.length === 0 && outputNames.length === 0) return undefined;
  return { inputs: inputNames, outputs: outputNames };
}

/** Builds a BackendCall task seed from catalog entry + optional review wire. */
export function backendCallTaskFromManualEntry(
  entry: ManualCatalogEntry,
  taskWire?: AgentReviewBackendCallTaskWireSnapshot | null
): Task {
  const url = entry.endpointUrl.trim();
  const method = (entry.method ?? 'GET').toUpperCase();
  const label = entry.label.trim() || url || 'Backend';

  const wireEndpoint = taskWire?.endpoint;
  const endpoint = wireEndpoint?.url
    ? {
        url: wireEndpoint.url,
        method: (wireEndpoint.method ?? method).toUpperCase(),
        headers: wireEndpoint.headers ?? {},
      }
    : { url, method, headers: {} as Record<string, string> };

  const task: BackendCallTask = {
    id: entry.id,
    type: TaskType.BackendCall,
    label,
    endpoint,
    ...(entry.portalConnectionId ? { portalConnectionId: entry.portalConnectionId } : {}),
    ...(taskWire?.inputs?.length ? { inputs: taskWire.inputs } : { inputs: [] }),
    ...(taskWire?.outputs?.length ? { outputs: taskWire.outputs } : { outputs: [] }),
    ...(taskWire?.backendCallSpecMeta ? { backendCallSpecMeta: taskWire.backendCallSpecMeta } : {}),
    ...(taskWire?.backendToolDescription
      ? { backendToolDescription: taskWire.backendToolDescription }
      : {}),
    ...(taskWire?.openapiSpecUrl ? { openapiSpecUrl: taskWire.openapiSpecUrl } : {}),
  };

  return task as Task;
}

/** Prefer live in-memory task when it has richer I/O than snapshot wire. */
export function resolveEphemeralBackendCallTask(
  entry: ManualCatalogEntry,
  taskWire: AgentReviewBackendCallTaskWireSnapshot | null | undefined,
  liveTask: Task | null | undefined
): Task {
  const fromWire = backendCallTaskFromManualEntry(entry, taskWire);
  if (!liveTask || liveTask.type !== TaskType.BackendCall) return fromWire;
  const liveIn = ioRowCount((liveTask as BackendCallTask).inputs);
  const liveOut = ioRowCount((liveTask as BackendCallTask).outputs);
  const wireIn = ioRowCount(fromWire.inputs);
  const wireOut = ioRowCount(fromWire.outputs);
  if (liveIn + liveOut >= wireIn + wireOut) return liveTask;
  return fromWire;
}

/** Stable key for polling taskRepository I/O changes in the review portal. */
export function backendTaskWireSyncKey(
  manualEntryIds: readonly string[],
  getTask: (id: string) => Task | null | undefined
): string {
  return JSON.stringify(
    manualEntryIds.map((id) => {
      const wire = backendCallTaskWireFromTask(getTask(id));
      return wire ?? null;
    })
  );
}
