import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fetchChildFlowInterfaceOutputs, invalidateChildFlowInterfaceCache } from '../childFlowInterfaceService';
import { variableCreationService } from '../VariableCreationService';

vi.mock('../VariableCreationService', () => ({
  variableCreationService: {
    getAllVariables: vi.fn(),
  },
}));

describe('childFlowInterfaceService', () => {
  beforeEach(() => {
    invalidateChildFlowInterfaceCache();
    vi.mocked(variableCreationService.getAllVariables).mockReset();
  });

  it('returns outputs from variable scope (not store meta)', async () => {
    vi.mocked(variableCreationService.getAllVariables).mockReturnValue([
      {
        id: 'v1',
        taskInstanceId: 'task1',
        dataPath: '',
        scope: 'flow',
        scopeFlowId: 'child1',
      },
    ]);
    const flows = {
      child1: { id: 'child1', title: 'Child', nodes: [], edges: [] },
    } as any;
    const r = await fetchChildFlowInterfaceOutputs('p1', 'child1', flows);
    expect(r.source).toBe('scope');
    expect(r.outputs.length).toBe(1);
    expect(r.outputs[0].variableRefId).toBe('v1');
  });

  it('returns cache on second call without duplicate getAllVariables work', async () => {
    vi.mocked(variableCreationService.getAllVariables).mockReturnValue([
      {
        id: 'v2',
        taskInstanceId: 'task2',
        dataPath: '',
        scope: 'flow',
        scopeFlowId: 'c2',
      },
    ]);
    await fetchChildFlowInterfaceOutputs('p2', 'c2', { c2: { id: 'c2', title: 'C', nodes: [], edges: [] } } as any);
    vi.mocked(variableCreationService.getAllVariables).mockClear();
    const r2 = await fetchChildFlowInterfaceOutputs('p2', 'c2', {});
    expect(r2.outputs.length).toBe(1);
    expect(vi.mocked(variableCreationService.getAllVariables)).not.toHaveBeenCalled();
  });
});
