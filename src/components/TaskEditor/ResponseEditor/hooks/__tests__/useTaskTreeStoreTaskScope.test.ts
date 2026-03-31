/**
 * Tests for useTaskTreeStoreTaskScope: store invalidation per task id and conditional hydration from props.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTaskTreeStore } from '@responseEditor/core/state';
import {
  useTaskTreeStoreTaskScope,
  __resetLastTaskTreeScopeTaskIdForTests,
} from '../useTaskTreeStoreTaskScope';
import type { TaskTree } from '@types/taskTypes';
import type { Task } from '@types/taskTypes';

const treeA: TaskTree = {
  labelKey: 'a',
  nodes: [{ id: 'n-a', label: 'A', templateId: 'n-a', subNodes: [] }],
  steps: {},
};

const treeB: TaskTree = {
  labelKey: 'b',
  nodes: [{ id: 'n-b', label: 'B', templateId: 'n-b', subNodes: [] }],
  steps: {},
};

function resetStore() {
  const { result } = renderHook(() => useTaskTreeStore());
  act(() => {
    result.current.reset();
  });
}

describe('useTaskTreeStoreTaskScope', () => {
  beforeEach(() => {
    resetStore();
    __resetLastTaskTreeScopeTaskIdForTests();
  });

  it('clears the store when task id changes (no re-hydration if prop taskTree is absent)', () => {
    const { result: storeResult } = renderHook(() => useTaskTreeStore());

    const { rerender } = renderHook(
      (props: { task: Task | null; taskTree?: TaskTree | null }) =>
        useTaskTreeStoreTaskScope({
          task: props.task,
          taskTree: props.taskTree,
          isTaskTreeLoading: false,
          taskWizardMode: 'none',
        }),
      {
        initialProps: {
          task: { id: 'task-1', type: 5 } as Task,
          taskTree: treeA as TaskTree | null,
        },
      }
    );

    expect(storeResult.current.taskTree).not.toBeNull();

    act(() => {
      rerender({ task: { id: 'task-2', type: 5 } as Task, taskTree: undefined });
    });

    expect(storeResult.current.taskTree).toBeNull();
  });

  it('hydrates from props when store is empty, not loading, manual mode', () => {
    const { result: storeResult } = renderHook(() => useTaskTreeStore());
    expect(storeResult.current.taskTree).toBeNull();

    renderHook(() =>
      useTaskTreeStoreTaskScope({
        task: { id: 'task-1', type: 5 } as Task,
        taskTree: treeA,
        isTaskTreeLoading: false,
        taskWizardMode: 'none',
      })
    );

    expect(storeResult.current.taskTree).not.toBeNull();
    expect(storeResult.current.taskTree?.labelKey).toBe(treeA.labelKey);
  });

  it('does not hydrate while isTaskTreeLoading is true', () => {
    const { result: storeResult } = renderHook(() => useTaskTreeStore());
    renderHook(() =>
      useTaskTreeStoreTaskScope({
        task: { id: 'task-1', type: 5 } as Task,
        taskTree: treeA,
        isTaskTreeLoading: true,
        taskWizardMode: 'none',
      })
    );
    expect(storeResult.current.taskTree).toBeNull();
  });

  it('does not hydrate when needsTaskBuilder is true', () => {
    const { result: storeResult } = renderHook(() => useTaskTreeStore());
    renderHook(() =>
      useTaskTreeStoreTaskScope({
        task: { id: 'task-1', type: 5, needsTaskBuilder: true } as Task,
        taskTree: treeA,
        isTaskTreeLoading: false,
        taskWizardMode: 'none',
      })
    );
    expect(storeResult.current.taskTree).toBeNull();
  });

  it('does not hydrate in adaptation or full wizard mode', () => {
    const { result: storeResult } = renderHook(() => useTaskTreeStore());

    renderHook(() =>
      useTaskTreeStoreTaskScope({
        task: { id: 'task-1', type: 5 } as Task,
        taskTree: treeA,
        isTaskTreeLoading: false,
        taskWizardMode: 'adaptation',
      })
    );
    expect(storeResult.current.taskTree).toBeNull();

    act(() => {
      storeResult.current.reset();
    });

    renderHook(() =>
      useTaskTreeStoreTaskScope({
        task: { id: 'task-2', type: 5 } as Task,
        taskTree: treeB,
        isTaskTreeLoading: false,
        taskWizardMode: 'full',
      })
    );
    expect(storeResult.current.taskTree).toBeNull();
  });

  it('does not replace an existing store tree when the same task gets a new prop snapshot', () => {
    const { result: storeResult } = renderHook(() => useTaskTreeStore());

    const { rerender } = renderHook(
      (props: { taskTree: TaskTree | null | undefined }) =>
        useTaskTreeStoreTaskScope({
          task: { id: 'task-1', type: 5 } as Task,
          taskTree: props.taskTree,
          isTaskTreeLoading: false,
          taskWizardMode: 'none',
        }),
      { initialProps: { taskTree: treeA as TaskTree | null | undefined } }
    );

    const firstKey = storeResult.current.taskTree?.labelKey;
    expect(firstKey).toBe('a');

    act(() => {
      rerender({ taskTree: treeB });
    });

    expect(storeResult.current.taskTree?.labelKey).toBe('a');
  });

  it('does not clear the store when the hook remounts with the same task id', () => {
    const { result: storeResult } = renderHook(() => useTaskTreeStore());

    const { unmount } = renderHook(() =>
      useTaskTreeStoreTaskScope({
        task: { id: 'task-1', type: 5 } as Task,
        taskTree: treeA,
        isTaskTreeLoading: false,
        taskWizardMode: 'none',
      })
    );

    expect(storeResult.current.taskTree?.labelKey).toBe('a');

    unmount();

    renderHook(() =>
      useTaskTreeStoreTaskScope({
        task: { id: 'task-1', type: 5 } as Task,
        taskTree: treeA,
        isTaskTreeLoading: false,
        taskWizardMode: 'none',
      })
    );

    expect(storeResult.current.taskTree?.labelKey).toBe('a');
  });
});
