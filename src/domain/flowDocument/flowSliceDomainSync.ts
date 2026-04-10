/**
 * Keeps FlowStore slice `tasks` aligned with TaskRepository so FlowDocument save uses the workspace slice as authority.
 * Bridges non-React services to {@link getSubflowSyncUpsertFlowSlice} registered by AppContent.
 */

import type { Task } from '@types/taskTypes';
import type { Flow, WorkspaceState } from '@flows/FlowTypes';
import { getSubflowSyncFlows, getSubflowSyncUpsertFlowSlice } from '@domain/taskSubflowMove/subflowSyncFlowsRef';

function resolveUpsert(): ((flow: Flow) => void) | null {
  const g = getSubflowSyncUpsertFlowSlice as unknown;
  if (typeof g !== 'function') return null;
  return (g as () => ((flow: Flow) => void) | null)() ?? null;
}

function resolveFlows(): WorkspaceState['flows'] {
  const g = getSubflowSyncFlows as unknown;
  if (typeof g !== 'function') return {};
  return (g as () => WorkspaceState['flows'])() ?? {};
}

export function syncTaskAuthoringIntoFlowSlice(task: Task): void {
  const upsert = resolveUpsert();
  if (!upsert) return;
  const fid = String(task.authoringFlowCanvasId ?? '').trim();
  if (!fid) return;
  const flows = resolveFlows();
  const slice = flows[fid];
  if (!slice) return;
  const prev = Array.isArray(slice.tasks) ? slice.tasks : [];
  const idx = prev.findIndex((t) => t.id === task.id);
  const nextTasks =
    idx >= 0 ? prev.map((t, i) => (i === idx ? ({ ...task } as Task) : t)) : [...prev, { ...task } as Task];
  upsert({ ...slice, tasks: nextTasks, hasLocalChanges: true } as Flow);
}

/**
 * Removes a task id from the `tasks` array of any flow slice that contained it (e.g. after delete).
 */
export function removeTaskIdFromFlowSlice(taskId: string, authoringFlowCanvasId?: string | null): void {
  const upsert = resolveUpsert();
  if (!upsert) return;
  const flows = resolveFlows();
  const tid = String(taskId || '').trim();
  if (!tid) return;

  const targetFlows: string[] = [];
  const af = String(authoringFlowCanvasId ?? '').trim();
  if (af && flows[af]) {
    targetFlows.push(af);
  } else {
    for (const [fid, slice] of Object.entries(flows)) {
      const arr = slice?.tasks;
      if (Array.isArray(arr) && arr.some((t) => t.id === tid)) {
        targetFlows.push(fid);
      }
    }
  }

  for (const fid of targetFlows) {
    const slice = flows[fid];
    if (!slice || !Array.isArray(slice.tasks)) continue;
    const nextTasks = slice.tasks.filter((t) => t.id !== tid);
    if (nextTasks.length === slice.tasks.length) continue;
    upsert({ ...slice, tasks: nextTasks, hasLocalChanges: true } as Flow);
  }
}
