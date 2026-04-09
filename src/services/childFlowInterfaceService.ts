/**
 * Risoluzione OUTPUT interfaccia sottoflusso da variabili reali (scope flow), coerente con menu/condizioni.
 */
import type { FlowId, WorkspaceState } from '../flows/FlowTypes';
import type { MappingEntry } from '../components/FlowMappingPanel/mappingTypes';
import { buildOutputMappingEntriesForChildFlow } from '../domain/flowInterface/reconstructFlowInterfaceIfMissing';
import { getProjectTranslationsTable } from '../utils/projectTranslationsRegistry';

export type ChildFlowInterfaceSource = 'scope';

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
 * Clears cached child-flow interface data. Call when flow canvas or variable store changes materially.
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
 * OUTPUT del child flow: sempre da {@link buildOutputMappingEntriesForChildFlow} (VariableCreationService + scope).
 */
export async function fetchChildFlowInterfaceOutputs(
  projectId: string,
  childFlowId: FlowId,
  flows?: WorkspaceState['flows']
): Promise<ChildFlowInterfaceResult> {
  const pid = String(projectId || '').trim();
  const cid = String(childFlowId || '').trim();
  if (!pid || !cid) {
    return { outputs: [], title: cid, source: 'scope' };
  }

  const ck = cacheKey(pid, cid);
  if (cache.has(ck)) {
    const hit = cache.get(ck)!;
    return { outputs: hit.outputs, title: hit.title, source: 'scope' };
  }

  const tr = getProjectTranslationsTable();
  const outputs = buildOutputMappingEntriesForChildFlow(pid, cid, (flows ?? {}) as Record<string, any>, tr);
  const title = String(flows?.[cid]?.title || cid).trim() || cid;
  cache.set(ck, { outputs, title });
  return { outputs, title, source: 'scope' };
}
