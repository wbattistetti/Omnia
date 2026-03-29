// getdataList / getSubDataList delegate to core/domain (strict TaskTree).

import { describe, it, expect } from 'vitest';
import { getdataList, getSubDataList } from '../ddtSelectors';
import type { TaskTree } from '@types/taskTypes';

describe('ddtSelectors', () => {
  it('returns main nodes from TaskTree', () => {
    const taskTree: TaskTree = {
      id: 'test-1',
      nodes: [
        { id: 'node-1', label: 'Node 1', subNodes: [] },
        { id: 'node-2', label: 'Node 2', subNodes: [] },
      ],
    };

    const result = getdataList(taskTree);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('node-1');
  });

  it('returns empty array when taskTree is null', () => {
    expect(getdataList(null)).toEqual([]);
  });

  it('returns empty array when taskTree is undefined', () => {
    expect(getdataList(undefined)).toEqual([]);
  });

  it('throws when TaskTree uses legacy data instead of nodes', () => {
    const taskTree = {
      id: 'test-3',
      data: [{ id: 'data-1', label: 'Data 1' }],
    } as unknown as TaskTree;

    expect(() => getdataList(taskTree)).toThrow();
  });

  it('uses nodes when both nodes and legacy data exist on object', () => {
    const taskTree = {
      id: 'test-4',
      nodes: [{ id: 'node-1', label: 'Node 1', subNodes: [] }],
      data: [{ id: 'data-1', label: 'Data 1' }],
    } as TaskTree;

    const result = getdataList(taskTree);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('node-1');
  });

  it('getSubDataList returns subNodes from a main node', () => {
    const main = {
      id: 'm',
      label: 'M',
      subNodes: [{ id: 's', label: 'S', subNodes: [] }],
    };
    expect(getSubDataList(main)).toHaveLength(1);
    expect(getSubDataList(main)[0].id).toBe('s');
  });
});
