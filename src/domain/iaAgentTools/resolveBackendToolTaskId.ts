/**
 * Risolve il nome tool esposto a ConvAI → task Backend Call (per bridge runtime / webhook).
 */

import type { Task } from '@types/taskTypes';
import { TaskType } from '@types/taskTypes';
import type { IAAgentConfig } from 'types/iaAgentRuntimeSetup';
import { deriveBackendToolDefinition } from './backendToolDerivation';
import { mergeConvaiBackendToolIdLists } from './manualCatalogBackendToolIds';

/**
 * @returns `taskId` del Backend Call se `exportedToolName` coincide con la derivazione, altrimenti `undefined`.
 */
export function resolveBackendCallTaskIdForExportedToolName(
  exportedToolName: string,
  cfg: IAAgentConfig,
  getTask: (taskId: string) => Task | null | undefined,
  options?: { manualCatalogBackendTaskIds?: readonly string[] }
): string | undefined {
  const want = exportedToolName.trim();
  if (!want) return undefined;
  const fromCfg = (cfg.convaiBackendToolTaskIds ?? []).map((x) => String(x ?? '').trim()).filter(Boolean);
  const ids = mergeConvaiBackendToolIdLists(fromCfg, options?.manualCatalogBackendTaskIds ?? []);
  for (const id of ids) {
    const tid = String(id || '').trim();
    if (!tid) continue;
    const t = getTask(tid);
    if (!t || t.type !== TaskType.BackendCall) continue;
    const r = deriveBackendToolDefinition(t);
    if (!r.ok) continue;
    if (r.tool.name === want) return tid;
  }
  return undefined;
}
