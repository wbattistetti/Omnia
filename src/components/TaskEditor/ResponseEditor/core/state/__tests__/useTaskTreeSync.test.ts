// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  useTaskTreeSync,
  useTaskTreeFromStore,
  useTaskTreeVersion,
} from '../useTaskTreeSync';
import { useTaskTreeStore } from '../taskTreeStore';
import type { TaskTree } from '../../../../../../types/taskTypes';

describe('Domain: TaskTree Sync Hooks', () => {
  beforeEach(() => {
    // Reset store before each test
    const { result } = renderHook(() => useTaskTreeStore());
    act(() => {
      result.current.reset();
    });
  });

  describe('useTaskTreeSync', () => {
    it('should sync taskTree prop to store when prop changes', () => {
      const taskTreeRef = { current: null as TaskTree | null };
      const taskTree: TaskTree = { id: 'test-1', nodes: [] };

      const { rerender } = renderHook(
        ({ taskTree }) => useTaskTreeSync(taskTreeRef as any, taskTree),
        { initialProps: { taskTree: null } }
      );

      // Update prop
      rerender({ taskTree });

      // Store should be updated
      const storeResult = renderHook(() => useTaskTreeStore());
      expect(storeResult.result.current.taskTree).toEqual(taskTree);
    });

    it('should sync taskTree prop to store when prop changes', () => {
      const taskTreeRef = { current: null as TaskTree | null };
      const taskTree1: TaskTree = { id: 'test-1', nodes: [] };
      const taskTree2: TaskTree = { id: 'test-2', nodes: [] };

      const { rerender } = renderHook(
        ({ taskTree }) => useTaskTreeSync(taskTreeRef as any, taskTree),
        { initialProps: { taskTree: taskTree1 } }
      );

      // Store should have taskTree1
      const storeResult1 = renderHook(() => useTaskTreeStore());
      expect(storeResult1.result.current.taskTree).toEqual(taskTree1);

      // Update prop
      rerender({ taskTree: taskTree2 });

      // Store should have taskTree2
      const storeResult2 = renderHook(() => useTaskTreeStore());
      expect(storeResult2.result.current.taskTree).toEqual(taskTree2);
    });

    it('should not sync when enabled is false', () => {
      const taskTreeRef = { current: null as TaskTree | null };
      const taskTree: TaskTree = { id: 'test-1', nodes: [] };

      renderHook(() => {
        useTaskTreeSync(taskTreeRef as any, taskTree, { enabled: false });
      });

      // Store should remain null
      const storeResult = renderHook(() => useTaskTreeStore());
      expect(storeResult.result.current.taskTree).toBeNull();
    });

    it('should sync bidirectionally when bidirectional is true', async () => {
      const taskTreeRef = { current: null as TaskTree | null };
      const taskTree: TaskTree = { id: 'test-1', nodes: [] };

      const { rerender } = renderHook(
        () => useTaskTreeSync(taskTreeRef as any, null, { bidirectional: true })
      );

      // Update store
      const storeResult = renderHook(() => useTaskTreeStore());
      act(() => {
        storeResult.result.current.setTaskTree(taskTree);
      });

      // Re-render to trigger sync
      rerender();

      // Wait for sync to complete
      await waitFor(() => {
        expect(taskTreeRef.current).toEqual(taskTree);
      });
    });

    it('should not sync bidirectionally when bidirectional is false', () => {
      const taskTreeRef = { current: null as TaskTree | null };
      const taskTree: TaskTree = { id: 'test-1', nodes: [] };

      renderHook(() => {
        useTaskTreeSync(taskTreeRef as any, null, { bidirectional: false });
      });

      // Update store
      const storeResult = renderHook(() => useTaskTreeStore());
      act(() => {
        storeResult.result.current.setTaskTree(taskTree);
      });

      // Ref should remain null
      expect(taskTreeRef.current).toBeNull();
    });
  });

  describe('useTaskTreeFromStore', () => {
    it('should return null when store is empty', () => {
      const { result } = renderHook(() => useTaskTreeFromStore());
      expect(result.current).toBeNull();
    });

    it('should return taskTree from store', () => {
      const taskTree: TaskTree = {
        id: 'test-1',
        nodes: [{ id: 'node-1', label: 'Node 1' } as any],
      };

      const storeResult = renderHook(() => useTaskTreeStore());
      act(() => {
        storeResult.result.current.setTaskTree(taskTree);
      });

      const { result } = renderHook(() => useTaskTreeFromStore());
      expect(result.current).toEqual(taskTree);
    });

    it('should update when store changes', () => {
      const taskTree1: TaskTree = { id: 'test-1', nodes: [] };
      const taskTree2: TaskTree = { id: 'test-2', nodes: [] };

      const storeResult = renderHook(() => useTaskTreeStore());
      const { result } = renderHook(() => useTaskTreeFromStore());

      act(() => {
        storeResult.result.current.setTaskTree(taskTree1);
      });
      expect(result.current).toEqual(taskTree1);

      act(() => {
        storeResult.result.current.setTaskTree(taskTree2);
      });
      expect(result.current).toEqual(taskTree2);
    });
  });

  describe('useTaskTreeVersion', () => {
    it('should return 0 when store is at initial version', () => {
      const { result } = renderHook(() => useTaskTreeVersion());
      expect(result.current).toBe(0);
    });

    it('should return current version from store', () => {
      const storeResult = renderHook(() => useTaskTreeStore());
      const { result } = renderHook(() => useTaskTreeVersion());

      act(() => {
        storeResult.result.current.incrementVersion();
      });
      expect(result.current).toBe(1);

      act(() => {
        storeResult.result.current.incrementVersion();
      });
      expect(result.current).toBe(2);
    });

    it('should update when version changes', () => {
      const taskTree: TaskTree = { id: 'test-1', nodes: [] };
      const storeResult = renderHook(() => useTaskTreeStore());
      const { result } = renderHook(() => useTaskTreeVersion());

      act(() => {
        storeResult.result.current.setTaskTree(taskTree);
      });
      expect(result.current).toBe(1);

      act(() => {
        storeResult.result.current.incrementVersion();
      });
      expect(result.current).toBe(2);
    });
  });
});
