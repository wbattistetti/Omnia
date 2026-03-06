// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * E2E Tests for Step Management
 *
 * Tests complete user flows for step activation/deactivation and deletion.
 * These tests simulate real user interactions.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { taskRepository } from '../../src/services/TaskRepository';
import { buildTaskTreeFromRepository } from '../../src/utils/taskUtils';
import { TaskType } from '../../src/types/taskTypes';

describe('Step Management - E2E', () => {
  beforeEach(() => {
    // Clear repository
  });

  describe('Scenario: Delete step and verify persistence', () => {
    it('should persist deleted step after editor close/reopen', async () => {
      // Setup: Create task with multiple steps
      const taskId = 'e2e-task-1';
      const projectId = 'e2e-project';

      taskRepository.createTask(
        TaskType.UtteranceInterpretation,
        'template1',
        undefined,
        taskId,
        projectId
      );

      // Initial state: task has start, noMatch, noInput
      taskRepository.updateTask(taskId, {
        steps: {
          'node1': {
            'start': { escalations: [] },
            'noMatch': { escalations: [] },
            'noInput': { escalations: [] }
          }
        }
      }, projectId);

      // Step 1: User deletes noMatch step
      const task1 = taskRepository.getTask(taskId);
      const node1Steps = { ...task1?.steps?.['node1'] };
      delete node1Steps['noMatch'];

      taskRepository.updateTask(taskId, {
        steps: {
          'node1': node1Steps
        }
      }, projectId);

      // Step 2: Verify step is deleted in repository
      const task2 = taskRepository.getTask(taskId);
      expect(task2?.steps?.['node1']?.['noMatch']).toBeUndefined();
      expect(task2?.steps?.['node1']?.['start']).toBeDefined();
      expect(task2?.steps?.['node1']?.['noInput']).toBeDefined();

      // Step 3: Simulate editor close (TaskTree rebuilt)
      const tree1 = await buildTaskTreeFromRepository(taskId, projectId);
      expect(tree1?.steps?.['node1']?.['noMatch']).toBeUndefined();

      // Step 4: Simulate editor reopen (TaskTree rebuilt again)
      const tree2 = await buildTaskTreeFromRepository(taskId, projectId);
      expect(tree2?.steps?.['node1']?.['noMatch']).toBeUndefined();
      expect(tree2?.steps?.['node1']?.['start']).toBeDefined();
    });
  });

  describe('Scenario: Disable step and verify persistence', () => {
    it('should persist disabled step after editor close/reopen', async () => {
      const taskId = 'e2e-task-2';
      const projectId = 'e2e-project';

      taskRepository.createTask(
        TaskType.UtteranceInterpretation,
        'template1',
        undefined,
        taskId,
        projectId
      );

      // User disables noMatch step
      taskRepository.updateTask(taskId, {
        steps: {
          'node1': {
            'start': { escalations: [] },
            'noMatch': { escalations: [], _disabled: true },
            'noInput': { escalations: [] }
          }
        }
      }, projectId);

      // Verify in repository
      const task = taskRepository.getTask(taskId);
      expect(task?.steps?.['node1']?.['noMatch']?._disabled).toBe(true);

      // Rebuild TaskTree (simulate reopen)
      const tree = await buildTaskTreeFromRepository(taskId, projectId);
      expect(tree?.steps?.['node1']?.['noMatch']?._disabled).toBe(true);
    });
  });

  describe('Scenario: Delete all steps for a node', () => {
    it('should preserve empty steps object (not clone from template)', async () => {
      const taskId = 'e2e-task-3';
      const projectId = 'e2e-project';

      taskRepository.createTask(
        TaskType.UtteranceInterpretation,
        'template1',
        undefined,
        taskId,
        projectId
      );

      // User deletes all steps for node1
      taskRepository.updateTask(taskId, {
        steps: {
          'node1': {} // All steps deleted
        }
      }, projectId);

      // Rebuild TaskTree
      const tree = await buildTaskTreeFromRepository(taskId, projectId);

      // Should be empty, NOT cloned from template
      expect(tree?.steps?.['node1']).toEqual({});
      expect(Object.keys(tree?.steps?.['node1'] || {})).toHaveLength(0);
    });
  });

  describe('Scenario: Restore deleted step', () => {
    it('should restore step correctly', async () => {
      const taskId = 'e2e-task-4';
      const projectId = 'e2e-project';

      taskRepository.createTask(
        TaskType.UtteranceInterpretation,
        'template1',
        undefined,
        taskId,
        projectId
      );

      // Initial: has start and noMatch
      taskRepository.updateTask(taskId, {
        steps: {
          'node1': {
            'start': { escalations: [] },
            'noMatch': { escalations: [] }
          }
        }
      }, projectId);

      // Delete noMatch
      const task1 = taskRepository.getTask(taskId);
      const updatedSteps = { ...task1?.steps?.['node1'] };
      delete updatedSteps['noMatch'];

      taskRepository.updateTask(taskId, {
        steps: {
          'node1': updatedSteps
        }
      }, projectId);

      // Restore noMatch
      const task2 = taskRepository.getTask(taskId);
      const restoredSteps = {
        ...task2?.steps?.['node1'],
        'noMatch': { escalations: [] }
      };

      taskRepository.updateTask(taskId, {
        steps: {
          'node1': restoredSteps
        }
      }, projectId);

      // Verify restored
      const tree = await buildTaskTreeFromRepository(taskId, projectId);
      expect(tree?.steps?.['node1']?.['noMatch']).toBeDefined();
      expect(tree?.steps?.['node1']?.['start']).toBeDefined();
    });
  });
});
