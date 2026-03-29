// Tests for useNodeFinder: finds node by id in store TaskTree and calls handleSelectByPath.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNodeFinder } from '@responseEditor/features/node-editing/hooks/useNodeFinder';
import { useTaskTreeStore } from '@responseEditor/core/state';
import type { TaskTree } from '@types/taskTypes';

describe('useNodeFinder', () => {
  beforeEach(() => {
    const { result } = renderHook(() => useTaskTreeStore());
    act(() => {
      result.current.reset();
    });
  });

  it('does nothing when store has no task tree', () => {
    const handleSelectByPath = vi.fn();
    const { result } = renderHook(() => useNodeFinder({ handleSelectByPath }));

    act(() => {
      result.current('any-id');
    });

    expect(handleSelectByPath).not.toHaveBeenCalled();
  });

  it('calls handleSelectByPath with path when id matches a main node', () => {
    const tree: TaskTree = {
      id: 'root',
      nodes: [
        { id: 'a', label: 'A', templateId: 'a', subNodes: [] },
        { id: 'b', label: 'B', templateId: 'b', subNodes: [] },
      ],
    };

    const { result: store } = renderHook(() => useTaskTreeStore());
    act(() => {
      store.current.setTaskTree(tree);
    });

    const handleSelectByPath = vi.fn();
    const { result } = renderHook(() => useNodeFinder({ handleSelectByPath }));

    act(() => {
      result.current('b');
    });

    expect(handleSelectByPath).toHaveBeenCalledWith([1]);
  });

  it('calls handleSelectByPath with path when id matches a sub node', () => {
    const tree: TaskTree = {
      id: 'root',
      nodes: [
        {
          id: 'main',
          label: 'Main',
          templateId: 'main',
          subNodes: [{ id: 'sub-1', label: 'Sub', templateId: 'sub-t', subNodes: [] }],
        },
      ],
    };

    const { result: store } = renderHook(() => useTaskTreeStore());
    act(() => {
      store.current.setTaskTree(tree);
    });

    const handleSelectByPath = vi.fn();
    const { result } = renderHook(() => useNodeFinder({ handleSelectByPath }));

    act(() => {
      result.current('sub-1');
    });

    expect(handleSelectByPath).toHaveBeenCalledWith([0, 0]);
  });

  it('does not call handleSelectByPath when id is missing', () => {
    const tree: TaskTree = {
      id: 'root',
      nodes: [{ id: 'only', label: 'O', templateId: 'only', subNodes: [] }],
    };

    const { result: store } = renderHook(() => useTaskTreeStore());
    act(() => {
      store.current.setTaskTree(tree);
    });

    const handleSelectByPath = vi.fn();
    const { result } = renderHook(() => useNodeFinder({ handleSelectByPath }));

    act(() => {
      result.current('nope');
    });

    expect(handleSelectByPath).not.toHaveBeenCalled();
  });
});
