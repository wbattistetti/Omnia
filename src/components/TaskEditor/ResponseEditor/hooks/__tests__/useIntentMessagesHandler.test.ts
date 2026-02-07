// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useIntentMessagesHandler } from '@responseEditor/hooks/useIntentMessagesHandler';
import type { Task, TaskTree } from '@types/taskTypes';
import { TaskType } from '@types/taskTypes';

// Mock dependencies
vi.mock('@services/TaskRepository', () => ({
  taskRepository: {
    getTask: vi.fn(),
    updateTask: vi.fn(),
    createTask: vi.fn(),
  },
}));

vi.mock('@utils/taskHelpers', () => ({
  getTemplateId: vi.fn(),
}));

vi.mock('@types/taskTypes', async () => {
  const actual = await vi.importActual('@types/taskTypes');
  return {
    ...actual,
    isUtteranceInterpretationTemplateId: vi.fn(),
  };
});

vi.mock('@responseEditor/utils/saveIntentMessages', () => ({
  saveIntentMessagesToTaskTree: vi.fn(),
}));

import { taskRepository } from '@services/TaskRepository';
import { getTemplateId } from '@utils/taskHelpers';
import { isUtteranceInterpretationTemplateId } from '@types/taskTypes';
import { saveIntentMessagesToTaskTree } from '@responseEditor/utils/saveIntentMessages';

/**
 * Tests for useIntentMessagesHandler
 *
 * This hook handles intent messages completion by saving to TaskTree and repository.
 * We test observable behaviors: saving to repository, updating TaskTree, calling callbacks, and error handling.
 *
 * WHAT WE TEST:
 * - Saving to repository when task exists with valid TaskTree (UtteranceInterpretation and non-UtteranceInterpretation)
 * - Creating task when task doesn't exist but TaskTree is valid
 * - Updating task when task exists but TaskTree is invalid
 * - Calling onWizardComplete callback
 * - Calling replaceSelectedTaskTree callback
 * - Error handling in replaceSelectedTaskTree
 * - Edge cases (null task, null taskTree, null messages, missing id/instanceId)
 *
 * WHY IT'S IMPORTANT:
 * - Intent messages are critical for task configuration
 * - Repository persistence ensures data is saved
 * - Task type conversion (to UtteranceInterpretation) is important for correct behavior
 * - Callbacks notify parent components of changes
 * - Error handling prevents crashes
 */

