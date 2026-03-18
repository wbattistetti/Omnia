// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTaskTreeDerived } from '@responseEditor/hooks/useTaskTreeDerived';
import { useTaskTreeStore } from '@responseEditor/core/state';
import type { TaskTree } from '@types/taskTypes';

/**
 * Tests for useTaskTreeDerived
 *
 * This hook provides derived values from TaskTree: mainList, isAggregatedAtomic, and introduction.
 * ✅ FASE 3: Hook now reads ONLY from Zustand store (single source of truth)
 *
 * WHAT WE TEST:
 * - Calculation of mainList from store taskTree
 * - isAggregatedAtomic calculation (true when >1 main)
 * - introduction from store taskTree
 * - Updates when taskTreeVersion changes (via store)
 * - Edge cases (null/undefined TaskTree, empty TaskTree, empty nodes)
 *
 * WHY IT'S IMPORTANT:
 * - mainList is used throughout ResponseEditor for rendering nodes
 * - isAggregatedAtomic affects UI layout (group headers)
 * - introduction is used for root node display
 * - Incorrect derived values can break the entire editor
 *
 * MOCKS:
 * - getdataList (ddtSelectors) - mocked to return predictable values
 */

// Mock ddtSelectors
vi.mock('../../ddtSelectors', () => ({
  getdataList: vi.fn((taskTree: any) => {
    if (!taskTree) return [];
    if (Array.isArray(taskTree.nodes)) {
      return taskTree.nodes.filter(Boolean);
    }
    return [];
  }),
}));

import { getdataList } from '../../ddtSelectors';

