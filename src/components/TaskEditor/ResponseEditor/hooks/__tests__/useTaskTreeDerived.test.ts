// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTaskTreeDerived } from '@responseEditor/hooks/useTaskTreeDerived';
import type { TaskTree } from '@types/taskTypes';

/**
 * Tests for useTaskTreeDerived
 *
 * This hook provides derived values from TaskTree: mainList, isAggregatedAtomic, and introduction.
 * We test observable behaviors: value derivation, fallback logic, and memoization triggers.
 *
 * WHAT WE TEST:
 * - Calculation of mainList from TaskTree
 * - Fallback to taskTreeRef.current when taskTree is null
 * - isAggregatedAtomic calculation (true when >1 main)
 * - introduction from taskTreeRef.current
 * - Updates when taskTreeVersion changes
 * - Updates when taskTree.label changes
 * - Updates when taskTree.nodes.length changes
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
  });

  describe('mainList calculation', () => {
    it('should calculate mainList from taskTree.nodes', () => {
      const taskTree: TaskTree = {
        nodes: [
          { id: 'node-1', label: 'Node 1' },
          { id: 'node-2', label: 'Node 2' },
        ],
      };

      const taskTreeRef = { current: null };
      const { result } = renderHook(() =>
        useTaskTreeDerived({
          taskTree,
          taskTreeRef: taskTreeRef as React.MutableRefObject<TaskTree | null | undefined>,
          taskTreeVersion: 0,
        })
      );

      expect(getdataList).toHaveBeenCalledWith(taskTree);
      expect(result.current.mainList).toEqual([
        { id: 'node-1', label: 'Node 1' },
        { id: 'node-2', label: 'Node 2' },
      ]);
    });

    it('should use taskTreeRef.current when taskTree is null', () => {
      const taskTreeRef = {
        current: {
          nodes: [
            { id: 'node-1', label: 'Node 1' },
          ],
        },
      };

      const { result } = renderHook(() =>
        useTaskTreeDerived({
          taskTree: null,
          taskTreeRef: taskTreeRef as React.MutableRefObject<TaskTree | null | undefined>,
          taskTreeVersion: 0,
        })
      );

      expect(getdataList).toHaveBeenCalledWith(taskTreeRef.current);
      expect(result.current.mainList).toEqual([
        { id: 'node-1', label: 'Node 1' },
      ]);
    });

    it('should prefer taskTree over taskTreeRef.current', () => {
      const taskTree: TaskTree = {
        nodes: [{ id: 'node-from-prop', label: 'From Prop' }],
      };

      const taskTreeRef = {
        current: {
          nodes: [{ id: 'node-from-ref', label: 'From Ref' }],
        },
      };

      const { result } = renderHook(() =>
        useTaskTreeDerived({
          taskTree,
          taskTreeRef: taskTreeRef as React.MutableRefObject<TaskTree | null | undefined>,
          taskTreeVersion: 0,
        })
      );

      expect(getdataList).toHaveBeenCalledWith(taskTree);
      expect(result.current.mainList).toEqual([
        { id: 'node-from-prop', label: 'From Prop' },
      ]);
    });

    it('should return empty array when both taskTree and taskTreeRef.current are null', () => {
      const taskTreeRef = { current: null };

      const { result } = renderHook(() =>
        useTaskTreeDerived({
          taskTree: null,
          taskTreeRef: taskTreeRef as React.MutableRefObject<TaskTree | null | undefined>,
          taskTreeVersion: 0,
        })
      );

      expect(result.current.mainList).toEqual([]);
    });

    it('should return empty array when taskTree.nodes is empty', () => {
      const taskTree: TaskTree = {
        nodes: [],
      };

      const { result } = renderHook(() =>
        useTaskTreeDerived({
          taskTree,
          taskTreeRef: { current: null } as React.MutableRefObject<TaskTree | null | undefined>,
          taskTreeVersion: 0,
        })
      );

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

      const { result } = renderHook(() =>
        useTaskTreeDerived({
          taskTree,
          taskTreeRef: { current: null } as React.MutableRefObject<TaskTree | null | undefined>,
          taskTreeVersion: 0,
        })
      );

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

      const { result } = renderHook(() =>
        useTaskTreeDerived({
          taskTree,
          taskTreeRef: { current: null } as React.MutableRefObject<TaskTree | null | undefined>,
          taskTreeVersion: 0,
        })
      );

      expect(result.current.isAggregatedAtomic).toBe(false);
    });

    it('should return false when mainList has 1 item', () => {
      const taskTree: TaskTree = {
        nodes: [{ id: 'node-1', label: 'Node 1' }],
      };

      const { result } = renderHook(() =>
        useTaskTreeDerived({
          taskTree,
          taskTreeRef: { current: null } as React.MutableRefObject<TaskTree | null | undefined>,
          taskTreeVersion: 0,
        })
      );

      expect(result.current.isAggregatedAtomic).toBe(false);
    });

    it('should return true when mainList has more than 1 item', () => {
      const taskTree: TaskTree = {
        nodes: [
          { id: 'node-1', label: 'Node 1' },
          { id: 'node-2', label: 'Node 2' },
        ],
      };

      const { result } = renderHook(() =>
        useTaskTreeDerived({
          taskTree,
          taskTreeRef: { current: null } as React.MutableRefObject<TaskTree | null | undefined>,
          taskTreeVersion: 0,
        })
      );

      expect(result.current.isAggregatedAtomic).toBe(true);
    });

    it('should update when mainList changes from 1 to 2 items', () => {
      const taskTreeRef = {
        current: {
          nodes: [{ id: 'node-1', label: 'Node 1' }],
        },
      };

      const { result, rerender } = renderHook(
        ({ taskTree }) =>
          useTaskTreeDerived({
            taskTree,
            taskTreeRef: taskTreeRef as React.MutableRefObject<TaskTree | null | undefined>,
            taskTreeVersion: 0,
          }),
        {
          initialProps: {
            taskTree: null as TaskTree | null,
          },
        }
      );

      expect(result.current.isAggregatedAtomic).toBe(false);

      // Update taskTreeRef to have 2 nodes
      taskTreeRef.current = {
        nodes: [
          { id: 'node-1', label: 'Node 1' },
          { id: 'node-2', label: 'Node 2' },
        ],
      };

      rerender({ taskTree: null });

      // Note: mainList depends on taskTree.label and taskTree.nodes.length
      // Since we're passing null, it uses taskTreeRef.current
      // But the memoization depends on taskTree?.nodes?.length, so we need to change that
      rerender({
        taskTree: {
          nodes: [
            { id: 'node-1', label: 'Node 1' },
            { id: 'node-2', label: 'Node 2' },
          ],
        } as TaskTree,
      });

      expect(result.current.isAggregatedAtomic).toBe(true);
    });
  });

  describe('introduction', () => {
    it('should return introduction from taskTreeRef.current', () => {
      const introduction = { type: 'introduction', escalations: [] };
      const taskTreeRef = {
        current: {
          nodes: [],
          introduction,
        },
      };

      const { result } = renderHook(() =>
        useTaskTreeDerived({
          taskTree: null,
          taskTreeRef: taskTreeRef as React.MutableRefObject<TaskTree | null | undefined>,
          taskTreeVersion: 0,
        })
      );

      expect(result.current.introduction).toEqual(introduction);
    });

    it('should return null when taskTreeRef.current has no introduction', () => {
      const taskTreeRef = {
        current: {
          nodes: [],
        },
      };

      const { result } = renderHook(() =>
        useTaskTreeDerived({
          taskTree: null,
          taskTreeRef: taskTreeRef as React.MutableRefObject<TaskTree | null | undefined>,
          taskTreeVersion: 0,
        })
      );

      expect(result.current.introduction).toBeNull();
    });

    it('should return null when taskTreeRef.current is null', () => {
      const taskTreeRef = { current: null };

      const { result } = renderHook(() =>
        useTaskTreeDerived({
          taskTree: null,
          taskTreeRef: taskTreeRef as React.MutableRefObject<TaskTree | null | undefined>,
          taskTreeVersion: 0,
        })
      );

      expect(result.current.introduction).toBeNull();
    });

    it('should update when taskTreeVersion changes', () => {
      const introduction1 = { type: 'introduction', escalations: [] };
      const introduction2 = { type: 'introduction', escalations: [{ tasks: [] }] };

      const taskTreeRef = {
        current: {
          nodes: [],
          introduction: introduction1,
        },
      };

      const { result, rerender } = renderHook(
        ({ taskTreeVersion }) =>
          useTaskTreeDerived({
            taskTree: null,
            taskTreeRef: taskTreeRef as React.MutableRefObject<TaskTree | null | undefined>,
            taskTreeVersion,
          }),
        {
          initialProps: { taskTreeVersion: 0 },
        }
      );

      expect(result.current.introduction).toEqual(introduction1);

      // Update introduction in ref
      taskTreeRef.current.introduction = introduction2;

      // Update taskTreeVersion to trigger recalculation
      rerender({ taskTreeVersion: 1 });

      expect(result.current.introduction).toEqual(introduction2);
    });

    it('should update when taskTree.introduction changes', () => {
      const introduction1 = { type: 'introduction', escalations: [] };
      const introduction2 = { type: 'introduction', escalations: [{ tasks: [] }] };

      const taskTreeRef = {
        current: {
          nodes: [],
          introduction: introduction1,
        },
      };

      const { result, rerender } = renderHook(
        ({ taskTree }) =>
          useTaskTreeDerived({
            taskTree,
            taskTreeRef: taskTreeRef as React.MutableRefObject<TaskTree | null | undefined>,
            taskTreeVersion: 0,
          }),
        {
          initialProps: {
            taskTree: { nodes: [], introduction: introduction1 } as TaskTree,
          },
        }
      );

      expect(result.current.introduction).toEqual(introduction1);

      // Update both taskTree.introduction (for memoization key) and taskTreeRef.current.introduction (for actual value)
      taskTreeRef.current.introduction = introduction2;
      rerender({
        taskTree: { nodes: [], introduction: introduction2 } as TaskTree,
      });

      expect(result.current.introduction).toEqual(introduction2);
    });
  });

  describe('memoization triggers', () => {
    it('should update mainList when taskTreeVersion changes', () => {
      const taskTree: TaskTree = {
        nodes: [{ id: 'node-1', label: 'Node 1' }],
      };

      const { result, rerender } = renderHook(
        ({ taskTreeVersion }) =>
          useTaskTreeDerived({
            taskTree,
            taskTreeRef: { current: null } as React.MutableRefObject<TaskTree | null | undefined>,
            taskTreeVersion,
          }),
        {
          initialProps: { taskTreeVersion: 0 },
        }
      );

      const initialMainList = result.current.mainList;

      rerender({ taskTreeVersion: 1 });

      // getdataList should be called again
      expect(getdataList).toHaveBeenCalledTimes(2);
      // mainList should be recalculated (same value but new reference due to memoization)
      expect(result.current.mainList).toEqual(initialMainList);
    });

    it('should update mainList when taskTree.label changes', () => {
      const taskTreeRef = { current: null };

      const { result, rerender } = renderHook(
        ({ taskTree }) =>
          useTaskTreeDerived({
            taskTree,
            taskTreeRef: taskTreeRef as React.MutableRefObject<TaskTree | null | undefined>,
            taskTreeVersion: 0,
          }),
        {
          initialProps: {
            taskTree: { nodes: [{ id: 'node-1' }], label: 'Label 1' } as TaskTree,
          },
        }
      );

      const initialMainList = result.current.mainList;

      rerender({
        taskTree: { nodes: [{ id: 'node-1' }], label: 'Label 2' } as TaskTree,
      });

      expect(getdataList).toHaveBeenCalledTimes(2);
      expect(result.current.mainList).toEqual(initialMainList);
    });

    it('should update mainList when taskTree.nodes.length changes', () => {
      const { result, rerender } = renderHook(
        ({ taskTree }) =>
          useTaskTreeDerived({
            taskTree,
            taskTreeRef: { current: null } as React.MutableRefObject<TaskTree | null | undefined>,
            taskTreeVersion: 0,
          }),
        {
          initialProps: {
            taskTree: { nodes: [{ id: 'node-1' }] } as TaskTree,
          },
        }
      );

      expect(result.current.mainList).toHaveLength(1);

      rerender({
        taskTree: {
          nodes: [
            { id: 'node-1' },
            { id: 'node-2' },
          ],
        } as TaskTree,
      });

      expect(result.current.mainList).toHaveLength(2);
    });

    it('should update mainList when isTaskTreeLoading changes', () => {
      const taskTree: TaskTree = {
        nodes: [{ id: 'node-1' }],
      };

      const { result, rerender } = renderHook(
        ({ isTaskTreeLoading }) =>
          useTaskTreeDerived({
            taskTree,
            taskTreeRef: { current: null } as React.MutableRefObject<TaskTree | null | undefined>,
            taskTreeVersion: 0,
            isTaskTreeLoading,
          }),
        {
          initialProps: { isTaskTreeLoading: false },
        }
      );

      const initialMainList = result.current.mainList;

      rerender({ isTaskTreeLoading: true });

      expect(getdataList).toHaveBeenCalledTimes(2);
      expect(result.current.mainList).toEqual(initialMainList);
    });
  });

  describe('edge cases', () => {
    it('should handle undefined taskTree', () => {
      const taskTreeRef = {
        current: {
          nodes: [{ id: 'node-1' }],
        },
      };

      const { result } = renderHook(() =>
        useTaskTreeDerived({
          taskTree: undefined,
          taskTreeRef: taskTreeRef as React.MutableRefObject<TaskTree | null | undefined>,
          taskTreeVersion: 0,
        })
      );

      expect(result.current.mainList).toEqual([{ id: 'node-1' }]);
    });

    it('should handle undefined isTaskTreeLoading', () => {
      const taskTree: TaskTree = {
        nodes: [{ id: 'node-1' }],
      };

      const { result } = renderHook(() =>
        useTaskTreeDerived({
          taskTree,
          taskTreeRef: { current: null } as React.MutableRefObject<TaskTree | null | undefined>,
          taskTreeVersion: 0,
          isTaskTreeLoading: undefined,
        })
      );

      expect(result.current.mainList).toEqual([{ id: 'node-1' }]);
    });

    it('should handle undefined taskTreeVersion', () => {
      const taskTree: TaskTree = {
        nodes: [{ id: 'node-1' }],
      };

      const { result } = renderHook(() =>
        useTaskTreeDerived({
          taskTree,
          taskTreeRef: { current: null } as React.MutableRefObject<TaskTree | null | undefined>,
          taskTreeVersion: undefined as any,
        })
      );

      expect(result.current.mainList).toEqual([{ id: 'node-1' }]);
    });

    it('should handle taskTree without nodes property', () => {
      const taskTree = {} as TaskTree;

      const { result } = renderHook(() =>
        useTaskTreeDerived({
          taskTree,
          taskTreeRef: { current: null } as React.MutableRefObject<TaskTree | null | undefined>,
          taskTreeVersion: 0,
        })
      );

      expect(result.current.mainList).toEqual([]);
    });

    it('should handle taskTree with non-array nodes', () => {
      const taskTree = {
        nodes: 'not-an-array',
      } as any;

      const { result } = renderHook(() =>
        useTaskTreeDerived({
          taskTree,
          taskTreeRef: { current: null } as React.MutableRefObject<TaskTree | null | undefined>,
          taskTreeVersion: 0,
        })
      );

      expect(result.current.mainList).toEqual([]);
    });
  });
});
