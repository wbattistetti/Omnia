/**
 * Human-readable title for a flow dock tab: prefer Subflow task name over generic flow slice title (e.g. "Subflow").
 */

import { findSubflowTaskByChildFlowId } from '@utils/findSubflowTaskByChildFlowId';

export function resolveFlowTabDisplayTitle(
  flowId: string,
  flows: Record<string, { title?: string } | undefined>
): string {
  const fid = String(flowId || '').trim();
  const slice = flows[fid];
  const fromFlow =
    typeof slice?.title === 'string' && slice.title.trim() ? slice.title.trim() : '';
  const task = findSubflowTaskByChildFlowId(fid);
  const fromTask = typeof task?.name === 'string' && task.name.trim() ? task.name.trim() : '';
  if (fromTask) return fromTask;
  return fromFlow || fid;
}
