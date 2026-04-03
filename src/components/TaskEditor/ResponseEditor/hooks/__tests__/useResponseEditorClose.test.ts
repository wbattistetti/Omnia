// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useResponseEditorClose } from '@responseEditor/hooks/useResponseEditorClose';
import { useTaskTreeStore } from '@responseEditor/core/state';
import type { Task, TaskTree } from '@types/taskTypes';

/**
 * Tests for useResponseEditorClose
 *
 * This hook handles the complex logic of closing the ResponseEditor, including:
 * - Contract change validation and dialog management
 * - Saving the current state before closing
 * - Dock tab closure coordination
 *
 * We test the critical flows: normal close, close with unsaved changes, and save behavior.
 */

// Mock dependencies (module id must match useResponseEditorClose imports)
vi.mock('@responseEditor/core/persistence/ResponseEditorPersistence', () => ({
  saveTaskToRepository: vi.fn(),
  saveTaskOnEditorClose: vi.fn(),
}));

vi.mock('../../ddtSelectors', () => ({
  getdataList: vi.fn(),
}));

vi.mock('../../../../../dock/ops', () => ({
  closeTab: vi.fn(),
}));

import { saveTaskOnEditorClose, saveTaskToRepository } from '@responseEditor/core/persistence/ResponseEditorPersistence';
import { getdataList } from '@responseEditor/ddtSelectors';
import { closeTab } from '@dock/ops';

