/**
 * Single place to resolve child-flow Interface OUTPUT rows: workspace snapshot,
 * in-memory cache, then API. Used by variable menu, Subflow toolbar, and invalidation
 * after Interface panel edits.
 */
import type { FlowId, WorkspaceState } from '../flows/FlowTypes';
import type { MappingEntry } from '../components/FlowMappingPanel/mappingTypes';
import { loadFlow } from '../flows/FlowPersistence';

export type ChildFlowInterfaceSource = 'store' | 'cache' | 'api';

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
 * Clears cached child-flow interface data. Call when meta.flowInterface changes on a child flow.
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

function readOutputsFromFlowSlice(flow: { title?: string; meta?: unknown } | undefined): {
  outputs: MappingEntry[];
  title: string;
} | null {
  if (!flow) return null;
  const meta = flow.meta as { flowInterface?: { output?: unknown[] } } | undefined;
  const out = meta?.flowInterface?.output;
  if (!Array.isArray(out) || out.length === 0) return null;
  return { outputs: out as MappingEntry[], title: String(flow.title || '').trim() };
}

/**
 * Resolves interface OUTPUT entries for a child flow: prefer Redux workspace slice,
 * then module cache, then loadFlow API. Updates cache after a successful API read.
 */
export async function fetchChildFlowInterfaceOutputs(
  projectId: string,
  childFlowId: FlowId,
  flows?: WorkspaceState['flows']
): Promise<ChildFlowInterfaceResult> {
  const pid = String(projectId || '').trim();
  const cid = String(childFlowId || '').trim();
  if (!pid || !cid) {
    return { outputs: [], title: cid, source: 'store' };
  }

  const fromStore = flows?.[cid] ? readOutputsFromFlowSlice(flows[cid] as any) : null;
  if (fromStore && fromStore.outputs.length > 0) {
    cache.set(cacheKey(pid, cid), { outputs: fromStore.outputs, title: fromStore.title || cid });
    return { outputs: fromStore.outputs, title: fromStore.title || cid, source: 'store' };
  }

  const ck = cacheKey(pid, cid);
  if (cache.has(ck)) {
    const hit = cache.get(ck)!;
    return { outputs: hit.outputs, title: hit.title, source: 'cache' };
  }

  try {
    const loaded = await loadFlow(pid, cid);
    const meta = loaded?.meta as { flowInterface?: { output?: unknown[] }; variables?: unknown[] } | undefined;
    const out = meta?.flowInterface?.output;
    const outputs = Array.isArray(out) ? (out as MappingEntry[]) : [];
    const title =
      String((loaded as any)?.title || '').trim() ||
      cid;
    cache.set(ck, { outputs, title });
    return { outputs, title, source: 'api' };
  } catch {
    return { outputs: [], title: cid, source: 'api' };
  }
}
