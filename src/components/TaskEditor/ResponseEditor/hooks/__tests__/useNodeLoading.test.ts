// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useNodeLoading } from '../useNodeLoading';
import type { Task, TaskTree } from '../../../../types/taskTypes';

/**
 * Tests for useNodeLoading
 *
 * This hook loads the selected node from taskTreeRef when selection changes.
 * It handles root nodes, main nodes, and sub-nodes, setting selectedNode and selectedNodePath.
 */

// Mock dependencies
vi.mock('../../ddtSelectors', () => ({
  getdataList: vi.fn(),
  getSubDataList: vi.fn(),
}));

import { getdataList, getSubDataList } from '../../ddtSelectors';

describe('useNodeLoading', () => {
  const mockSetSelectedNode = vi.fn();
  const mockSetSelectedNodePath = vi.fn();
  const mockGetStepsForNode = vi.fn();
  const mockGetStepsAsArray = vi.fn();

  const defaultParams = {
    selectedMainIndex: 0,
    selectedSubIndex: null,
    selectedRoot: false,
    introduction: null,
    task: null,
    taskTree: null,
    taskTreeRef: { current: null },
    setSelectedNode: mockSetSelectedNode,
    setSelectedNodePath: mockSetSelectedNodePath,
    getStepsForNode: mockGetStepsForNode,
    getStepsAsArray: mockGetStepsAsArray,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (getdataList as any).mockReturnValue([]);
    (getSubDataList as any).mockReturnValue([]);
    (mockGetStepsForNode as any).mockReturnValue({});
    (mockGetStepsAsArray as any).mockReturnValue([]);
  });

  describe('empty TaskTree', () => {
    it('should not load node when TaskTree is empty', () => {
      (getdataList as any).mockReturnValue([]);

      renderHook(() => useNodeLoading(defaultParams));

      expect(mockSetSelectedNode).not.toHaveBeenCalled();
      expect(mockSetSelectedNodePath).not.toHaveBeenCalled();
    });
  });

  describe('root node loading', () => {
    it('should load root node with introduction when selectedRoot is true', () => {
      const taskTree: TaskTree = {
        nodes: [{ id: 'node-1' }],
        introduction: {
          type: 'introduction',
          escalations: [
            {
              tasks: [{ id: 'task-1', type: 1 }],
            },
          ],
        },
      };

      (getdataList as any).mockReturnValue([{ id: 'node-1' }]);

      const taskTreeRef = { current: taskTree };

      renderHook(() =>
        useNodeLoading({
          ...defaultParams,
          selectedRoot: true,
          taskTreeRef,
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
        nodes: [{ id: 'node-1' }],
      };

      (getdataList as any).mockReturnValue([{ id: 'node-1' }]);

      const taskTreeRef = { current: taskTree };

      renderHook(() =>
        useNodeLoading({
          ...defaultParams,
          selectedRoot: true,
          taskTreeRef,
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
    it('should load main node when selectedSubIndex is null', () => {
      const taskTree: TaskTree = {
        nodes: [{ id: 'node-1', templateId: 'template-1' }],
      };

      const task: Task = {
        id: 'task-1',
        type: 1,
        steps: {
          'template-1': {
            start: { escalations: [] },
          },
        },
      };

      (getdataList as any).mockReturnValue([{ id: 'node-1', templateId: 'template-1' }]);
      (mockGetStepsForNode as any).mockReturnValue({
        start: { escalations: [] },
      });
      (mockGetStepsAsArray as any).mockReturnValue([
        { type: 'start', escalations: [] },
      ]);

      const taskTreeRef = { current: taskTree };

      renderHook(() =>
        useNodeLoading({
          ...defaultParams,
          selectedMainIndex: 0,
          selectedSubIndex: null,
          task,
          taskTreeRef,
        })
      );

      expect(mockSetSelectedNode).toHaveBeenCalled();
      expect(mockSetSelectedNodePath).toHaveBeenCalledWith({ mainIndex: 0, subIndex: null });
    });

    it('should use node.id as fallback when templateId is missing', () => {
      const taskTree: TaskTree = {
        nodes: [{ id: 'node-1' }],
      };

      const task: Task = {
        id: 'task-1',
        type: 1,
        steps: {
          'node-1': {
            start: { escalations: [] },
          },
        },
      };

      (getdataList as any).mockReturnValue([{ id: 'node-1' }]);
      (mockGetStepsForNode as any).mockReturnValue({
        start: { escalations: [] },
      });
      (mockGetStepsAsArray as any).mockReturnValue([
        { type: 'start', escalations: [] },
      ]);

      const taskTreeRef = { current: taskTree };

      renderHook(() =>
        useNodeLoading({
          ...defaultParams,
          selectedMainIndex: 0,
          selectedSubIndex: null,
          task,
          taskTreeRef,
        })
      );

      expect(mockGetStepsForNode).toHaveBeenCalledWith(task.steps, 'node-1');
    });
  });

  describe('sub-node loading', () => {
    it('should load sub-node when selectedSubIndex is provided', () => {
      const taskTree: TaskTree = {
        nodes: [
          {
            id: 'main-1',
            templateId: 'main-template-1',
            subData: [
              { id: 'sub-1', templateId: 'sub-template-1' },
            ],
          },
        ],
      };

      const task: Task = {
        id: 'task-1',
        type: 1,
        steps: {
          'sub-template-1': {
            start: { escalations: [] },
          },
        },
      };

      (getdataList as any).mockReturnValue([
        {
          id: 'main-1',
          templateId: 'main-template-1',
          subData: [{ id: 'sub-1', templateId: 'sub-template-1' }],
        },
      ]);
      (getSubDataList as any).mockReturnValue([
        { id: 'sub-1', templateId: 'sub-template-1' },
      ]);
      (mockGetStepsForNode as any).mockReturnValue({
        start: { escalations: [] },
      });
      (mockGetStepsAsArray as any).mockReturnValue([
        { type: 'start', escalations: [] },
      ]);

      const taskTreeRef = { current: taskTree };

      renderHook(() =>
        useNodeLoading({
          ...defaultParams,
          selectedMainIndex: 0,
          selectedSubIndex: 0,
          task,
          taskTreeRef,
        })
      );

      expect(mockSetSelectedNode).toHaveBeenCalled();
      expect(mockSetSelectedNodePath).toHaveBeenCalledWith({ mainIndex: 0, subIndex: 0 });
    });

    it('should not load when sub-node is not found', () => {
      const taskTree: TaskTree = {
        nodes: [
          {
            id: 'main-1',
            templateId: 'main-template-1',
          },
        ],
      };

      (getdataList as any).mockReturnValue([
        { id: 'main-1', templateId: 'main-template-1' },
      ]);
      (getSubDataList as any).mockReturnValue([]);

      const taskTreeRef = { current: taskTree };

      renderHook(() =>
        useNodeLoading({
          ...defaultParams,
          selectedMainIndex: 0,
          selectedSubIndex: 0,
          taskTreeRef,
        })
      );

      expect(mockSetSelectedNode).not.toHaveBeenCalled();
    });
  });

  describe('steps integration', () => {
    it('should attach steps from task.steps to loaded node', () => {
      const taskTree: TaskTree = {
        nodes: [{ id: 'node-1', templateId: 'template-1' }],
      };

      const task: Task = {
        id: 'task-1',
        type: 1,
        steps: {
          'template-1': {
            start: { escalations: [] },
            noMatch: { escalations: [] },
          },
        },
      };

      (getdataList as any).mockReturnValue([{ id: 'node-1', templateId: 'template-1' }]);
      (mockGetStepsForNode as any).mockReturnValue({
        start: { escalations: [] },
        noMatch: { escalations: [] },
      });
      (mockGetStepsAsArray as any).mockReturnValue([
        { type: 'start', escalations: [] },
        { type: 'noMatch', escalations: [] },
      ]);

      const taskTreeRef = { current: taskTree };

      renderHook(() =>
        useNodeLoading({
          ...defaultParams,
          selectedMainIndex: 0,
          task,
          taskTreeRef,
        })
      );

      expect(mockGetStepsForNode).toHaveBeenCalledWith(task.steps, 'template-1');
      expect(mockGetStepsAsArray).toHaveBeenCalled();
    });

    it('should use empty steps when task.steps is missing', () => {
      const taskTree: TaskTree = {
        nodes: [{ id: 'node-1', templateId: 'template-1' }],
      };

      (getdataList as any).mockReturnValue([{ id: 'node-1', templateId: 'template-1' }]);
      (mockGetStepsForNode as any).mockReturnValue({});
      (mockGetStepsAsArray as any).mockReturnValue([]);

      const taskTreeRef = { current: taskTree };

      renderHook(() =>
        useNodeLoading({
          ...defaultParams,
          selectedMainIndex: 0,
          task: null,
          taskTreeRef,
        })
      );

      expect(mockGetStepsForNode).toHaveBeenCalledWith(undefined, 'template-1');
    });
  });

  describe('edge cases', () => {
    it('should handle out-of-bounds mainIndex gracefully', () => {
      const taskTree: TaskTree = {
        nodes: [{ id: 'node-1' }],
      };

      (getdataList as any).mockReturnValue([{ id: 'node-1' }]);

      const taskTreeRef = { current: taskTree };

      renderHook(() =>
        useNodeLoading({
          ...defaultParams,
          selectedMainIndex: 999,
          taskTreeRef,
        })
      );

      // Should not crash, but may not set node if index is invalid
      // Behavior depends on getdataList implementation
    });

    it('should handle taskTreeRef.current being null', () => {
      (getdataList as any).mockReturnValue([]);

      renderHook(() =>
        useNodeLoading({
          ...defaultParams,
          taskTreeRef: { current: null },
        })
      );

      expect(mockSetSelectedNode).not.toHaveBeenCalled();
    });
  });
});
