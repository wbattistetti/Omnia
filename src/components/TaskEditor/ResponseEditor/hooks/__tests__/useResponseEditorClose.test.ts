// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useResponseEditorClose } from '@responseEditor/hooks/useResponseEditorClose';
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

// Mock dependencies
vi.mock('../../modules/ResponseEditor/persistence/ResponseEditorPersistence', () => ({
  saveTaskToRepository: vi.fn(),
  saveTaskOnEditorClose: vi.fn(),
}));

vi.mock('../../ddtSelectors', () => ({
  getdataList: vi.fn(),
}));

vi.mock('../../../../../services/DialogueTaskService', () => ({
  default: {
    getTemplate: vi.fn(),
  },
}));

vi.mock('../../../../../dock/ops', () => ({
  closeTab: vi.fn(),
}));

import { saveTaskOnEditorClose, saveTaskToRepository } from '@responseEditor/features/persistence/ResponseEditorPersistence';
import { getdataList } from '@responseEditor/ddtSelectors';
import DialogueTaskService from '@services/DialogueTaskService';
import { closeTab } from '@dock/ops';

describe('useResponseEditorClose', () => {
  const mockSetPendingContractChange = vi.fn();
  const mockSetShowContractDialog = vi.fn();
  const mockSetDockTree = vi.fn();
  const mockOnClose = vi.fn();
  const mockReplaceSelectedDDT = vi.fn();

  const defaultParams = {
    contractChangeRef: { current: null },
    setPendingContractChange: mockSetPendingContractChange,
    setShowContractDialog: mockSetShowContractDialog,
    selectedNode: null,
    selectedNodePath: null,
    selectedRoot: false,
    task: null,
    taskTreeRef: { current: null },
    currentProjectId: 'proj-1',
    tabId: undefined,
    setDockTree: mockSetDockTree,
    onClose: mockOnClose,
    replaceSelectedDDT: mockReplaceSelectedDDT,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (getdataList as any).mockReturnValue([]);
    (DialogueTaskService.getTemplate as any).mockReturnValue(null);
    (saveTaskOnEditorClose as any).mockResolvedValue(undefined);
    (saveTaskToRepository as any).mockResolvedValue(undefined);
  });

  describe('normal close (no contract changes)', () => {
    it('should return true when there are no contract changes', async () => {
      const { result } = renderHook(() =>
        useResponseEditorClose({
          ...defaultParams,
          contractChangeRef: { current: null },
        })
      );

      const closeResult = await result.current();

      expect(closeResult).toBe(true);
      expect(mockSetShowContractDialog).not.toHaveBeenCalled();
      expect(mockSetPendingContractChange).not.toHaveBeenCalled();
    });

    it('should return true when contractChange has no unsaved changes', async () => {
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
      expect(mockSetShowContractDialog).not.toHaveBeenCalled();
    });
  });

  describe('close with unsaved contract changes', () => {
    it('should show dialog and return false when contract changes are unsaved', async () => {
      const mockTemplate = {
        id: 'template-1',
        label: 'Template 1',
      };

      (DialogueTaskService.getTemplate as any).mockReturnValue(mockTemplate);

      const { result } = renderHook(() =>
        useResponseEditorClose({
          ...defaultParams,
          contractChangeRef: {
            current: {
              hasUnsavedChanges: true,
              modifiedContract: { type: 'regex', patterns: ['new-pattern'] },
              originalContract: { type: 'regex', patterns: ['old-pattern'] },
              nodeTemplateId: 'template-1',
              nodeLabel: 'Node 1',
            },
          },
        })
      );

      const closeResult = await result.current();

      expect(closeResult).toBe(false);
      expect(mockSetPendingContractChange).toHaveBeenCalledWith({
        templateId: 'template-1',
        templateLabel: 'Template 1',
        modifiedContract: { type: 'regex', patterns: ['new-pattern'] },
      });
      expect(mockSetShowContractDialog).toHaveBeenCalledWith(true);
    });

    it('should use nodeLabel as fallback when template is not found', async () => {
      (DialogueTaskService.getTemplate as any).mockReturnValue(null);

      const { result } = renderHook(() =>
        useResponseEditorClose({
          ...defaultParams,
          contractChangeRef: {
            current: {
              hasUnsavedChanges: true,
              modifiedContract: { type: 'regex', patterns: ['new-pattern'] },
              originalContract: { type: 'regex', patterns: ['old-pattern'] },
              nodeTemplateId: 'template-1',
              nodeLabel: 'Node 1',
            },
          },
        })
      );

      await result.current();

      expect(mockSetPendingContractChange).toHaveBeenCalledWith({
        templateId: 'template-1',
        templateLabel: 'Node 1',
        modifiedContract: { type: 'regex', patterns: ['new-pattern'] },
      });
    });

    it('should not show dialog when hasUnsavedChanges is true but modifiedContract is null', async () => {
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
      expect(mockSetShowContractDialog).not.toHaveBeenCalled();
    });

    it('should not show dialog when hasUnsavedChanges is true but nodeTemplateId is missing', async () => {
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
      expect(mockSetShowContractDialog).not.toHaveBeenCalled();
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

      const taskTreeRef = { current: taskTree };

      const { result } = renderHook(() =>
        useResponseEditorClose({
          ...defaultParams,
          task,
          taskTreeRef,
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
        'proj-1'
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

      const taskTreeRef = { current: taskTree };

      const { result } = renderHook(() =>
        useResponseEditorClose({
          ...defaultParams,
          task,
          taskTreeRef,
        })
      );

      await result.current();

      expect(saveTaskOnEditorClose).toHaveBeenCalledWith(
        'instance-1',
        expect.any(Object),
        task,
        'proj-1'
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

      const taskTreeRef = { current: taskTree };

      const { result } = renderHook(() =>
        useResponseEditorClose({
          ...defaultParams,
          task,
          taskTreeRef,
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

      const taskTreeRef = { current: taskTree };

      const { result } = renderHook(() =>
        useResponseEditorClose({
          ...defaultParams,
          task,
          taskTreeRef,
        })
      );

      await result.current();

      expect(saveTaskOnEditorClose).toHaveBeenCalledWith(
        'task-1',
        expect.objectContaining({
          steps: task.steps,
        }),
        task,
        'proj-1'
      );
    });
  });

  describe('replaceSelectedDDT behavior', () => {
    it('should call replaceSelectedDDT when task is null', async () => {
      const taskTree: TaskTree = {
        nodes: [{ id: 'node-1', templateId: 'template-1' }],
      };

      (getdataList as any).mockReturnValue([{ id: 'node-1', templateId: 'template-1' }]);

      const taskTreeRef = { current: taskTree };

      const { result } = renderHook(() =>
        useResponseEditorClose({
          ...defaultParams,
          task: null,
          taskTreeRef,
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

      const taskTreeRef = { current: taskTree };

      const { result } = renderHook(() =>
        useResponseEditorClose({
          ...defaultParams,
          task,
          taskTreeRef,
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

      const taskTreeRef = { current: taskTree };

      const { result } = renderHook(() =>
        useResponseEditorClose({
          ...defaultParams,
          selectedNode,
          selectedNodePath: { mainIndex: 0 },
          selectedRoot: true,
          taskTreeRef,
        })
      );

      await result.current();

      expect(taskTreeRef.current?.introduction).toBeDefined();
      expect(taskTreeRef.current?.introduction?.escalations).toHaveLength(1);
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

      const taskTreeRef = { current: taskTree };

      const { result } = renderHook(() =>
        useResponseEditorClose({
          ...defaultParams,
          selectedNode,
          selectedNodePath: { mainIndex: 0 },
          selectedRoot: true,
          taskTreeRef,
        })
      );

      await result.current();

      expect(taskTreeRef.current?.introduction).toBeUndefined();
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

      const taskTreeRef = { current: taskTree };

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() =>
        useResponseEditorClose({
          ...defaultParams,
          task,
          taskTreeRef,
        })
      );

      const closeResult = await result.current();

      expect(closeResult).toBe(true);
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });
});