describe('useIntentMessagesHandler', () => {
  let replaceSelectedTaskTree: ReturnType<typeof vi.fn>;
  let onWizardComplete: ReturnType<typeof vi.fn>;
  let mockTask: Task;
  let mockTaskTree: TaskTree;
  let mockMessages: any;
  let mockUpdatedTaskTree: TaskTree;

  beforeEach(() => {
    vi.clearAllMocks();

    replaceSelectedTaskTree = vi.fn();
    onWizardComplete = vi.fn();

    mockTask = {
      id: 'task-1',
      type: TaskType.DataRequest,
      label: 'Test Task',
    } as Task;

    mockTaskTree = {
      label: 'Test TaskTree',
      nodes: [{ id: 'node-1', templateId: 'tpl-1', label: 'Node 1' }],
      steps: {},
    } as TaskTree;

    mockUpdatedTaskTree = {
      label: 'Updated TaskTree',
      nodes: [{ id: 'node-1', templateId: 'tpl-1', label: 'Node 1' }],
      steps: { 'node-1': {} },
    } as TaskTree;

    mockMessages = {
      intents: [{ text: 'Hello', intent: 'greeting' }],
    };

    // Default mocks
    (saveIntentMessagesToTaskTree as any).mockReturnValue(mockUpdatedTaskTree);
    (taskRepository.getTask as any).mockReturnValue(mockTask);
    (getTemplateId as any).mockReturnValue('some-template-id');
    (isUtteranceInterpretationTemplateId as any).mockReturnValue(false);
  });

  describe('saving to repository', () => {
    it('should update task with UtteranceInterpretation type when task exists and is not UtteranceInterpretation', () => {
      const { result } = renderHook(() =>
        useIntentMessagesHandler({
          task: mockTask,
          taskTree: mockTaskTree,
          currentProjectId: 'project-1',
          onWizardComplete,
          replaceSelectedTaskTree,
        })
      );

      result.current(mockMessages);

      expect(saveIntentMessagesToTaskTree).toHaveBeenCalledWith(mockTaskTree, mockMessages);
      expect(taskRepository.getTask).toHaveBeenCalledWith('task-1');
      expect(taskRepository.updateTask).toHaveBeenCalledWith(
        'task-1',
        {
          type: TaskType.UtteranceInterpretation,
          templateId: null,
          ...mockUpdatedTaskTree,
        },
        'project-1'
      );
    });

    it('should update task without type change when task is already UtteranceInterpretation', () => {
      (isUtteranceInterpretationTemplateId as any).mockReturnValue(true);

      const { result } = renderHook(() =>
        useIntentMessagesHandler({
          task: mockTask,
          taskTree: mockTaskTree,
          currentProjectId: 'project-1',
          onWizardComplete,
          replaceSelectedTaskTree,
        })
      );

      result.current(mockMessages);

      expect(taskRepository.updateTask).toHaveBeenCalledWith(
        'task-1',
        {
          ...mockUpdatedTaskTree,
        },
        'project-1'
      );
      expect(taskRepository.updateTask).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ type: TaskType.UtteranceInterpretation }),
        expect.anything()
      );
    });

    it('should create task when task does not exist but TaskTree is valid', () => {
      (taskRepository.getTask as any).mockReturnValue(null);

      const { result } = renderHook(() =>
        useIntentMessagesHandler({
          task: mockTask,
          taskTree: mockTaskTree,
          currentProjectId: 'project-1',
          onWizardComplete,
          replaceSelectedTaskTree,
        })
      );

      result.current(mockMessages);

      expect(taskRepository.createTask).toHaveBeenCalledWith(
        TaskType.UtteranceInterpretation,
        null,
        mockUpdatedTaskTree,
        'task-1',
        'project-1'
      );
      expect(taskRepository.updateTask).not.toHaveBeenCalled();
    });

    it('should update task when task exists but TaskTree is invalid', () => {
      const invalidTaskTree = {} as TaskTree; // Empty TaskTree
      (saveIntentMessagesToTaskTree as any).mockReturnValue(invalidTaskTree);

      const { result } = renderHook(() =>
        useIntentMessagesHandler({
          task: mockTask,
          taskTree: mockTaskTree,
          currentProjectId: 'project-1',
          onWizardComplete,
          replaceSelectedTaskTree,
        })
      );

      result.current(mockMessages);

      expect(taskRepository.updateTask).toHaveBeenCalledWith(
        'task-1',
        {
          ...invalidTaskTree,
        },
        'project-1'
      );
      expect(taskRepository.createTask).not.toHaveBeenCalled();
    });

    it('should use instanceId when task.id is not available', () => {
      const taskWithInstanceId = {
        instanceId: 'instance-1',
        type: TaskType.DataRequest,
      } as any;

      const { result } = renderHook(() =>
        useIntentMessagesHandler({
          task: taskWithInstanceId,
          taskTree: mockTaskTree,
          currentProjectId: 'project-1',
          onWizardComplete,
          replaceSelectedTaskTree,
        })
      );

      result.current(mockMessages);

      expect(taskRepository.getTask).toHaveBeenCalledWith('instance-1');
    });

    it('should prefer instanceId over task.id when both are present', () => {
      const taskWithBoth = {
        id: 'task-1',
        instanceId: 'instance-1',
        type: TaskType.DataRequest,
      } as any;

      const { result } = renderHook(() =>
        useIntentMessagesHandler({
          task: taskWithBoth,
          taskTree: mockTaskTree,
          currentProjectId: 'project-1',
          onWizardComplete,
          replaceSelectedTaskTree,
        })
      );

      result.current(mockMessages);

      // The code uses: ((task as any)?.instanceId || task?.id)
      // So instanceId is preferred over id
      expect(taskRepository.getTask).toHaveBeenCalledWith('instance-1');
      expect(taskRepository.getTask).not.toHaveBeenCalledWith('task-1');
    });

    it('should use undefined projectId when currentProjectId is null', () => {
      const { result } = renderHook(() =>
        useIntentMessagesHandler({
          task: mockTask,
          taskTree: mockTaskTree,
          currentProjectId: null,
          onWizardComplete,
          replaceSelectedTaskTree,
        })
      );

      result.current(mockMessages);

      expect(taskRepository.updateTask).toHaveBeenCalledWith(
        'task-1',
        expect.anything(),
        undefined
      );
    });
  });

  describe('callbacks', () => {
    it('should call onWizardComplete when provided', () => {
      const { result } = renderHook(() =>
        useIntentMessagesHandler({
          task: mockTask,
          taskTree: mockTaskTree,
          currentProjectId: 'project-1',
          onWizardComplete,
          replaceSelectedTaskTree,
        })
      );

      result.current(mockMessages);

      expect(onWizardComplete).toHaveBeenCalledWith(mockUpdatedTaskTree);
    });

    it('should not call onWizardComplete when not provided', () => {
      const { result } = renderHook(() =>
        useIntentMessagesHandler({
          task: mockTask,
          taskTree: mockTaskTree,
          currentProjectId: 'project-1',
          onWizardComplete: undefined,
          replaceSelectedTaskTree,
        })
      );

      result.current(mockMessages);

      expect(onWizardComplete).not.toHaveBeenCalled();
    });

    it('should call replaceSelectedTaskTree with updated TaskTree', () => {
      const { result } = renderHook(() =>
        useIntentMessagesHandler({
          task: mockTask,
          taskTree: mockTaskTree,
          currentProjectId: 'project-1',
          onWizardComplete,
          replaceSelectedTaskTree,
        })
      );

      result.current(mockMessages);

      expect(replaceSelectedTaskTree).toHaveBeenCalledWith(mockUpdatedTaskTree);
    });

    it('should handle errors in replaceSelectedTaskTree gracefully', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      replaceSelectedTaskTree.mockImplementation(() => {
        throw new Error('Test error');
      });

      const { result } = renderHook(() =>
        useIntentMessagesHandler({
          task: mockTask,
          taskTree: mockTaskTree,
          currentProjectId: 'project-1',
          onWizardComplete,
          replaceSelectedTaskTree,
        })
      );

      // Should not throw
      expect(() => {
        result.current(mockMessages);
      }).not.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[ResponseEditor][replaceSelectedDDT] FAILED',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('edge cases', () => {
    it('should not save to repository when task has no id or instanceId', () => {
      const taskWithoutId = {
        type: TaskType.DataRequest,
      } as Task;

      const { result } = renderHook(() =>
        useIntentMessagesHandler({
          task: taskWithoutId,
          taskTree: mockTaskTree,
          currentProjectId: 'project-1',
          onWizardComplete,
          replaceSelectedTaskTree,
        })
      );

      result.current(mockMessages);

      expect(taskRepository.getTask).not.toHaveBeenCalled();
      expect(taskRepository.updateTask).not.toHaveBeenCalled();
      expect(taskRepository.createTask).not.toHaveBeenCalled();
    });

    it('should still call replaceSelectedTaskTree when task has no id', () => {
      const taskWithoutId = {
        type: TaskType.DataRequest,
      } as Task;

      const { result } = renderHook(() =>
        useIntentMessagesHandler({
          task: taskWithoutId,
          taskTree: mockTaskTree,
          currentProjectId: 'project-1',
          onWizardComplete,
          replaceSelectedTaskTree,
        })
      );

      result.current(mockMessages);

      expect(replaceSelectedTaskTree).toHaveBeenCalledWith(mockUpdatedTaskTree);
    });

    it('should handle null task', () => {
      const { result } = renderHook(() =>
        useIntentMessagesHandler({
          task: null,
          taskTree: mockTaskTree,
          currentProjectId: 'project-1',
          onWizardComplete,
          replaceSelectedTaskTree,
        })
      );

      result.current(mockMessages);

      expect(taskRepository.getTask).not.toHaveBeenCalled();
      expect(replaceSelectedTaskTree).toHaveBeenCalledWith(mockUpdatedTaskTree);
    });

    it('should handle undefined task', () => {
      const { result } = renderHook(() =>
        useIntentMessagesHandler({
          task: undefined,
          taskTree: mockTaskTree,
          currentProjectId: 'project-1',
          onWizardComplete,
          replaceSelectedTaskTree,
        })
      );

      result.current(mockMessages);

      expect(taskRepository.getTask).not.toHaveBeenCalled();
      expect(replaceSelectedTaskTree).toHaveBeenCalledWith(mockUpdatedTaskTree);
    });

    it('should handle null taskTree', () => {
      (saveIntentMessagesToTaskTree as any).mockReturnValue(null);

      const { result } = renderHook(() =>
        useIntentMessagesHandler({
          task: mockTask,
          taskTree: null,
          currentProjectId: 'project-1',
          onWizardComplete,
          replaceSelectedTaskTree,
        })
      );

      result.current(mockMessages);

      expect(saveIntentMessagesToTaskTree).toHaveBeenCalledWith(null, mockMessages);
      expect(replaceSelectedTaskTree).toHaveBeenCalledWith(null);
    });

    it('should handle TaskTree without nodes', () => {
      const taskTreeWithoutNodes = {
        label: 'Test',
        steps: {},
      } as TaskTree;

      (saveIntentMessagesToTaskTree as any).mockReturnValue(taskTreeWithoutNodes);

      const { result } = renderHook(() =>
        useIntentMessagesHandler({
          task: mockTask,
          taskTree: mockTaskTree,
          currentProjectId: 'project-1',
          onWizardComplete,
          replaceSelectedTaskTree,
        })
      );

      result.current(mockMessages);

      // Should update task even if TaskTree is invalid
      expect(taskRepository.updateTask).toHaveBeenCalled();
    });
  });

  describe('callback stability', () => {
    it('should return stable callback when dependencies do not change', () => {
      const { result, rerender } = renderHook(() =>
        useIntentMessagesHandler({
          task: mockTask,
          taskTree: mockTaskTree,
          currentProjectId: 'project-1',
          onWizardComplete,
          replaceSelectedTaskTree,
        })
      );

      const firstCallback = result.current;

      rerender();

      expect(result.current).toBe(firstCallback);
    });

    it('should return new callback when task changes', () => {
      const { result, rerender } = renderHook(
        ({ task }) =>
          useIntentMessagesHandler({
            task,
            taskTree: mockTaskTree,
            currentProjectId: 'project-1',
            onWizardComplete,
            replaceSelectedTaskTree,
          }),
        {
          initialProps: { task: mockTask },
        }
      );

      const firstCallback = result.current;

      const newTask = { ...mockTask, id: 'task-2' };
      rerender({ task: newTask });

      expect(result.current).not.toBe(firstCallback);
    });

    it('should return new callback when taskTree changes', () => {
      const { result, rerender } = renderHook(
        ({ taskTree }) =>
          useIntentMessagesHandler({
            task: mockTask,
            taskTree,
            currentProjectId: 'project-1',
            onWizardComplete,
            replaceSelectedTaskTree,
          }),
        {
          initialProps: { taskTree: mockTaskTree },
        }
      );

      const firstCallback = result.current;

      const newTaskTree = { ...mockTaskTree, label: 'New Label' };
      rerender({ taskTree: newTaskTree });

      expect(result.current).not.toBe(firstCallback);
    });

    it('should return new callback when replaceSelectedTaskTree changes', () => {
      const { result, rerender } = renderHook(
        ({ replaceSelectedTaskTree }) =>
          useIntentMessagesHandler({
            task: mockTask,
            taskTree: mockTaskTree,
            currentProjectId: 'project-1',
            onWizardComplete,
            replaceSelectedTaskTree,
          }),
        {
          initialProps: { replaceSelectedTaskTree },
        }
      );

      const firstCallback = result.current;

      const newReplaceSelectedTaskTree = vi.fn();
      rerender({ replaceSelectedTaskTree: newReplaceSelectedTaskTree });

      expect(result.current).not.toBe(firstCallback);
    });
  });
});
