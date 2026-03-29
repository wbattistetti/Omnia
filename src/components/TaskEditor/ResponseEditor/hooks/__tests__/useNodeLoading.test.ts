// Tests for useNodeLoading: loads editor node from Zustand TaskTree + selectedPath / selectedRoot.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNodeLoading } from '@responseEditor/features/node-editing/hooks/useNodeLoading';
import { useTaskTreeStore } from '@responseEditor/core/state';
import type { Task, TaskTree } from '@types/taskTypes';

describe('useNodeLoading', () => {
  const mockSetSelectedNode = vi.fn();
  const mockSetSelectedNodePath = vi.fn();
  const mockGetStepsForNode = vi.fn();
  const mockGetStepsAsArray = vi.fn();

  const base = {
    introduction: null as unknown,
    task: null as Task | null,
    setSelectedNode: mockSetSelectedNode,
    setSelectedNodePath: mockSetSelectedNodePath,
    getStepsForNode: mockGetStepsForNode,
    getStepsAsArray: mockGetStepsAsArray,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetStepsForNode.mockReturnValue({});
    mockGetStepsAsArray.mockReturnValue([]);

    const { result } = renderHook(() => useTaskTreeStore());
    act(() => {
      result.current.reset();
    });
  });

  describe('empty TaskTree', () => {
    it('should not load node when TaskTree has no main nodes', () => {
      renderHook(() =>
        useNodeLoading({
          ...base,
          selectedPath: [0],
          selectedRoot: false,
        })
      );

      expect(mockSetSelectedNode).not.toHaveBeenCalled();
      expect(mockSetSelectedNodePath).not.toHaveBeenCalled();
    });
  });

  describe('root node loading', () => {
    it('should load root node with introduction when selectedRoot is true', () => {
      const taskTree: TaskTree = {
        id: 't',
        nodes: [{ id: 'node-1', label: 'L', templateId: 'node-1', subNodes: [] }],
        introduction: {
          type: 'introduction',
          escalations: [{ tasks: [{ id: 'task-1', type: 1 }] }],
        },
      };

      const { result: storeResult } = renderHook(() => useTaskTreeStore());
      act(() => {
        storeResult.current.setTaskTree(taskTree);
      });

      renderHook(() =>
        useNodeLoading({
          ...base,
          selectedPath: [],
          selectedRoot: true,
        })
      );

      expect(mockSetSelectedNode).toHaveBeenCalledWith(
        expect.objectContaining({
          steps: expect.arrayContaining([
            expect.objectContaining({
              type: 'introduction',
              escalations: expect.any(Array),
            }),
          ]),
        })
      );
      expect(mockSetSelectedNodePath).toHaveBeenCalledWith(null);
    });

    it('should load root node with empty introduction when introduction is missing', () => {
      const taskTree: TaskTree = {
        id: 't',
        nodes: [{ id: 'node-1', label: 'L', templateId: 'node-1', subNodes: [] }],
      };

      const { result: storeResult } = renderHook(() => useTaskTreeStore());
      act(() => {
        storeResult.current.setTaskTree(taskTree);
      });

      renderHook(() =>
        useNodeLoading({
          ...base,
          selectedPath: [],
          selectedRoot: true,
        })
      );

      expect(mockSetSelectedNode).toHaveBeenCalledWith(
        expect.objectContaining({
          steps: expect.arrayContaining([
            expect.objectContaining({
              type: 'introduction',
              escalations: [],
            }),
          ]),
        })
      );
    });
  });

  describe('main node loading', () => {
    it('should load main node when selectedPath is [0]', () => {
      const taskTree: TaskTree = {
        id: 't',
        nodes: [{ id: 'node-1', label: 'L', templateId: 'template-1', subNodes: [] }],
        steps: {
          'template-1': {
            start: { escalations: [] },
          },
        },
      };

      mockGetStepsForNode.mockReturnValue({
        start: { escalations: [] },
      });
      mockGetStepsAsArray.mockReturnValue([{ type: 'start', escalations: [] }]);

      const { result: storeResult } = renderHook(() => useTaskTreeStore());
      act(() => {
        storeResult.current.setTaskTree(taskTree);
      });

      renderHook(() =>
        useNodeLoading({
          ...base,
          selectedPath: [0],
          selectedRoot: false,
        })
      );

      expect(mockSetSelectedNode).toHaveBeenCalled();
      expect(mockSetSelectedNodePath).toHaveBeenCalledWith({ path: [0] });
    });

    it('should use node.id as fallback when templateId is missing', () => {
      const taskTree: TaskTree = {
        id: 't',
        nodes: [{ id: 'node-1', label: 'L', subNodes: [] }],
        steps: {
          'node-1': {
            start: { escalations: [] },
          },
        },
      };

      mockGetStepsForNode.mockReturnValue({
        start: { escalations: [] },
      });
      mockGetStepsAsArray.mockReturnValue([{ type: 'start', escalations: [] }]);

      const { result: storeResult } = renderHook(() => useTaskTreeStore());
      act(() => {
        storeResult.current.setTaskTree(taskTree);
      });

      renderHook(() =>
        useNodeLoading({
          ...base,
          selectedPath: [0],
          selectedRoot: false,
        })
      );

      expect(mockGetStepsForNode).toHaveBeenCalledWith(taskTree.steps, 'node-1');
    });
  });

  describe('sub-node loading', () => {
    it('should load sub-node when selectedPath is [0, 0]', () => {
      const taskTree: TaskTree = {
        id: 't',
        nodes: [
          {
            id: 'main-1',
            label: 'M',
            templateId: 'main-template-1',
            subNodes: [{ id: 'sub-1', label: 'S', templateId: 'sub-template-1', subNodes: [] }],
          },
        ],
        steps: {
          'sub-template-1': {
            start: { escalations: [] },
          },
        },
      };

      mockGetStepsForNode.mockReturnValue({
        start: { escalations: [] },
      });
      mockGetStepsAsArray.mockReturnValue([{ type: 'start', escalations: [] }]);

      const { result: storeResult } = renderHook(() => useTaskTreeStore());
      act(() => {
        storeResult.current.setTaskTree(taskTree);
      });

      renderHook(() =>
        useNodeLoading({
          ...base,
          selectedPath: [0, 0],
          selectedRoot: false,
        })
      );

      expect(mockSetSelectedNode).toHaveBeenCalled();
      expect(mockSetSelectedNodePath).toHaveBeenCalledWith({ path: [0, 0] });
    });

    it('should not load when sub-node path is invalid', () => {
      const taskTree: TaskTree = {
        id: 't',
        nodes: [
          {
            id: 'main-1',
            label: 'M',
            templateId: 'main-template-1',
            subNodes: [],
          },
        ],
        steps: {},
      };

      const { result: storeResult } = renderHook(() => useTaskTreeStore());
      act(() => {
        storeResult.current.setTaskTree(taskTree);
      });

      renderHook(() =>
        useNodeLoading({
          ...base,
          selectedPath: [0, 0],
          selectedRoot: false,
        })
      );

      expect(mockSetSelectedNode).not.toHaveBeenCalled();
    });
  });

  describe('steps integration', () => {
    it('should attach steps from taskTree.steps to loaded node', () => {
      const taskTree: TaskTree = {
        id: 't',
        nodes: [{ id: 'node-1', label: 'L', templateId: 'template-1', subNodes: [] }],
        steps: {
          'template-1': {
            start: { escalations: [] },
            noMatch: { escalations: [] },
          },
        },
      };

      mockGetStepsForNode.mockReturnValue({
        start: { escalations: [] },
        noMatch: { escalations: [] },
      });
      mockGetStepsAsArray.mockReturnValue([
        { type: 'start', escalations: [] },
        { type: 'noMatch', escalations: [] },
      ]);

      const { result: storeResult } = renderHook(() => useTaskTreeStore());
      act(() => {
        storeResult.current.setTaskTree(taskTree);
      });

      renderHook(() =>
        useNodeLoading({
          ...base,
          selectedPath: [0],
          selectedRoot: false,
        })
      );

      expect(mockGetStepsForNode).toHaveBeenCalledWith(taskTree.steps, 'template-1');
      expect(mockGetStepsAsArray).toHaveBeenCalled();
    });

    it('should use empty steps when node step types are empty', () => {
      const taskTree: TaskTree = {
        id: 't',
        nodes: [{ id: 'node-1', label: 'L', templateId: 'template-1', subNodes: [] }],
        steps: {
          'template-1': {},
        },
      };

      mockGetStepsForNode.mockReturnValue({});
      mockGetStepsAsArray.mockReturnValue([]);

      const { result: storeResult } = renderHook(() => useTaskTreeStore());
      act(() => {
        storeResult.current.setTaskTree(taskTree);
      });

      renderHook(() =>
        useNodeLoading({
          ...base,
          selectedPath: [0],
          selectedRoot: false,
        })
      );

      expect(mockGetStepsForNode).toHaveBeenCalledWith(taskTree.steps, 'template-1');
    });
  });

  describe('edge cases', () => {
    it('should not set node when main path index is out of range', () => {
      const taskTree: TaskTree = {
        id: 't',
        nodes: [{ id: 'node-1', label: 'L', templateId: 'n1', subNodes: [] }],
        steps: { n1: { start: { escalations: [] } } },
      };

      const { result: storeResult } = renderHook(() => useTaskTreeStore());
      act(() => {
        storeResult.current.setTaskTree(taskTree);
      });

      renderHook(() =>
        useNodeLoading({
          ...base,
          selectedPath: [999],
          selectedRoot: false,
        })
      );

      expect(mockSetSelectedNode).not.toHaveBeenCalled();
    });

    it('should handle store taskTree being null', () => {
      renderHook(() =>
        useNodeLoading({
          ...base,
          selectedPath: [0],
          selectedRoot: false,
        })
      );

      expect(mockSetSelectedNode).not.toHaveBeenCalled();
    });
  });
});
