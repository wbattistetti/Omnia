// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Regression Tests for Response Editor
 *
 * Comprehensive test suite covering all critical features to prevent regressions.
 * Run these tests before and after refactoring to ensure nothing breaks.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { taskRepository } from '../../src/services/TaskRepository';
import { buildTaskTreeFromRepository } from '../../src/utils/taskUtils';
import { TaskType } from '../../src/types/taskTypes';
import { DialogueTaskService } from '../../src/services/DialogueTaskService';

// Mock DialogueTaskService
vi.mock('../../src/services/DialogueTaskService', () => ({
  DialogueTaskService: {
    getTemplate: vi.fn(),
    getAllTemplates: vi.fn(() => []),
    getTemplateCount: vi.fn(() => 0),
  }
}));

describe('ResponseEditor - Regression Tests', () => {
  beforeEach(() => {
    // Clear state before each test
    vi.clearAllMocks();

    // Setup default mock template
    const mockTemplate = {
      id: 'template1',
      label: 'Test Template',
      type: TaskType.UtteranceInterpretation,
      steps: {
        'node1': {
          'start': { escalations: [] },
          'noMatch': { escalations: [] },
          'noInput': { escalations: [] }
        }
      },
      data: [{
        id: 'node1',
        templateId: 'node1',
        label: 'Node 1'
      }]
    };

    (DialogueTaskService.getTemplate as any).mockReturnValue(mockTemplate);
  });

  const regressionScenarios = [
    {
      name: 'Disable step persists after editor close/reopen',
      test: async () => {
        const taskId = 'regression-1';
        const projectId = 'test-project';

        taskRepository.createTask(
          TaskType.UtteranceInterpretation,
          'template1',
          undefined,
          taskId,
          projectId
        );

        // Disable step
        taskRepository.updateTask(taskId, {
          steps: {
            'node1': {
              'start': { escalations: [] },
              'noMatch': { escalations: [], _disabled: true }
            }
          }
        }, projectId);

        // Rebuild (simulate reopen)
        const tree = await buildTaskTreeFromRepository(taskId, projectId);

        expect(tree?.steps?.['node1']?.['noMatch']?._disabled).toBe(true);
      }
    },

    {
      name: 'Delete step persists after editor close/reopen',
      test: async () => {
        const taskId = 'regression-2';
        const projectId = 'test-project';

        taskRepository.createTask(
          TaskType.UtteranceInterpretation,
          'template1',
          undefined,
          taskId,
          projectId
        );

        // Create steps
        taskRepository.updateTask(taskId, {
          steps: {
            'node1': {
              'start': { escalations: [] },
              'noMatch': { escalations: [] }
            }
          }
        }, projectId);

        // Delete noMatch
        const task = taskRepository.getTask(taskId);
        const updatedSteps = { ...task?.steps?.['node1'] };
        delete updatedSteps['noMatch'];

        taskRepository.updateTask(taskId, {
          steps: {
            'node1': updatedSteps
          }
        }, projectId);

        // Rebuild (simulate reopen)
        const tree = await buildTaskTreeFromRepository(taskId, projectId);

        // Verify: noMatch should be deleted (not in instance steps)
        // Note: If instance has steps defined, they are used (not cloned from template)
        const taskAfter = taskRepository.getTask(taskId);
        expect(taskAfter?.steps?.['node1']?.['noMatch']).toBeUndefined();
        expect(taskAfter?.steps?.['node1']?.['start']).toBeDefined();

        // Tree should reflect instance steps
        if (tree?.steps?.['node1']) {
          // If tree has steps for node1, they should match instance
          expect(tree.steps['node1']['start']).toBeDefined();
        }
      }
    },

    {
      name: 'Empty steps (all deleted) are preserved, not cloned',
      test: async () => {
        const taskId = 'regression-3';
        const projectId = 'test-project';

        taskRepository.createTask(
          TaskType.UtteranceInterpretation,
          'template1',
          undefined,
          taskId,
          projectId
        );

        // Delete all steps
        taskRepository.updateTask(taskId, {
          steps: {
            'node1': {}
          }
        }, projectId);

        // Rebuild (should NOT clone from template)
        const tree = await buildTaskTreeFromRepository(taskId, projectId);

        expect(tree?.steps?.['node1']).toEqual({});
        expect(Object.keys(tree?.steps?.['node1'] || {})).toHaveLength(0);
      }
    },

    {
      name: 'Multiple nodes with different step states',
      test: async () => {
        const taskId = 'regression-4';
        const projectId = 'test-project';

        taskRepository.createTask(
          TaskType.UtteranceInterpretation,
          'template1',
          undefined,
          taskId,
          projectId
        );

        // node1: has steps
        // node2: empty (deleted)
        // node3: has disabled step
        taskRepository.updateTask(taskId, {
          steps: {
            'node1': {
              'start': { escalations: [] }
            },
            'node2': {},
            'node3': {
              'start': { escalations: [], _disabled: true }
            }
          }
        }, projectId);

        const tree = await buildTaskTreeFromRepository(taskId, projectId);

        expect(tree?.steps?.['node1']?.['start']).toBeDefined();
        expect(tree?.steps?.['node2']).toEqual({});
        expect(tree?.steps?.['node3']?.['start']?._disabled).toBe(true);
      }
    },

    {
      name: 'Restore deleted step works correctly',
      test: async () => {
        const taskId = 'regression-5';
        const projectId = 'test-project';

        taskRepository.createTask(
          TaskType.UtteranceInterpretation,
          'template1',
          undefined,
          taskId,
          projectId
        );

        // Delete step
        taskRepository.updateTask(taskId, {
          steps: {
            'node1': {
              'start': { escalations: [] }
              // noMatch deleted
            }
          }
        }, projectId);

        // Restore step (set _disabled: false if it was disabled, or re-add if deleted)
        // For deleted step, we need to re-add it
        const task = taskRepository.getTask(taskId);
        const restoredSteps = {
          ...task?.steps?.['node1'],
          'noMatch': { escalations: [] } // Restored
        };

        taskRepository.updateTask(taskId, {
          steps: {
            'node1': restoredSteps
          }
        }, projectId);

        const tree = await buildTaskTreeFromRepository(taskId, projectId);

        expect(tree?.steps?.['node1']?.['noMatch']).toBeDefined();
        expect(tree?.steps?.['node1']?.['start']).toBeDefined();
      }
    },

    {
      name: 'Fresh instance always returned from repository',
      test: async () => {
        const taskId = 'regression-6';
        const projectId = 'test-project';

        taskRepository.createTask(
          TaskType.UtteranceInterpretation,
          'template1',
          undefined,
          taskId,
          projectId
        );

        const task1 = taskRepository.getTask(taskId);

        // Update
        taskRepository.updateTask(taskId, {
          steps: {
            'node1': { 'start': { escalations: [] } }
          }
        }, projectId);

        const task2 = taskRepository.getTask(taskId);

        // task2 should have updated steps
        expect(task2?.steps?.['node1']?.['start']).toBeDefined();
        expect(task1?.steps?.['node1']?.['start']).toBeUndefined();
      }
    }
  ];

  // Run all regression scenarios
  regressionScenarios.forEach(scenario => {
    it(scenario.name, scenario.test);
  });
});
