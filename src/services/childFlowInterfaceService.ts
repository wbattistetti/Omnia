/**
 * Child-flow interface OUTPUT: read only from persisted flow.meta.flowInterface (FlowDocument).
 */

import type { FlowId, WorkspaceState } from '../flows/FlowTypes';
import type { MappingEntry } from '../components/FlowMappingPanel/mappingTypes';

export type ChildFlowInterfaceSource = 'persisted';

export type ChildFlowInterfaceResult = {
  outputs: MappingEntry[];
  title: string;
  source: ChildFlowInterfaceSource;
};

const cache = new Map<string, { outputs: MappingEntry[]; title: string }>();

function cacheKey(projectId: string, childFlowId: string): string {
  return `${String(projectId).trim()}::${String(childFlowId).trim()}`;
}

/**
 * Clears cached child-flow interface data. Call when flow meta changes.
 */
export function invalidateChildFlowInterfaceCache(projectId?: string, childFlowId?: string): void {
  const pid = String(projectId || '').trim();
  const cid = String(childFlowId || '').trim();
  if (!pid && !cid) {
    cache.clear();
    return;
  }
  if (pid && cid) {
    cache.delete(cacheKey(pid, cid));
    return;
  }
  if (pid) {
    const prefix = `${pid}::`;
    for (const k of [...cache.keys()]) {
      if (k.startsWith(prefix)) cache.delete(k);
    }
  }
}

/**
 * OUTPUT del child flow: solo da meta.flowInterface.output persistito (nessuna ricostruzione da variabili).
 */
export async function fetchChildFlowInterfaceOutputs(
  projectId: string,
  childFlowId: FlowId,
  flows?: WorkspaceState['flows']
): Promise<ChildFlowInterfaceResult> {
  const pid = String(projectId || '').trim();
  const cid = String(childFlowId || '').trim();
  if (!pid || !cid) {
    return { outputs: [], title: cid, source: 'persisted' };
  }

  const ck = cacheKey(pid, cid);
  if (cache.has(ck)) {
    const hit = cache.get(ck)!;
    return { outputs: hit.outputs, title: hit.title, source: 'persisted' };
  }

  const flow = flows?.[cid];
  const outputs = (flow?.meta?.flowInterface?.output ?? []) as MappingEntry[];
  const title = String(flow?.title || cid).trim() || cid;
  cache.set(ck, { outputs, title });
  return { outputs, title, source: 'persisted' };
}
