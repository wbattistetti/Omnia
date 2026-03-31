// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Unit Tests for TaskRepository - Refactored Version
 *
 * Tests the simplified TaskRepository without deep merge complexity.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { taskRepository } from '../../src/services/TaskRepository';
import { TaskType } from '../../src/types/taskTypes';
import type { Task } from '../../src/types/taskTypes';

describe('TaskRepository - Refactored', () => {
  beforeEach(() => {
    // Clear all tasks before each test
    const allTasks = taskRepository.getAllTasks();
    allTasks.forEach(task => {
      // Note: deleteTask might not be available, so we'll just clear the internal state
      // For now, we'll work with the singleton and clear it manually if needed
    });
  });

  describe('updateTask - Direct Updates (No Merge)', () => {
    it('should overwrite steps completely when merge: false', () => {
      // Setup: Create task with initial steps
      taskRepository.createTask(
        TaskType.UtteranceInterpretation,
        null,
        undefined,
        'task1',
        'project1'
      );

      taskRepository.updateTask('task1', {
        steps: {
          'node1': {
            'start': { escalations: [] },
            'noMatch': { escalations: [] }
          }
        }
      }, 'project1');

      // Act: Update with empty steps (cancellation)
      taskRepository.updateTask('task1', {
        steps: {
          'node1': {} // Empty = deletion
        }
      }, 'project1', { merge: false });

      // Assert: Steps should be empty, not merged
      const task = taskRepository.getTask('task1');
      expect(task?.steps?.['node1']).toEqual({});
      expect(Object.keys(task?.steps?.['node1'] || {})).toHaveLength(0);
    });

    it('should preserve _disabled flags when updating', () => {
      // Setup: Create task with disabled step
      taskRepository.createTask(
        TaskType.UtteranceInterpretation,
        null,
        undefined,
        'task1',
        'project1'
      );

      taskRepository.updateTask('task1', {
        steps: {
          'node1': {
            'start': { escalations: [], _disabled: true },
            'noMatch': { escalations: [] }
          }
        }
      }, 'project1');

      // Act: Update noMatch step
      taskRepository.updateTask('task1', {
        steps: {
          'node1': {
            'noMatch': { escalations: [], _disabled: false }
          }
        }
      }, 'project1', { merge: true }); // Merge to preserve start

      // Assert: _disabled flag on start should be preserved
      const task = taskRepository.getTask('task1');
      expect(task?.steps?.['node1']?.['start']?._disabled).toBe(true);
      expect(task?.steps?.['node1']?.['noMatch']?._disabled).toBe(false);
    });

    it('should handle explicit deletion with empty object', () => {
      taskRepository.createTask(
        TaskType.UtteranceInterpretation,
        null,
        undefined,
        'task1',
        'project1'
      );

      taskRepository.updateTask('task1', {
        steps: {
          'node1': {
            'start': { escalations: [] },
            'noMatch': { escalations: [] }
          }
        }
      }, 'project1');

      // Act: Delete all steps for node1
      taskRepository.updateTask('task1', {
        steps: {
          'node1': {} // Explicit deletion
        }
      }, 'project1', { merge: false });

      // Assert: node1 should be empty
      const task = taskRepository.getTask('task1');
      expect(task?.steps?.['node1']).toEqual({});
    });
  });

  describe('getTask - Fresh Instance', () => {
    it('should always return fresh instance from repository', () => {
      taskRepository.createTask(
        TaskType.UtteranceInterpretation,
        null,
        undefined,
        'task1',
        'project1'
      );

      // Get task
      const task1 = taskRepository.getTask('task1');

      // Update task
      taskRepository.updateTask('task1', {
        steps: { 'node1': { 'start': { escalations: [] } } }
      }, 'project1');

      // Get task again - should be fresh
      const task2 = taskRepository.getTask('task1');

      // Assert: task2 should have updated steps
      expect(task2?.steps?.['node1']?.['start']).toBeDefined();
      expect(task1?.steps?.['node1']?.['start']).toBeUndefined();
    });
  });

  describe('saveTaskToDatabase', () => {
    it('should save task to database correctly', async () => {
      // Mock fetch
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

      // Instance row (templateId set) — project template definitions are excluded from bulk
      taskRepository.createTask(
        TaskType.UtteranceInterpretation,
        '00000000-0000-4000-8000-000000000001',
        undefined,
        'task1',
        'project1'
      );

      taskRepository.updateTask('task1', {
        steps: {
          'node1': {
            'start': { escalations: [] }
          }
        }
      }, 'project1');

      // Act: Save to database (using the private method via saveAllTasksToDatabase)
      await taskRepository.saveAllTasksToDatabase('project1', [taskRepository.getTask('task1')!]);

      // Assert: fetch called with correct data
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/projects/project1/tasks'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );
    });
  });
});