describe('useTaskTreeDerived', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // ✅ FASE 3: Reset store before each test
    const { result } = renderHook(() => useTaskTreeStore());
    act(() => {
      result.current.reset();
    });
  });

  describe('mainList calculation', () => {
    it('should calculate mainList from store taskTree.nodes', () => {
      const taskTree: TaskTree = {
        nodes: [
          { id: 'node-1', label: 'Node 1' },
          { id: 'node-2', label: 'Node 2' },
        ],
      };

      // ✅ FASE 3: Set taskTree in store instead of passing as prop
      const { result: storeResult } = renderHook(() => useTaskTreeStore());
      act(() => {
        storeResult.current.setTaskTree(taskTree);
      });

      const { result } = renderHook(() => useTaskTreeDerived());

      expect(getdataList).toHaveBeenCalledWith(taskTree);
      expect(result.current.mainList).toEqual([
        { id: 'node-1', label: 'Node 1' },
        { id: 'node-2', label: 'Node 2' },
      ]);
    });

    it('should return empty array when store taskTree is null', () => {
      // ✅ FASE 3: Store is already null (reset in beforeEach)
      const { result } = renderHook(() => useTaskTreeDerived());

      expect(result.current.mainList).toEqual([]);
    });

    it('should return empty array when taskTree.nodes is empty', () => {
      const taskTree: TaskTree = {
        nodes: [],
      };

      // ✅ FASE 3: Set taskTree in store
      const { result: storeResult } = renderHook(() => useTaskTreeStore());
      act(() => {
        storeResult.current.setTaskTree(taskTree);
      });

      const { result } = renderHook(() => useTaskTreeDerived());

      expect(result.current.mainList).toEqual([]);
    });

    it('should filter out falsy nodes', () => {
      const taskTree: TaskTree = {
        nodes: [
          { id: 'node-1', label: 'Node 1' },
          null as any,
          undefined as any,
          { id: 'node-2', label: 'Node 2' },
        ],
      };

      // ✅ FASE 3: Set taskTree in store
      const { result: storeResult } = renderHook(() => useTaskTreeStore());
      act(() => {
        storeResult.current.setTaskTree(taskTree);
      });

      const { result } = renderHook(() => useTaskTreeDerived());

      expect(result.current.mainList).toEqual([
        { id: 'node-1', label: 'Node 1' },
        { id: 'node-2', label: 'Node 2' },
      ]);
    });
  });

  describe('isAggregatedAtomic calculation', () => {
    it('should return false when mainList has 0 items', () => {
      const taskTree: TaskTree = {
        nodes: [],
      };

      // ✅ FASE 3: Set taskTree in store
      const { result: storeResult } = renderHook(() => useTaskTreeStore());
      act(() => {
        storeResult.current.setTaskTree(taskTree);
      });

      const { result } = renderHook(() => useTaskTreeDerived());

      expect(result.current.isAggregatedAtomic).toBe(false);
    });

    it('should return false when mainList has 1 item', () => {
      const taskTree: TaskTree = {
        nodes: [{ id: 'node-1', label: 'Node 1' }],
      };

      // ✅ FASE 3: Set taskTree in store
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
          { id: 'node-1', label: 'Node 1' },
          { id: 'node-2', label: 'Node 2' },
        ],
      };

      // ✅ FASE 3: Set taskTree in store
      const { result: storeResult } = renderHook(() => useTaskTreeStore());
      act(() => {
        storeResult.current.setTaskTree(taskTree);
      });

      const { result } = renderHook(() => useTaskTreeDerived());

      expect(result.current.isAggregatedAtomic).toBe(true);
    });

    it('should update when mainList changes from 1 to 2 items', () => {
      const { result: storeResult } = renderHook(() => useTaskTreeStore());

      // Start with 1 node
      const taskTree1: TaskTree = {
        nodes: [{ id: 'node-1', label: 'Node 1' }],
      };

      act(() => {
        storeResult.current.setTaskTree(taskTree1);
      });

      const { result, rerender } = renderHook(() => useTaskTreeDerived());

      expect(result.current.isAggregatedAtomic).toBe(false);

      // Update to 2 nodes
      const taskTree2: TaskTree = {
        nodes: [
          { id: 'node-1', label: 'Node 1' },
          { id: 'node-2', label: 'Node 2' },
        ],
      };

      act(() => {
        storeResult.current.setTaskTree(taskTree2);
      });

      // ✅ FASE 3: Force re-render by incrementing version
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
      const taskTree: TaskTree = {
        nodes: [],
        introduction,
      };

      // ✅ FASE 3: Set taskTree in store
      const { result: storeResult } = renderHook(() => useTaskTreeStore());
      act(() => {
        storeResult.current.setTaskTree(taskTree);
      });

      const { result } = renderHook(() => useTaskTreeDerived());

      expect(result.current.introduction).toEqual(introduction);
    });

    it('should return null when store taskTree has no introduction', () => {
      const taskTree: TaskTree = {
        nodes: [],
      };

      // ✅ FASE 3: Set taskTree in store
      const { result: storeResult } = renderHook(() => useTaskTreeStore());
      act(() => {
        storeResult.current.setTaskTree(taskTree);
      });

      const { result } = renderHook(() => useTaskTreeDerived());

      expect(result.current.introduction).toBeNull();
    });

    it('should return null when store taskTree is null', () => {
      // ✅ FASE 3: Store is already null (reset in beforeEach)
      const { result } = renderHook(() => useTaskTreeDerived());

      expect(result.current.introduction).toBeNull();
    });

    it('should update when taskTreeVersion changes', () => {
      const introduction1 = { type: 'introduction', escalations: [] };
      const introduction2 = { type: 'introduction', escalations: [{ tasks: [] }] };

      const { result: storeResult } = renderHook(() => useTaskTreeStore());

      // Set initial introduction
      const taskTree1: TaskTree = {
        nodes: [],
        introduction: introduction1,
      };

      act(() => {
        storeResult.current.setTaskTree(taskTree1);
      });

      const { result, rerender } = renderHook(() => useTaskTreeDerived());

      expect(result.current.introduction).toEqual(introduction1);

      // Update introduction
      const taskTree2: TaskTree = {
        nodes: [],
        introduction: introduction2,
      };

      act(() => {
        storeResult.current.setTaskTree(taskTree2);
      });

      // ✅ FASE 3: Force re-render by incrementing version
      act(() => {
        storeResult.current.incrementVersion();
      });

      rerender();

      expect(result.current.introduction).toEqual(introduction2);
    });
  });

  describe('memoization triggers', () => {
    it('should update mainList when taskTreeVersion changes', () => {
      const taskTree: TaskTree = {
        nodes: [{ id: 'node-1', label: 'Node 1' }],
      };

      const { result: storeResult } = renderHook(() => useTaskTreeStore());
      act(() => {
        storeResult.current.setTaskTree(taskTree);
      });

      const { result, rerender } = renderHook(() => useTaskTreeDerived());

      const initialMainList = result.current.mainList;

      // ✅ FASE 3: Increment version to trigger recalculation
      act(() => {
        storeResult.current.incrementVersion();
      });

      rerender();

      // getdataList should be called again
      expect(getdataList).toHaveBeenCalledTimes(2);
      // mainList should be recalculated (same value but new reference due to memoization)
      expect(result.current.mainList).toEqual(initialMainList);
    });

    it('should update mainList when taskTree.nodes.length changes', () => {
      const { result: storeResult } = renderHook(() => useTaskTreeStore());

      const taskTree1: TaskTree = {
        nodes: [{ id: 'node-1' }],
      };

      act(() => {
        storeResult.current.setTaskTree(taskTree1);
      });

      const { result, rerender } = renderHook(() => useTaskTreeDerived());

      expect(result.current.mainList).toHaveLength(1);

      const taskTree2: TaskTree = {
        nodes: [
          { id: 'node-1' },
          { id: 'node-2' },
        ],
      };

      act(() => {
        storeResult.current.setTaskTree(taskTree2);
      });

      // ✅ FASE 3: Force re-render by incrementing version
      act(() => {
        storeResult.current.incrementVersion();
      });

      rerender();

      expect(result.current.mainList).toHaveLength(2);
    });
  });

  describe('edge cases', () => {
    it('should handle taskTree without nodes property', () => {
      const taskTree = {} as TaskTree;

      // ✅ FASE 3: Set taskTree in store
      const { result: storeResult } = renderHook(() => useTaskTreeStore());
      act(() => {
        storeResult.current.setTaskTree(taskTree);
      });

      const { result } = renderHook(() => useTaskTreeDerived());

      expect(result.current.mainList).toEqual([]);
    });

    it('should handle taskTree with non-array nodes', () => {
      const taskTree = {
        nodes: 'not-an-array',
      } as any;

      // ✅ FASE 3: Set taskTree in store
      const { result: storeResult } = renderHook(() => useTaskTreeStore());
      act(() => {
        storeResult.current.setTaskTree(taskTree);
      });

      const { result } = renderHook(() => useTaskTreeDerived());

      expect(result.current.mainList).toEqual([]);
    });
  });
});
