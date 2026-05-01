/**
 * Ensures a TaskRepository row exists for a manual backend-catalog entry: same id as the catalog row,
 * type BackendCall, seeded from catalog URL/method/label so the full BackendCall editor can load without
 * matching a graph node.
 */

import { deriveBackendLabelFromUrl, type ManualCatalogEntry } from '@domain/backendCatalog';
import { taskRepository } from '@services/TaskRepository';
import { TaskType, type Task } from '@types/taskTypes';

function normalizeMethod(m: string | undefined): string {
  return (m || 'GET').toUpperCase();
}

function readEndpoint(task: Task): { url: string; method: string; headers: Record<string, string> } {
  const ep = (task as Task & { endpoint?: { url?: string; method?: string; headers?: Record<string, string> } })
    .endpoint;
  if (ep && typeof ep === 'object') {
    return {
      url: String(ep.url ?? '').trim(),
      method: normalizeMethod(ep.method),
      headers: ep.headers && typeof ep.headers === 'object' ? ep.headers : {},
    };
  }
  return { url: '', method: 'GET', headers: {} };
}

export function ensureManualCatalogBackendTask(entry: ManualCatalogEntry, projectId: string | undefined): Task {
  const pid = projectId?.trim() || undefined;
  const catalogUrl = entry.endpointUrl.trim();
  const catalogMethod = normalizeMethod(entry.method);
  const catalogLabel = entry.label.trim() || deriveBackendLabelFromUrl(catalogUrl);

  const existing = taskRepository.getTask(entry.id);

  if (existing) {
    if (existing.type !== TaskType.BackendCall) {
      throw new Error(
        `[ensureManualCatalogBackendTask] Il task ${entry.id} esiste ma non è BackendCall (tipo ${existing.type}).`
      );
    }
    const { url: taskUrl, method: taskMethod, headers } = readEndpoint(existing);

    const updates: Record<string, unknown> = {};
    if (catalogUrl && (taskUrl !== catalogUrl || taskMethod !== catalogMethod)) {
      updates.endpoint = {
        url: catalogUrl,
        method: catalogMethod,
        headers,
      };
    }
    const taskLabel = String((existing as Task & { label?: string }).label ?? '').trim();
    if (catalogLabel !== taskLabel) {
      updates.label = catalogLabel;
    }
    if (Object.keys(updates).length > 0) {
      taskRepository.updateTask(entry.id, updates as Partial<Task>, pid);
    }
    return taskRepository.getTask(entry.id)!;
  }

  taskRepository.createTask(
    TaskType.BackendCall,
    null,
    {
      label: catalogLabel,
      endpoint: {
        url: catalogUrl,
        method: catalogMethod,
        headers: {},
      },
      inputs: [],
      outputs: [],
    } as Partial<Task>,
    entry.id,
    pid
  );
  return taskRepository.getTask(entry.id)!;
}