describe('useResponseEditorClose', () => {
  const mockSetPendingContractChange = vi.fn();
  const mockSetDockTree = vi.fn();
  const mockOnClose = vi.fn();
  const mockReplaceSelectedDDT = vi.fn();

  const defaultParams = {
    contractChangeRef: { current: null },
    setPendingContractChange: mockSetPendingContractChange,
    selectedNode: null,
    selectedNodePath: null,
    selectedRoot: false,
    task: null,
    // ✅ FASE 3: taskTreeRef rimosso - store è single source of truth
    currentProjectId: 'proj-1',
    tabId: undefined,
    setDockTree: mockSetDockTree,
    onClose: mockOnClose,
    replaceSelectedDDT: mockReplaceSelectedDDT,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (getdataList as any).mockReturnValue([]);
    (saveTaskOnEditorClose as any).mockResolvedValue(undefined);
    (saveTaskToRepository as any).mockResolvedValue(undefined);

    // ✅ FASE 3: Reset store before each test
    const { result } = renderHook(() => useTaskTreeStore());
    act(() => {
      result.current.reset();
    });
  });

  describe('normal close (no contract changes)', () => {
    const seedMinimalTaskTree = () => {
      const { result: storeResult } = renderHook(() => useTaskTreeStore());
      act(() => {
        storeResult.current.setTaskTree({ nodes: [{ id: 'node-1', templateId: 'template-1' }] });
      });
    };

    it('should return true when there are no contract changes', async () => {
      seedMinimalTaskTree();
      const { result } = renderHook(() =>
        useResponseEditorClose({
          ...defaultParams,
          contractChangeRef: { current: null },
        })
      );

      const closeResult = await result.current();

      expect(closeResult).toBe(true);
      expect(mockSetPendingContractChange).not.toHaveBeenCalled();
    });

    it('should return true when contractChange has no unsaved changes', async () => {
      seedMinimalTaskTree();
      const { result } = renderHook(() =>
        useResponseEditorClose({
          ...defaultParams,
          contractChangeRef: {
            current: {
              hasUnsavedChanges: false,
              modifiedContract: null,
              originalContract: null,
              nodeTemplateId: 'node-1',
              nodeLabel: 'Node 1',
            },
          },
        })
      );

      const closeResult = await result.current();

      expect(closeResult).toBe(true);
    });
  });

  describe('close with unsaved contract changes', () => {
    it('should auto-keep contract edits, clear pending, and continue close when TaskTree exists', async () => {
      const task: Task = {
        id: 'task-1',
        type: 1,
        steps: {},
      };

      const taskTree: TaskTree = {
        nodes: [{ id: 'node-1', templateId: 'template-1' }],
      };

      (getdataList as any).mockReturnValue([{ id: 'node-1', templateId: 'template-1' }]);

      const { result: storeResult } = renderHook(() => useTaskTreeStore());
      act(() => {
        storeResult.current.setTaskTree(taskTree);
      });

      const contractRef = {
        current: {
          hasUnsavedChanges: true,
          modifiedContract: { type: 'regex', patterns: ['new-pattern'] },
          originalContract: { type: 'regex', patterns: ['old-pattern'] },
          nodeTemplateId: 'template-1',
          nodeLabel: 'Node 1',
        },
      };

      const { result } = renderHook(() =>
        useResponseEditorClose({
          ...defaultParams,
          task,
          contractChangeRef: contractRef,
        })
      );

      const closeResult = await result.current();

      expect(closeResult).toBe(true);
      expect(mockSetPendingContractChange).toHaveBeenCalledWith(null);
      expect(contractRef.current.hasUnsavedChanges).toBe(false);
      expect(saveTaskOnEditorClose).toHaveBeenCalled();
    });

    it('should auto-keep contract edits and close tab when no TaskTree (same as old dialog Mantieni)', async () => {
      mockSetDockTree.mockImplementation((updater: (prev: unknown) => unknown) => {
        return updater({ kind: 'tabset', id: 'ts', tabs: [], active: 0 });
      });
      const contractRef = {
        current: {
          hasUnsavedChanges: true,
          modifiedContract: { type: 'regex', patterns: ['new-pattern'] },
          originalContract: { type: 'regex', patterns: ['old-pattern'] },
          nodeTemplateId: 'template-1',
          nodeLabel: 'Node 1',
        },
      };

      const { result } = renderHook(() =>
        useResponseEditorClose({
          ...defaultParams,
          contractChangeRef: contractRef,
          tabId: 'tab-1',
          setDockTree: mockSetDockTree,
        })
      );

      const closeResult = await result.current();

      expect(closeResult).toBe(true);
      expect(mockSetPendingContractChange).toHaveBeenCalledWith(null);
      expect(closeTab).toHaveBeenCalled();
      expect(contractRef.current.hasUnsavedChanges).toBe(false);
      mockSetDockTree.mockReset();
    });

    it('should not show dialog when hasUnsavedChanges is true but modifiedContract is null', async () => {
      const { result: storeResult } = renderHook(() => useTaskTreeStore());
      act(() => {
        storeResult.current.setTaskTree({ nodes: [{ id: 'node-1', templateId: 'template-1' }] });
      });
      const { result } = renderHook(() =>
        useResponseEditorClose({
          ...defaultParams,
          contractChangeRef: {
            current: {
              hasUnsavedChanges: true,
              modifiedContract: null,
              originalContract: null,
              nodeTemplateId: 'template-1',
              nodeLabel: 'Node 1',
            },
          },
        })
      );

      const closeResult = await result.current();

      expect(closeResult).toBe(true);
    });

    it('should not show dialog when hasUnsavedChanges is true but nodeTemplateId is missing', async () => {
      const { result: storeResult } = renderHook(() => useTaskTreeStore());
      act(() => {
        storeResult.current.setTaskTree({ nodes: [{ id: 'node-1', templateId: 'template-1' }] });
      });
      const { result } = renderHook(() =>
        useResponseEditorClose({
          ...defaultParams,
          contractChangeRef: {
            current: {
              hasUnsavedChanges: true,
              modifiedContract: { type: 'regex', patterns: ['new-pattern'] },
              originalContract: null,
              nodeTemplateId: undefined,
              nodeLabel: 'Node 1',
            },
          },
        })
      );

      const closeResult = await result.current();

      expect(closeResult).toBe(true);
    });
  });

  describe('save behavior', () => {
    it('should save task when task has id and TaskTree has nodes', async () => {
      const task: Task = {
        id: 'task-1',
        type: 1,
        steps: {},
      };

      const taskTree: TaskTree = {
        nodes: [{ id: 'node-1', templateId: 'template-1' }],
      };

      (getdataList as any).mockReturnValue([{ id: 'node-1', templateId: 'template-1' }]);

      // ✅ FASE 3: Set taskTree in store instead of using taskTreeRef
      const { result: storeResult } = renderHook(() => useTaskTreeStore());
      act(() => {
        storeResult.current.setTaskTree(taskTree);
      });

      const { result } = renderHook(() =>
        useResponseEditorClose({
          ...defaultParams,
          task,
        })
      );

      await result.current();

      expect(saveTaskOnEditorClose).toHaveBeenCalledWith(
        'task-1',
        expect.objectContaining({
          nodes: expect.any(Array),
          steps: expect.any(Object),
        }),
        task,
        'proj-1',
        undefined
      );
    });

    it('should save task when task has instanceId', async () => {
      const task = {
        instanceId: 'instance-1',
        type: 1,
        steps: {},
      } as any;

      const taskTree: TaskTree = {
        nodes: [{ id: 'node-1', templateId: 'template-1' }],
      };

      (getdataList as any).mockReturnValue([{ id: 'node-1', templateId: 'template-1' }]);

      // ✅ FASE 3: Set taskTree in store instead of using taskTreeRef
      const { result: storeResult } = renderHook(() => useTaskTreeStore());
      act(() => {
        storeResult.current.setTaskTree(taskTree);
      });

      const { result } = renderHook(() =>
        useResponseEditorClose({
          ...defaultParams,
          task,
        })
      );

      await result.current();

      expect(saveTaskOnEditorClose).toHaveBeenCalledWith(
        'instance-1',
        expect.any(Object),
        task,
        'proj-1',
        undefined
      );
    });

    it('should not save when task has no id or instanceId', async () => {
      const { result } = renderHook(() =>
        useResponseEditorClose({
          ...defaultParams,
          task: null,
        })
      );

      await result.current();

      expect(saveTaskOnEditorClose).not.toHaveBeenCalled();
      expect(saveTaskToRepository).not.toHaveBeenCalled();
    });

    it('should not save when TaskTree has no nodes', async () => {
      const task: Task = {
        id: 'task-1',
        type: 1,
        steps: {},
      };

      const taskTree: TaskTree = {
        nodes: [],
      };

      (getdataList as any).mockReturnValue([]);

      // ✅ FASE 3: Set taskTree in store instead of using taskTreeRef
      const { result: storeResult } = renderHook(() => useTaskTreeStore());
      act(() => {
        storeResult.current.setTaskTree(taskTree);
      });

      const { result } = renderHook(() =>
        useResponseEditorClose({
          ...defaultParams,
          task,
        })
      );

      await result.current();

      expect(saveTaskOnEditorClose).not.toHaveBeenCalled();
    });

    it('should save TaskTree steps from task.steps', async () => {
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

      const taskTree: TaskTree = {
        nodes: [{ id: 'node-1', templateId: 'template-1' }],
      };

      (getdataList as any).mockReturnValue([{ id: 'node-1', templateId: 'template-1' }]);

      // ✅ FASE 3: Set taskTree in store instead of using taskTreeRef
      const { result: storeResult } = renderHook(() => useTaskTreeStore());
      act(() => {
        storeResult.current.setTaskTree(taskTree);
      });

      const { result } = renderHook(() =>
        useResponseEditorClose({
          ...defaultParams,
          task,
        })
      );

      await result.current();

      expect(saveTaskOnEditorClose).toHaveBeenCalledWith(
        'task-1',
        expect.objectContaining({
          steps: task.steps,
        }),
        task,
        'proj-1',
        undefined
      );
    });
  });

  describe('replaceSelectedDDT behavior', () => {
    it('should call replaceSelectedDDT when task is null', async () => {
      const taskTree: TaskTree = {
        nodes: [{ id: 'node-1', templateId: 'template-1' }],
      };

      (getdataList as any).mockReturnValue([{ id: 'node-1', templateId: 'template-1' }]);

      // ✅ FASE 3: Set taskTree in store instead of using taskTreeRef
      const { result: storeResult } = renderHook(() => useTaskTreeStore());
      act(() => {
        storeResult.current.setTaskTree(taskTree);
      });

      const { result } = renderHook(() =>
        useResponseEditorClose({
          ...defaultParams,
          task: null,
          replaceSelectedDDT: mockReplaceSelectedDDT,
        })
      );

      await result.current();

      expect(mockReplaceSelectedDDT).toHaveBeenCalled();
    });

    it('should not call replaceSelectedDDT when task is provided', async () => {
      const task: Task = {
        id: 'task-1',
        type: 1,
        steps: {},
      };

      const taskTree: TaskTree = {
        nodes: [{ id: 'node-1', templateId: 'template-1' }],
      };

      (getdataList as any).mockReturnValue([{ id: 'node-1', templateId: 'template-1' }]);

      // ✅ FASE 3: Set taskTree in store instead of using taskTreeRef
      const { result: storeResult } = renderHook(() => useTaskTreeStore());
      act(() => {
        storeResult.current.setTaskTree(taskTree);
      });

      const { result } = renderHook(() =>
        useResponseEditorClose({
          ...defaultParams,
          task,
          replaceSelectedDDT: mockReplaceSelectedDDT,
        })
      );

      await result.current();

      expect(mockReplaceSelectedDDT).not.toHaveBeenCalled();
    });
  });

  describe('selectedNode save behavior', () => {
    it('should save root node introduction when it has tasks', async () => {
      const taskTree: TaskTree = {
        nodes: [{ id: 'root' }],
      };

      (getdataList as any).mockReturnValue([{ id: 'root' }]);

      const selectedNode = {
        id: 'root',
        steps: [
          {
            type: 'introduction',
            escalations: [
              {
                tasks: [{ id: 'task-1', type: 1 }],
              },
            ],
          },
        ],
      };

      // ✅ FASE 3: Set taskTree in store instead of using taskTreeRef
      const { result: storeResult } = renderHook(() => useTaskTreeStore());
      act(() => {
        storeResult.current.setTaskTree(taskTree);
      });

      const { result } = renderHook(() =>
        useResponseEditorClose({
          ...defaultParams,
          selectedNode,
          selectedNodePath: { mainIndex: 0 },
          selectedRoot: true,
        })
      );

      await result.current();

      // ✅ FASE 3: Check store instead of taskTreeRef
      expect(storeResult.current.taskTree?.introduction).toBeDefined();
      expect(storeResult.current.taskTree?.introduction?.escalations).toHaveLength(1);
    });

    it('should remove introduction when root node has no tasks', async () => {
      const taskTree: TaskTree = {
        nodes: [{ id: 'root' }],
        introduction: { type: 'introduction', escalations: [] },
      };

      (getdataList as any).mockReturnValue([{ id: 'root' }]);

      const selectedNode = {
        id: 'root',
        steps: [
          {
            type: 'introduction',
            escalations: [],
          },
        ],
      };

      // ✅ FASE 3: Set taskTree in store instead of using taskTreeRef
      const { result: storeResult } = renderHook(() => useTaskTreeStore());
      act(() => {
        storeResult.current.setTaskTree(taskTree);
      });

      const { result } = renderHook(() =>
        useResponseEditorClose({
          ...defaultParams,
          selectedNode,
          selectedNodePath: { mainIndex: 0 },
          selectedRoot: true,
        })
      );

      await result.current();

      // ✅ FASE 3: Check store instead of taskTreeRef
      expect(storeResult.current.taskTree?.introduction).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('should return true even if save fails', async () => {
      const task: Task = {
        id: 'task-1',
        type: 1,
        steps: {},
      };

      const taskTree: TaskTree = {
        nodes: [{ id: 'node-1', templateId: 'template-1' }],
      };

      (getdataList as any).mockReturnValue([{ id: 'node-1', templateId: 'template-1' }]);
      (saveTaskOnEditorClose as any).mockRejectedValue(new Error('Save failed'));

      // ✅ FASE 3: Set taskTree in store instead of using taskTreeRef
      const { result: storeResult } = renderHook(() => useTaskTreeStore());
      act(() => {
        storeResult.current.setTaskTree(taskTree);
      });

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() =>
        useResponseEditorClose({
          ...defaultParams,
          task,
        })
      );

      const closeResult = await result.current();

      expect(closeResult).toBe(true);
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });
});
