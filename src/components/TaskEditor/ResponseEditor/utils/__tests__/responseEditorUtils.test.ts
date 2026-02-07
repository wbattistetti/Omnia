// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  safeDeepClone,
  getStepsAsArray,
  getStepsForNode,
  isEditingActive,
  isTaskMeta,
  getTaskMeta,
} from '../responseEditorUtils';
import type { TaskMeta } from '@taskEditor/EditorHost/types';

/**
 * Tests for responseEditorUtils
 *
 * These tests verify the utility functions that are used throughout ResponseEditor.
 * We test both happy paths and edge cases to ensure robust behavior.
 */
describe('responseEditorUtils', () => {
  describe('safeDeepClone', () => {
    it('should clone a simple object', () => {
      const obj = { a: 1, b: 'test', c: true };
      const cloned = safeDeepClone(obj);

      expect(cloned).toEqual(obj);
      expect(cloned).not.toBe(obj);
    });

    it('should clone nested objects', () => {
      const obj = { a: { b: { c: 1 } } };
      const cloned = safeDeepClone(obj);

      expect(cloned).toEqual(obj);
      expect(cloned.a).not.toBe(obj.a);
      expect(cloned.a.b).not.toBe(obj.a.b);
    });

    it('should clone arrays', () => {
      const arr = [1, 2, { a: 3 }];
      const cloned = safeDeepClone(arr);

      expect(cloned).toEqual(arr);
      expect(cloned).not.toBe(arr);
      expect(cloned[2]).not.toBe(arr[2]);
    });

    it('should return null/undefined as-is', () => {
      expect(safeDeepClone(null)).toBe(null);
      expect(safeDeepClone(undefined)).toBe(undefined);
    });

    it('should handle primitive values', () => {
      expect(safeDeepClone(42)).toBe(42);
      expect(safeDeepClone('string')).toBe('string');
      expect(safeDeepClone(true)).toBe(true);
    });

    it('should handle circular references gracefully', () => {
      const obj: any = { a: 1 };
      obj.self = obj;

      // Should not throw, but may return original if structuredClone fails
      const cloned = safeDeepClone(obj);
      expect(cloned).toBeDefined();
    });
  });

  describe('getStepsAsArray', () => {
    it('should return empty array for null/undefined', () => {
      expect(getStepsAsArray(null)).toEqual([]);
      expect(getStepsAsArray(undefined)).toEqual([]);
    });

    it('should return array as-is if already an array', () => {
      const steps = [
        { type: 'start', escalations: [] },
        { type: 'noMatch', escalations: [] },
      ];
      expect(getStepsAsArray(steps)).toBe(steps);
    });

    it('should convert object dictionary to array', () => {
      const steps = {
        start: { escalations: [] },
        noMatch: { escalations: [] },
        success: { escalations: [] },
      };
      const result = getStepsAsArray(steps);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ type: 'start', escalations: [] });
      expect(result[1]).toEqual({ type: 'noMatch', escalations: [] });
      expect(result[2]).toEqual({ type: 'success', escalations: [] });
    });

    it('should preserve step properties when converting', () => {
      const steps = {
        start: { escalations: [], id: 'step-1' },
        noMatch: { escalations: [], id: 'step-2' },
      };
      const result = getStepsAsArray(steps);

      expect(result[0]).toHaveProperty('type', 'start');
      expect(result[0]).toHaveProperty('id', 'step-1');
      expect(result[1]).toHaveProperty('type', 'noMatch');
      expect(result[1]).toHaveProperty('id', 'step-2');
    });
  });

  describe('getStepsForNode', () => {
    it('should return empty object for null/undefined steps', () => {
      expect(getStepsForNode(null, 'node-1')).toEqual({});
      expect(getStepsForNode(undefined, 'node-1')).toEqual({});
    });

    it('should return empty object for array steps', () => {
      expect(getStepsForNode([], 'node-1')).toEqual({});
      expect(getStepsForNode([{ type: 'start' }], 'node-1')).toEqual({});
    });

    it('should return steps for valid node templateId', () => {
      const steps = {
        'node-1': { start: { escalations: [] }, noMatch: { escalations: [] } },
        'node-2': { start: { escalations: [] } },
      };

      expect(getStepsForNode(steps, 'node-1')).toEqual({
        start: { escalations: [] },
        noMatch: { escalations: [] },
      });
      expect(getStepsForNode(steps, 'node-2')).toEqual({
        start: { escalations: [] },
      });
    });

    it('should return empty object for non-existent node', () => {
      const steps = {
        'node-1': { start: { escalations: [] } },
      };

      expect(getStepsForNode(steps, 'node-999')).toEqual({});
    });

    it('should handle empty steps dictionary', () => {
      expect(getStepsForNode({}, 'node-1')).toEqual({});
    });
  });

  describe('isEditingActive', () => {
    beforeEach(() => {
      // Reset active element - in jsdom, activeElement might be body or null
      Object.defineProperty(document, 'activeElement', {
        writable: true,
        configurable: true,
        value: null,
      });
    });

    it('should return false when no element is focused', () => {
      Object.defineProperty(document, 'activeElement', {
        writable: true,
        configurable: true,
        value: null,
      });
      expect(isEditingActive()).toBe(false);
    });

    it('should return true for input element', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);

      // Mock activeElement to be the input
      Object.defineProperty(document, 'activeElement', {
        writable: true,
        configurable: true,
        value: input,
      });

      expect(isEditingActive()).toBe(true);

      document.body.removeChild(input);
    });

    it('should return true for textarea element', () => {
      const textarea = document.createElement('textarea');
      document.body.appendChild(textarea);

      // Mock activeElement to be the textarea
      Object.defineProperty(document, 'activeElement', {
        writable: true,
        configurable: true,
        value: textarea,
      });

      expect(isEditingActive()).toBe(true);

      document.body.removeChild(textarea);
    });

    it('should return true for select element', () => {
      const select = document.createElement('select');
      document.body.appendChild(select);

      // Mock activeElement to be the select
      Object.defineProperty(document, 'activeElement', {
        writable: true,
        configurable: true,
        value: select,
      });

      expect(isEditingActive()).toBe(true);

      document.body.removeChild(select);
    });

    it('should return true for contentEditable element', () => {
      const div = document.createElement('div');
      div.contentEditable = 'true';
      document.body.appendChild(div);

      // Mock activeElement to be the div
      Object.defineProperty(document, 'activeElement', {
        writable: true,
        configurable: true,
        value: div,
      });

      // Mock isContentEditable property
      Object.defineProperty(div, 'isContentEditable', {
        writable: true,
        configurable: true,
        value: true,
      });

      expect(isEditingActive()).toBe(true);

      document.body.removeChild(div);
    });

    it('should return false for non-editable element', () => {
      const div = document.createElement('div');
      document.body.appendChild(div);

      // Mock activeElement to be the div (but not contentEditable)
      Object.defineProperty(document, 'activeElement', {
        writable: true,
        configurable: true,
        value: div,
      });

      // Ensure isContentEditable is false or undefined
      Object.defineProperty(div, 'isContentEditable', {
        writable: true,
        configurable: true,
        value: false,
      });

      expect(isEditingActive()).toBe(false);

      document.body.removeChild(div);
    });
  });

  describe('isTaskMeta', () => {
    it('should return true for TaskMeta object', () => {
      const taskMeta: TaskMeta = {
        id: 'task-1',
        type: 1,
        templateId: 'template-1',
      };

      expect(isTaskMeta(taskMeta)).toBe(true);
    });

    it('should return false for null/undefined', () => {
      // isTaskMeta returns falsy (null) for null, not false
      expect(isTaskMeta(null)).toBeFalsy();
      expect(isTaskMeta(undefined)).toBeFalsy();
    });

    it('should return false for non-object values', () => {
      expect(isTaskMeta(42)).toBe(false);
      expect(isTaskMeta('string')).toBe(false);
      expect(isTaskMeta(true)).toBe(false);
    });

    it('should return false for object without templateId', () => {
      const task = {
        id: 'task-1',
        type: 1,
      };

      expect(isTaskMeta(task)).toBe(false);
    });

    it('should return false for Task object (without templateId)', () => {
      const task = {
        id: 'task-1',
        type: 1,
        steps: {},
      };

      expect(isTaskMeta(task)).toBe(false);
    });
  });

  describe('getTaskMeta', () => {
    it('should return TaskMeta when task has templateId', () => {
      const taskMeta: TaskMeta = {
        id: 'task-1',
        type: 1,
        templateId: 'template-1',
      };

      expect(getTaskMeta(taskMeta)).toBe(taskMeta);
    });

    it('should return null for null/undefined', () => {
      expect(getTaskMeta(null)).toBe(null);
      expect(getTaskMeta(undefined)).toBe(null);
    });

    it('should return null for non-TaskMeta objects', () => {
      const task = {
        id: 'task-1',
        type: 1,
        steps: {},
      };

      expect(getTaskMeta(task)).toBe(null);
    });

    it('should return null for primitive values', () => {
      expect(getTaskMeta(42)).toBe(null);
      expect(getTaskMeta('string')).toBe(null);
      expect(getTaskMeta(true)).toBe(null);
    });
  });
});
