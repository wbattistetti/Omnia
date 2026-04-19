import { describe, expect, it } from 'vitest';
import { mergeWorkspaceFlowsPreferRicherGraph, totalTaskRowCountInFlowSlice } from '../mergeWorkspaceFlowsPreferRicherGraph';

function sliceWithRowCount(n: number, id: string) {
  const rows = Array.from({ length: n }, (_, i) => ({ id: `r${i}` }));
  return {
    id,
    nodes: [{ id: 'n1', data: { rows } }],
    edges: [],
  };
}

describe('mergeWorkspaceFlowsPreferRicherGraph', () => {
  it('prefers param when it has strictly more rows (orchestrator passed fresh graph, sync ref stale)', () => {
    const live = { main: sliceWithRowCount(2, 'main') };
    const param = { main: sliceWithRowCount(3, 'main') };
    const m = mergeWorkspaceFlowsPreferRicherGraph(param, live);
    expect(totalTaskRowCountInFlowSlice(m.main)).toBe(3);
  });

  it('prefers live when it has strictly more rows (stale param)', () => {
    const live = { main: sliceWithRowCount(3, 'main') };
    const param = { main: sliceWithRowCount(2, 'main') };
    const m = mergeWorkspaceFlowsPreferRicherGraph(param, live);
    expect(totalTaskRowCountInFlowSlice(m.main)).toBe(3);
  });

  it('ties go to live slice', () => {
    const live = { main: sliceWithRowCount(2, 'main') };
    const param = { main: sliceWithRowCount(2, 'main') };
    const m = mergeWorkspaceFlowsPreferRicherGraph(param, live);
    expect(m.main).toBe(live.main);
  });
});
