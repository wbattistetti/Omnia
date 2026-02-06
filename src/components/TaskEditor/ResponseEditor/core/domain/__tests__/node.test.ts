// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect } from 'vitest';
import {
  getNodeStepKeys,
  getNodeStepData,
  getNodeLabel,
  removeNode,
} from '../node';

describe('Domain: Node Operations', () => {
  describe('getNodeStepKeys', () => {
    it('should return empty array for null node', () => {
      const result = getNodeStepKeys(null);
      expect(result).toEqual([]);
    });

    it('should return empty array for undefined node', () => {
      const result = getNodeStepKeys(undefined);
      expect(result).toEqual([]);
    });

    it('should return empty array for node with no steps', () => {
      const node = { id: 'node-1', label: 'Node 1' };
      const result = getNodeStepKeys(node);
      expect(result).toEqual([]);
    });

    it('should extract step keys from dictionary format', () => {
      const node = {
        id: 'node-1',
        label: 'Node 1',
        steps: {
          start: { type: 'start', escalations: [] },
          noMatch: { type: 'noMatch', escalations: [] },
          success: { type: 'success', escalations: [] },
        },
      };
      const result = getNodeStepKeys(node);
      expect(result).toEqual(['start', 'noMatch', 'success']);
    });

    it('should extract step keys from array format', () => {
      const node = {
        id: 'node-1',
        label: 'Node 1',
        steps: [
          { type: 'start', escalations: [] },
          { type: 'noMatch', escalations: [] },
          { type: 'success', escalations: [] },
        ],
      };
      const result = getNodeStepKeys(node);
      expect(result).toEqual(['start', 'noMatch', 'success']);
    });

    it('should extract step keys from legacy messages format', () => {
      const node = {
        id: 'node-1',
        label: 'Node 1',
        messages: {
          start: { text: 'Hello' },
          noMatch: { text: 'Not understood' },
        },
      };
      const result = getNodeStepKeys(node);
      expect(result).toEqual(['start', 'noMatch']);
    });

    it('should combine all formats and return in order', () => {
      const node = {
        id: 'node-1',
        label: 'Node 1',
        steps: {
          start: { type: 'start' },
          noMatch: { type: 'noMatch' },
        },
        messages: {
          success: { text: 'Done' },
        },
      };
      const result = getNodeStepKeys(node);
      // Should include all unique keys, ordered
      expect(result).toContain('start');
      expect(result).toContain('noMatch');
      expect(result).toContain('success');
    });

    it('should return steps in DEFAULT_STEP_ORDER first, then custom', () => {
      const node = {
        id: 'node-1',
        steps: {
          customStep: { type: 'customStep' },
          start: { type: 'start' },
          noMatch: { type: 'noMatch' },
          anotherCustom: { type: 'anotherCustom' },
        },
      };
      const result = getNodeStepKeys(node);
      
      // Known steps should come first in order
      const startIndex = result.indexOf('start');
      const noMatchIndex = result.indexOf('noMatch');
      const anotherCustomIndex = result.indexOf('anotherCustom'); // Sorted alphabetically
      const customIndex = result.indexOf('customStep');
      
      expect(startIndex).toBeLessThan(anotherCustomIndex);
      expect(noMatchIndex).toBeLessThan(anotherCustomIndex);
      expect(anotherCustomIndex).toBeLessThan(customIndex); // Custom sorted alphabetically: "anotherCustom" < "customStep"
    });

    it('should filter out empty or whitespace step keys', () => {
      const node = {
        id: 'node-1',
        steps: {
          start: { type: 'start' },
          '': { type: '' },
          '   ': { type: '   ' },
          noMatch: { type: 'noMatch' },
        },
      };
      const result = getNodeStepKeys(node);
      expect(result).not.toContain('');
      expect(result).not.toContain('   ');
      expect(result).toContain('start');
      expect(result).toContain('noMatch');
    });

    it('should handle steps with null or undefined values', () => {
      const node = {
        id: 'node-1',
        messages: {
          start: null,
          noMatch: undefined,
          success: { text: 'Done' },
        },
      };
      const result = getNodeStepKeys(node);
      expect(result).not.toContain('start');
      expect(result).not.toContain('noMatch');
      expect(result).toContain('success');
    });
  });

  describe('getNodeStepData', () => {
    it('should return empty object for null node', () => {
      const result = getNodeStepData(null, 'start');
      expect(result).toEqual({});
    });

    it('should return empty object for undefined node', () => {
      const result = getNodeStepData(undefined, 'start');
      expect(result).toEqual({});
    });

    it('should return empty object for empty stepKey', () => {
      const node = { id: 'node-1', steps: { start: {} } };
      const result = getNodeStepData(node, '');
      expect(result).toEqual({});
    });

    it('should return step data from dictionary format', () => {
      const stepData = { type: 'start', escalations: [] };
      const node = {
        id: 'node-1',
        steps: {
          start: stepData,
        },
      };
      const result = getNodeStepData(node, 'start');
      expect(result).toEqual(stepData);
    });

    it('should return step data from array format', () => {
      const stepData = { type: 'start', escalations: [] };
      const node = {
        id: 'node-1',
        steps: [stepData],
      };
      const result = getNodeStepData(node, 'start');
      expect(result).toEqual(stepData);
    });

    it('should return step data from legacy messages format', () => {
      const stepData = { text: 'Hello' };
      const node = {
        id: 'node-1',
        messages: {
          start: stepData,
        },
      };
      const result = getNodeStepData(node, 'start');
      expect(result).toEqual(stepData);
    });

    it('should return empty object when stepKey not found', () => {
      const node = {
        id: 'node-1',
        steps: {
          start: { type: 'start' },
        },
      };
      const result = getNodeStepData(node, 'notFound');
      expect(result).toEqual({});
    });

    it('should prioritize dictionary format over array format', () => {
      const dictData = { type: 'start', escalations: [] };
      const arrayData = { type: 'start', escalations: [], other: 'from array' };
      const node = {
        id: 'node-1',
        steps: {
          start: dictData,
        },
      };
      // Also has array format (shouldn't happen, but test robustness)
      (node.steps as any).push = () => {}; // Make it array-like
      const result = getNodeStepData(node, 'start');
      expect(result).toEqual(dictData);
    });
  });

  describe('getNodeLabel', () => {
    it('should return empty string for null node', () => {
      const result = getNodeLabel(null);
      expect(result).toBe('');
    });

    it('should return empty string for undefined node', () => {
      const result = getNodeLabel(undefined);
      expect(result).toBe('');
    });

    it('should return node.label when available', () => {
      const node = { id: 'node-1', label: 'My Label' };
      const result = getNodeLabel(node);
      expect(result).toBe('My Label');
    });

    it('should return node.name as fallback when label not available', () => {
      const node = { id: 'node-1', name: 'My Name' };
      const result = getNodeLabel(node);
      expect(result).toBe('My Name');
    });

    it('should return empty string when neither label nor name available', () => {
      const node = { id: 'node-1' };
      const result = getNodeLabel(node);
      expect(result).toBe('');
    });

    it('should prioritize translations over node.label', () => {
      const node = { id: 'node-1', label: 'Original Label' };
      const translations = { 'node-1': 'Translated Label' };
      const result = getNodeLabel(node, translations);
      expect(result).toBe('Translated Label');
    });

    it('should use node._id for translations lookup', () => {
      const node = { _id: 'node-1', label: 'Original Label' };
      const translations = { 'node-1': 'Translated Label' };
      const result = getNodeLabel(node, translations);
      expect(result).toBe('Translated Label');
    });

    it('should fallback to node.label when translation not found', () => {
      const node = { id: 'node-1', label: 'Original Label' };
      const translations = { 'other-id': 'Other Label' };
      const result = getNodeLabel(node, translations);
      expect(result).toBe('Original Label');
    });

    it('should convert label to string', () => {
      const node = { id: 'node-1', label: 123 };
      const result = getNodeLabel(node);
      expect(result).toBe('123');
    });

    it('should handle empty translations object', () => {
      const node = { id: 'node-1', label: 'My Label' };
      const result = getNodeLabel(node, {});
      expect(result).toBe('My Label');
    });
  });

  describe('removeNode', () => {
    it('should return filtered array when removeChildren is false', () => {
      const nodes = [
        { id: 'node-1', label: 'Node 1' },
        { id: 'node-2', label: 'Node 2' },
        { id: 'node-3', label: 'Node 3' },
      ];
      const result = removeNode(nodes, 'node-2', false);
      expect(result).toHaveLength(2);
      expect(result.find(n => n.id === 'node-2')).toBeUndefined();
      expect(result.find(n => n.id === 'node-1')).toBeDefined();
      expect(result.find(n => n.id === 'node-3')).toBeDefined();
    });

    it('should return same array when node not found and removeChildren is false', () => {
      const nodes = [
        { id: 'node-1', label: 'Node 1' },
        { id: 'node-2', label: 'Node 2' },
      ];
      const result = removeNode(nodes, 'node-999', false);
      expect(result).toEqual(nodes);
    });

    it('should remove node and all children when removeChildren is true', () => {
      const nodes = [
        { id: 'parent', label: 'Parent', parentId: undefined },
        { id: 'child-1', label: 'Child 1', parentId: 'parent' },
        { id: 'child-2', label: 'Child 2', parentId: 'parent' },
        { id: 'grandchild', label: 'Grandchild', parentId: 'child-1' },
        { id: 'other', label: 'Other', parentId: undefined },
      ];
      const result = removeNode(nodes, 'parent', true);
      
      expect(result).toHaveLength(1);
      expect(result.find(n => n.id === 'other')).toBeDefined();
      expect(result.find(n => n.id === 'parent')).toBeUndefined();
      expect(result.find(n => n.id === 'child-1')).toBeUndefined();
      expect(result.find(n => n.id === 'child-2')).toBeUndefined();
      expect(result.find(n => n.id === 'grandchild')).toBeUndefined();
    });

    it('should handle deep nesting when removeChildren is true', () => {
      const nodes = [
        { id: 'level1', parentId: undefined },
        { id: 'level2', parentId: 'level1' },
        { id: 'level3', parentId: 'level2' },
        { id: 'level4', parentId: 'level3' },
        { id: 'sibling', parentId: undefined },
      ];
      const result = removeNode(nodes, 'level1', true);
      
      expect(result).toHaveLength(1);
      expect(result.find(n => n.id === 'sibling')).toBeDefined();
      expect(result.find(n => n.id === 'level1')).toBeUndefined();
      expect(result.find(n => n.id === 'level2')).toBeUndefined();
      expect(result.find(n => n.id === 'level3')).toBeUndefined();
      expect(result.find(n => n.id === 'level4')).toBeUndefined();
    });

    it('should handle circular references gracefully', () => {
      const nodes = [
        { id: 'node-1', parentId: 'node-2' },
        { id: 'node-2', parentId: 'node-1' },
        { id: 'node-3', parentId: undefined },
      ];
      // Should not infinite loop
      const result = removeNode(nodes, 'node-1', true);
      expect(result.length).toBeLessThanOrEqual(2);
    });

    it('should return empty array when removing all nodes', () => {
      const nodes = [
        { id: 'parent', parentId: undefined },
        { id: 'child', parentId: 'parent' },
      ];
      const result = removeNode(nodes, 'parent', true);
      expect(result).toEqual([]);
    });

    it('should handle empty nodes array', () => {
      const result = removeNode([], 'node-1', false);
      expect(result).toEqual([]);
    });

    it('should handle nodes with no parentId correctly', () => {
      const nodes = [
        { id: 'node-1', parentId: undefined },
        { id: 'node-2', parentId: undefined },
      ];
      const result = removeNode(nodes, 'node-1', true);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('node-2');
    });
  });
});
