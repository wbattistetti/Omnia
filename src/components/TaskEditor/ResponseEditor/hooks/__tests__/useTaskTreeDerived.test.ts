// Tests for useTaskTreeDerived: mainList / introduction from Zustand TaskTree + version.

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTaskTreeDerived } from '@responseEditor/hooks/useTaskTreeDerived';
import { useTaskTreeStore } from '@responseEditor/core/state';
import { ensureTaskTreeNodeIds } from '@responseEditor/core/taskTree';
import type { TaskTree } from '@types/taskTypes';

describe('useTaskTreeDerived', () => {
  beforeEach(() => {
    const { result } = renderHook(() => useTaskTreeStore());
    act(() => {
      result.current.reset();
    });
  });

  describe('mainList calculation', () => {
    it('should calculate mainList from store taskTree.nodes', () => {
      const taskTree: TaskTree = {
        nodes: [
          { id: 'node-1', label: 'Node 1', subNodes: [] },
          { id: 'node-2', label: 'Node 2', subNodes: [] },
        ],
      };

      const { result: storeResult } = renderHook(() => useTaskTreeStore());
      act(() => {
        storeResult.current.setTaskTree(taskTree);
      });

      const { result } = renderHook(() => useTaskTreeDerived());

      expect(result.current.mainList).toEqual(ensureTaskTreeNodeIds(taskTree).nodes);
    });

    it('should return empty array when store taskTree is null', () => {
      const { result } = renderHook(() => useTaskTreeDerived());
      expect(result.current.mainList).toEqual([]);
    });

    it('should return empty array when taskTree.nodes is empty', () => {
      const taskTree: TaskTree = { id: 't', nodes: [] };

      const { result: storeResult } = renderHook(() => useTaskTreeStore());
      act(() => {
        storeResult.current.setTaskTree(taskTree);
      });

      const { result } = renderHook(() => useTaskTreeDerived());
      expect(result.current.mainList).toEqual([]);
    });
  });

  describe('isAggregatedAtomic calculation', () => {
    it('should return false when mainList has 0 items', () => {
      const taskTree: TaskTree = { id: 't', nodes: [] };
      const { result: storeResult } = renderHook(() => useTaskTreeStore());
      act(() => {
        storeResult.current.setTaskTree(taskTree);
      });
      const { result } = renderHook(() => useTaskTreeDerived());
      expect(result.current.isAggregatedAtomic).toBe(false);
    });

    it('should return false when mainList has 1 item', () => {
      const taskTree: TaskTree = {
        nodes: [{ id: 'node-1', label: 'Node 1', subNodes: [] }],
      };
      const { result: storeResult } = renderHook(() => useTaskTreeStore());
      act(() => {
        storeResult.current.setTaskTree(taskTree);
      });
      const { result } = renderHook(() => useTaskTreeDerived());
      expect(result.current.isAggregatedAtomic).toBe(false);
    });

    it('should return true when mainList has more than 1 item', () => {
      const taskTree: TaskTree = {
        nodes: [
          { id: 'node-1', label: 'Node 1', subNodes: [] },
          { id: 'node-2', label: 'Node 2', subNodes: [] },
        ],
      };
      const { result: storeResult } = renderHook(() => useTaskTreeStore());
      act(() => {
        storeResult.current.setTaskTree(taskTree);
      });
      const { result } = renderHook(() => useTaskTreeDerived());
      expect(result.current.isAggregatedAtomic).toBe(true);
    });

    it('should update when store switches from 1 to 2 mains', () => {
      const { result: storeResult } = renderHook(() => useTaskTreeStore());
      act(() => {
        storeResult.current.setTaskTree({
          nodes: [{ id: 'node-1', label: 'Node 1', subNodes: [] }],
        });
      });

      const { result, rerender } = renderHook(() => useTaskTreeDerived());
      expect(result.current.isAggregatedAtomic).toBe(false);

      act(() => {
        storeResult.current.setTaskTree({
          nodes: [
            { id: 'node-1', label: 'Node 1', subNodes: [] },
            { id: 'node-2', label: 'Node 2', subNodes: [] },
          ],
        });
      });
      act(() => {
        storeResult.current.incrementVersion();
      });
      rerender();

      expect(result.current.isAggregatedAtomic).toBe(true);
    });
  });

  describe('introduction', () => {
    it('should return introduction from store taskTree', () => {
      const introduction = { type: 'introduction', escalations: [] };
      const taskTree: TaskTree = { id: 't', nodes: [], introduction };

      const { result: storeResult } = renderHook(() => useTaskTreeStore());
      act(() => {
        storeResult.current.setTaskTree(taskTree);
      });

      const { result } = renderHook(() => useTaskTreeDerived());
      expect(result.current.introduction).toEqual(introduction);
    });

    it('should return null when store taskTree has no introduction', () => {
      const taskTree: TaskTree = { id: 't', nodes: [] };
      const { result: storeResult } = renderHook(() => useTaskTreeStore());
      act(() => {
        storeResult.current.setTaskTree(taskTree);
      });
      const { result } = renderHook(() => useTaskTreeDerived());
      expect(result.current.introduction).toBeNull();
    });

    it('should return null when store taskTree is null', () => {
      const { result } = renderHook(() => useTaskTreeDerived());
      expect(result.current.introduction).toBeNull();
    });
  });

  describe('memoization triggers', () => {
    it('should keep mainList in sync after version bump', () => {
      const taskTree: TaskTree = {
        nodes: [{ id: 'node-1', label: 'Node 1', subNodes: [] }],
      };
      const { result: storeResult } = renderHook(() => useTaskTreeStore());
      act(() => {
        storeResult.current.setTaskTree(taskTree);
      });

      const { result, rerender } = renderHook(() => useTaskTreeDerived());
      const initial = result.current.mainList;

      act(() => {
        storeResult.current.incrementVersion();
      });
      rerender();

      expect(result.current.mainList).toEqual(initial);
    });

    it('should reflect new nodes after setTaskTree and version change', () => {
      const { result: storeResult } = renderHook(() => useTaskTreeStore());
      act(() => {
        storeResult.current.setTaskTree({
          nodes: [{ id: 'node-1', label: 'N1', subNodes: [] }],
        });
      });

      const { result, rerender } = renderHook(() => useTaskTreeDerived());
      expect(result.current.mainList).toHaveLength(1);

      act(() => {
        storeResult.current.setTaskTree({
          nodes: [
            { id: 'node-1', label: 'N1', subNodes: [] },
            { id: 'node-2', label: 'N2', subNodes: [] },
          ],
        });
      });
      act(() => {
        storeResult.current.incrementVersion();
      });
      rerender();

      expect(result.current.mainList).toHaveLength(2);
    });
  });

});
