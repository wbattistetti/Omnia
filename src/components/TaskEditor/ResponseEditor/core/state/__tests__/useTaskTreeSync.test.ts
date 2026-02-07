// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useTaskTreeFromStore,
  useTaskTreeVersion,
} from '../useTaskTreeSync';
import { useTaskTreeStore } from '../taskTreeStore';
import type { TaskTree } from '@types/taskTypes';

describe('TaskTree Store Hooks', () => {
  beforeEach(() => {
    // Reset store before each test
    const { result } = renderHook(() => useTaskTreeStore());
    act(() => {
      result.current.reset();
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
