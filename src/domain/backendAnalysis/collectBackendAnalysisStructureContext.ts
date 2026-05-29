/**
 * Estrae backend e parametri noti dal catalogo per guidare la strutturazione (senza inventare nomi).
 */

import { TaskType, type Task } from '@types/taskTypes';
import type { ManualCatalogEntry } from '@domain/backendCatalog/catalogTypes';
import {
  findBackendCallTaskForManualCatalogEntry,
  findGraphBackendTaskForManualCatalogEntry,
} from '@domain/backendCatalog/matchBackendCallTask';
import type { BackendAnalysisStructureContext } from './backendAnalysisDocumentTypes';

function paramNamesFromTask(task: Task): Array<{ name: string; direction: 'input' | 'output' }> {
  const out: Array<{ name: string; direction: 'input' | 'output' }> = [];
  const t = task as Task & {
    inputs?: Array<{ internalName?: string; apiParam?: string; apiName?: string }>;
    outputs?: Array<{ internalName?: string; apiField?: string; apiName?: string }>;
  };
  for (const inp of t.inputs ?? []) {
    const name = String(inp.apiParam ?? inp.apiName ?? inp.internalName ?? '').trim();
    if (name) out.push({ name, direction: 'input' });
  }
  for (const o of t.outputs ?? []) {
    const name = String(o.apiField ?? o.apiName ?? o.internalName ?? '').trim();
    if (name) out.push({ name, direction: 'output' });
  }
  return out;
}

/** Contesto catalogo per {@link structureBackendAnalysis}. */
export function collectBackendAnalysisStructureContext(
  manualEntries: readonly ManualCatalogEntry[],
  tasks: readonly Task[]
): BackendAnalysisStructureContext {
  const knownBackends = manualEntries.map((e) => ({
    id: e.id,
    label: (e.label?.trim() || e.id).trim(),
  }));

  const knownParameters: BackendAnalysisStructureContext['knownParameters'] = [];
  for (const entry of manualEntries) {
    const label = entry.label?.trim() || entry.id;
    const task =
      findGraphBackendTaskForManualCatalogEntry(tasks, manualEntries, entry.id) ??
      findBackendCallTaskForManualCatalogEntry(tasks, entry);
    if (!task || task.type !== TaskType.BackendCall) continue;
    for (const p of paramNamesFromTask(task)) {
      knownParameters.push({
        name: p.name,
        backendLabel: label,
        direction: p.direction,
      });
    }
  }

  return { knownBackends, knownParameters };
}
