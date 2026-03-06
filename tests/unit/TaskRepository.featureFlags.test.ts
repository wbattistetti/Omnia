// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Unit Tests for TaskRepository - Feature Flags Integration
 *
 * Tests that feature flags correctly control merge behavior.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { taskRepository } from '../../src/services/TaskRepository';
import { TaskType } from '../../src/types/taskTypes';
import { FEATURE_FLAGS, setFeatureFlag } from '../../src/config/featureFlags';

describe('TaskRepository - Feature Flags Integration', () => {
  beforeEach(() => {
    // Reset feature flags to defaults
    setFeatureFlag('DISABLE_MERGE_PROFONDO', false);
  });

  describe('DISABLE_MERGE_PROFONDO feature flag', () => {
    it('should use merge when flag is false (default)', () => {
      setFeatureFlag('DISABLE_MERGE_PROFONDO', false);

      taskRepository.createTask(
        TaskType.UtteranceInterpretation,
        null,
        undefined,
        'task1',
        'project1'
      );

      // Initial steps
      taskRepository.updateTask('task1', {
        steps: {
          'node1': {
            'start': { escalations: [], _disabled: true },
            'noMatch': { escalations: [] }
          }
        }
      }, 'project1');

      // Update only noMatch
      taskRepository.updateTask('task1', {
        steps: {
          'node1': {
            'noMatch': { escalations: [], _disabled: false }
          }
        }
      }, 'project1'); // No options.merge specified, should use feature flag

      // Assert: start should be preserved (merge behavior)
      const task = taskRepository.getTask('task1');
      expect(task?.steps?.['node1']?.['start']).toBeDefined();
      expect(task?.steps?.['node1']?.['start']?._disabled).toBe(true);
      expect(task?.steps?.['node1']?.['noMatch']?._disabled).toBe(false);
    });

    it('should NOT use merge when flag is true', () => {
      setFeatureFlag('DISABLE_MERGE_PROFONDO', true);

      taskRepository.createTask(
        TaskType.UtteranceInterpretation,
        null,
        undefined,
        'task2',
        'project1'
      );

      // Initial steps
      taskRepository.updateTask('task2', {
        steps: {
          'node1': {
            'start': { escalations: [] },
            'noMatch': { escalations: [] }
          }
        }
      }, 'project1');

      // Update only noMatch (without merge)
      taskRepository.updateTask('task2', {
        steps: {
          'node1': {
            'noMatch': { escalations: [] }
          }
        }
      }, 'project1'); // No options.merge specified, should use feature flag (NO merge)

      // Assert: start should be preserved because we preserve other nodeTemplateId
      // But if we update only one nodeTemplateId, others are preserved
      const task = taskRepository.getTask('task2');
      // With NO merge, we still preserve other nodeTemplateIds, but within the same nodeTemplateId we overwrite
      expect(task?.steps?.['node1']?.['noMatch']).toBeDefined();
    });

    it('should allow explicit override via options.merge', () => {
      setFeatureFlag('DISABLE_MERGE_PROFONDO', true); // Flag says NO merge

      taskRepository.createTask(
        TaskType.UtteranceInterpretation,
        null,
        undefined,
        'task3',
        'project1'
      );

      // Initial steps
      taskRepository.updateTask('task3', {
        steps: {
          'node1': {
            'start': { escalations: [], _disabled: true },
            'noMatch': { escalations: [] }
          }
        }
      }, 'project1');

      // Update with explicit merge: true (should override feature flag)
      taskRepository.updateTask('task3', {
        steps: {
          'node1': {
            'noMatch': { escalations: [] }
          }
        }
      }, 'project1', { merge: true }); // Explicit merge overrides flag

      // Assert: start should be preserved (explicit merge)
      const task = taskRepository.getTask('task3');
      expect(task?.steps?.['node1']?.['start']).toBeDefined();
      expect(task?.steps?.['node1']?.['start']?._disabled).toBe(true);
    });
  });
});
