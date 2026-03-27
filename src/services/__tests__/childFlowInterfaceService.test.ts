import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  fetchChildFlowInterfaceOutputs,
  invalidateChildFlowInterfaceCache,
} from '../childFlowInterfaceService';
import * as FlowPersistence from '../../flows/FlowPersistence';

describe('childFlowInterfaceService', () => {
  beforeEach(() => {
    invalidateChildFlowInterfaceCache();
  });

  it('returns from workspace flows slice when outputs exist (store)', async () => {
    const out = [{ id: '1', variableRefId: 'v1' } as any];
    const flows = {
      child1: {
        title: 'Child',
        meta: { flowInterface: { output: out, input: [] } },
      },
    } as any;
    const r = await fetchChildFlowInterfaceOutputs('p1', 'child1', flows);
    expect(r.source).toBe('store');
    expect(r.outputs).toEqual(out);
    expect(r.title).toBe('Child');
  });

  it('loads from API when flow not in workspace and populates cache', async () => {
    const out = [{ id: '2', variableRefId: 'v2' } as any];
    vi.spyOn(FlowPersistence, 'loadFlow').mockResolvedValue({
      nodes: [],
      edges: [],
      meta: { flowInterface: { output: out, input: [] } },
    } as any);
    const r = await fetchChildFlowInterfaceOutputs('p1', 'missing-child', {});
    expect(r.source).toBe('api');
    expect(r.outputs).toEqual(out);
    vi.mocked(FlowPersistence.loadFlow).mockRestore();
  });

  it('returns cache on second call without hitting API again', async () => {
    const out = [{ id: '3' } as any];
    vi.spyOn(FlowPersistence, 'loadFlow').mockResolvedValue({
      nodes: [],
      edges: [],
      meta: { flowInterface: { output: out, input: [] } },
    } as any);
    await fetchChildFlowInterfaceOutputs('p2', 'c2', {});
    const spy = vi.spyOn(FlowPersistence, 'loadFlow');
    const r2 = await fetchChildFlowInterfaceOutputs('p2', 'c2', {});
    expect(r2.source).toBe('cache');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
