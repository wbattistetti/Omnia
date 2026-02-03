// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { checkAndApplyTemplateSync } from '../syncTemplate';
import type { Task, TaskTree } from '../../../../../../types/taskTypes';

/**
 * Tests for syncTemplate
 *
 * This function checks if template synchronization is needed and applies it.
 */

// Define mocks before vi.mock() calls
const mockGetTemplate = vi.fn();

// Mock dependencies - DialogueTaskService is dynamically imported in syncTemplate.ts
// We need to mock it so the dynamic import returns our mock
vi.mock('../../../../../../../services/DialogueTaskService', async () => {
  return {
    default: {
      getTemplate: mockGetTemplate,
    },
  };
});

vi.mock('../../../../../../../services/TaskRepository', () => ({
  taskRepository: {
    getTask: vi.fn(),
  },
}));

vi.mock('../../../../../../../utils/taskHelpers', () => ({
  getTemplateId: vi.fn(),
}));

vi.mock('../../../../../../../utils/taskUtils', () => ({
  syncTasksWithTemplate: vi.fn(),
  markTaskAsEdited: vi.fn(),
}));

// DialogueTaskService is mocked above
import { taskRepository } from '../../../../../../../services/TaskRepository';
import { getTemplateId } from '../../../../../../../utils/taskHelpers';
import { syncTasksWithTemplate, markTaskAsEdited } from '../../../../../../../utils/taskUtils';

describe('syncTemplate', () => {
  const mockProjectId = 'proj-1';

  beforeEach(() => {
    vi.clearAllMocks();
    (getTemplateId as any).mockReturnValue(null);
    (taskRepository.getTask as any).mockReturnValue(null);
    mockGetTemplate.mockReturnValue(null);
    (syncTasksWithTemplate as any).mockResolvedValue([]);
    (markTaskAsEdited as any).mockImplementation(() => {});
  });

  describe('checkAndApplyTemplateSync', () => {
    it('should return false when task has no templateId', async () => {
      const taskTree: TaskTree = {
        nodes: [{ id: 'node-1' }],
      };

      const task: Task = {
        id: 'task-1',
        type: 1,
      };

      (getTemplateId as any).mockReturnValue(null);

      const result = await checkAndApplyTemplateSync(taskTree, task, mockProjectId);

      expect(result).toBe(false);
      expect(syncTasksWithTemplate).not.toHaveBeenCalled();
    });

    it('should return false when template is not found', async () => {
      const taskTree: TaskTree = {
        nodes: [{ id: 'node-1' }],
      };

      const task: Task = {
        id: 'task-1',
        type: 1,
        templateId: 'template-1',
      };

      (getTemplateId as any).mockReturnValue('template-1');
      mockGetTemplate.mockReturnValue(null);

      const result = await checkAndApplyTemplateSync(taskTree, task, mockProjectId);

      expect(result).toBe(false);
      expect(syncTasksWithTemplate).not.toHaveBeenCalled();
    });

    it('should check template sync when template exists', async () => {
      const taskTree: TaskTree = {
        nodes: [{ id: 'node-1' }],
      };

      const task: Task = {
        id: 'task-1',
        type: 1,
        templateId: 'template-1',
      };

      const mockTemplate = {
        id: 'template-1',
        label: 'Template 1',
      };

      (getTemplateId as any).mockReturnValue('template-1');
      mockGetTemplate.mockReturnValue(mockTemplate);
      (syncTasksWithTemplate as any).mockResolvedValue([]);

      const result = await checkAndApplyTemplateSync(taskTree, task, mockProjectId);

      expect(mockGetTemplate).toHaveBeenCalledWith('template-1');
      expect(syncTasksWithTemplate).toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it('should return true when sync is applied', async () => {
      // Mock window.confirm to return true (user accepts sync)
      const originalConfirm = window.confirm;
      window.confirm = vi.fn(() => true);

      const taskTree: TaskTree = {
        nodes: [{ id: 'node-1' }],
        steps: {
          'template-1': {
            start: {
              escalations: [
                {
                  tasks: [{ id: 'task-1', text: 'Old text', parameters: {}, edited: false }],
                },
              ],
            },
          },
        },
      };

      const task: Task = {
        id: 'task-1',
        type: 1,
        templateId: 'template-1',
      };

      const mockTemplate = {
        id: 'template-1',
        label: 'Template 1',
      };

      (getTemplateId as any).mockReturnValue('template-1');
      mockGetTemplate.mockReturnValue(mockTemplate);
      (syncTasksWithTemplate as any).mockResolvedValue([
        {
          templateId: 'template-1',
          stepType: 'start',
          escalationIndex: 0,
          taskIndex: 0,
          templateTask: { text: 'New text', parameters: {} },
        },
      ]);

      const result = await checkAndApplyTemplateSync(taskTree, task, mockProjectId);

      // The function should return true if sync was applied (shouldSync = true)
      expect(result).toBe(true);
      expect(window.confirm).toHaveBeenCalled();
      // Verify that the task was updated
      expect(taskTree.steps['template-1'].start.escalations[0].tasks[0].text).toBe('New text');
      expect(taskTree.steps['template-1'].start.escalations[0].tasks[0].edited).toBe(false);

      // Restore
      window.confirm = originalConfirm;
    });
  });
});
