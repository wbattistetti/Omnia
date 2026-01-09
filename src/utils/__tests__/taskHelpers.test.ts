/**
 * Tests for Task migration helpers
 * Validates getTemplateId, validateTask, normalizeTask functions
 */

import { getTemplateId, validateTask, normalizeTask } from '../taskHelpers';
import type { Task, TaskInstance } from '../../types/taskTypes';

describe('Task Migration Helpers', () => {

  describe('getTemplateId', () => {
    it('should return templateId if present (new format)', () => {
      const task: TaskInstance = {
        id: 'task_1',
        templateId: 'SayMessage',
        value: {}
      };
      expect(getTemplateId(task)).toBe('SayMessage');
    });

    it('should return null if templateId missing (standalone task)', () => {
      const task: any = { id: 'task_2', value: {} };
      expect(getTemplateId(task)).toBeNull();
    });

    it('should return null if task is null', () => {
      expect(getTemplateId(null as any)).toBeNull();
    });

    it('should return null for empty string templateId', () => {
      const task: any = {
        id: 'task_5',
        templateId: '',  // Empty string
        value: {}
      };
      expect(getTemplateId(task)).toBeNull();
    });

    it('should return null for null templateId (standalone task)', () => {
      const task: any = {
        id: 'task_6',
        templateId: null,  // Standalone task
        value: {}
      };
      expect(getTemplateId(task)).toBeNull();
    });
  });

  describe('validateTask', () => {
    it('should pass for valid Task with templateId', () => {
      const task: TaskInstance = {
        id: 'task_1',
        templateId: 'SayMessage',
        value: {}
      };
      expect(() => validateTask(task)).not.toThrow();
    });

    it('should throw for invalid Task (missing id)', () => {
      const task: any = { templateId: 'SayMessage', value: {} };
      expect(() => validateTask(task)).toThrow('invalid id');
    });

    it('should pass for Task with null templateId (standalone task)', () => {
      const task: any = { id: 'task_3', templateId: null, value: {} };
      expect(() => validateTask(task)).not.toThrow();
    });

    it('should throw for null task', () => {
      expect(() => validateTask(null as any)).toThrow('null or undefined');
    });
  });

  describe('normalizeTask', () => {
    it('should return TaskInstance with templateId', () => {
      const task: Task = {
        id: 'task_1',
        templateId: 'SayMessage',
        value: { text: 'Hello' }
      };

      const normalized = normalizeTask(task);

      expect(normalized).toEqual({
        id: 'task_1',
        templateId: 'SayMessage',
        value: { text: 'Hello' }
      });
      expect(normalized.templateId).toBe('SayMessage');
    });

    it('should preserve all fields when normalizing', () => {
      const task: Task = {
        id: 'task_3',
        templateId: 'SayMessage',
        value: { text: 'Hello' },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02')
      };

      const normalized = normalizeTask(task);

      expect(normalized.id).toBe('task_3');
      expect(normalized.templateId).toBe('SayMessage');
      expect(normalized.value).toEqual({ text: 'Hello' });
      expect(normalized.createdAt).toEqual(new Date('2024-01-01'));
      expect(normalized.updatedAt).toEqual(new Date('2024-01-02'));
    });

    it('should throw if task is invalid', () => {
      const invalidTask: any = { id: 'task_4', value: {} };
      expect(() => normalizeTask(invalidTask)).toThrow();
    });
  });

  describe('Edge cases', () => {
    it('should handle Task with templateId', () => {
      const task: Task = {
        id: 'task_5',
        templateId: 'SayMessage',
        value: {}
      };

      expect(getTemplateId(task)).toBe('SayMessage');
      expect(() => validateTask(task)).not.toThrow();
    });
  });
});

