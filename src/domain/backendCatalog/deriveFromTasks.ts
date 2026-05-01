/**
 * Estrae riferimenti backend da {@link Task} in memoria (TaskRepository) — nessun I/O.
 */

import { TaskType, type Task } from '../../types/taskTypes';
import type { BackendCallSpecMeta, CatalogFrozenMeta, DerivedBackendRef } from './catalogTypes';
import { normalizePathname } from './canonicalKey';
import { parseOptionalIaRuntimeJson } from '../../utils/iaAgentRuntime/iaAgentConfigNormalize';
import type { IAAgentConfig } from '../../types/iaAgentRuntimeSetup';

function pathnameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    return normalizePathname(u.pathname) || '/';
  } catch {
    return url;
  }
}

function emptyFrozen(): CatalogFrozenMeta {
  return {
    lastImportedAt: null,
    specSourceUrl: null,
    contentHash: null,
    importState: 'none',
  };
}

function metaFromBackendCallTask(task: Task, endpointUrl: string): CatalogFrozenMeta {
  const m = (task as { backendCallSpecMeta?: BackendCallSpecMeta }).backendCallSpecMeta;
  if (!m || m.importState === 'none') {
    return { ...emptyFrozen(), specSourceUrl: endpointUrl };
  }
  return {
    lastImportedAt: m.lastImportedAt,
    specSourceUrl: endpointUrl,
    contentHash: m.contentHash,
    importState: m.importState,
    lastError: m.lastError,
    structuralFingerprintAtLastOkImport: m.structuralFingerprint,
  };
}

/**
 * @param tasks - output di `taskRepository.getAllTasks()` per il progetto corrente
 */
export function deriveBackendRefsFromTasks(tasks: Task[]): DerivedBackendRef[] {
  const out: DerivedBackendRef[] = [];
  for (const task of tasks) {
    if (task.type === TaskType.BackendCall) {
      const ep = (task as Task & { endpoint?: { url?: string; method?: string } }).endpoint;
      const url = (ep?.url || '').trim();
      if (!url) continue;
      const method = (ep?.method || 'GET').toUpperCase();
      out.push({
        source: 'graph',
        taskId: task.id,
        method,
        pathnameDisplay: pathnameFromUrl(url),
        endpointUrlForImport: url,
        operationId: undefined,
        label: `Backend Call (${task.id.slice(0, 8)}…)`,
        frozenMeta: metaFromBackendCallTask(task, url),
        lastStructuralEditAt:
          task.updatedAt instanceof Date ? task.updatedAt.toISOString() : new Date().toISOString(),
      });
      continue;
    }
    if (task.type === TaskType.AIAgent) {
      const raw = (task as Task).agentIaRuntimeOverrideJson;
      const parsed = parseOptionalIaRuntimeJson(raw);
      const cfg = parsed as Partial<IAAgentConfig> | null;
      const base = cfg?.elevenLabsBackendBaseUrl?.trim();
      if (!base) continue;
      const url = base.startsWith('http') ? base : `https://${base}`;
      out.push({
        source: 'tools',
        taskId: task.id,
        method: 'GET',
        pathnameDisplay: pathnameFromUrl(url),
        endpointUrlForImport: url,
        label: `Agent IA · ElevenLabs backend (${task.id.slice(0, 8)}…)`,
        frozenMeta: {
          ...emptyFrozen(),
          specSourceUrl: url,
          importState: 'none',
        },
        lastStructuralEditAt:
          task.updatedAt instanceof Date ? task.updatedAt.toISOString() : new Date().toISOString(),
      });
    }
  }
  return out;
}
