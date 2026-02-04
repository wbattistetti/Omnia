// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Node State Tests
 *
 * Unit tests for node state management functions.
 * Tests node manipulation operations.
 */

import { describe, it, expect } from 'vitest';
import {
  updateNodeLabel,
  addSubNode,
  removeSubNode,
  updateSubNode,
  hasSubNodes,
  getAllSubNodes
} from '../../state/nodeState';
import type { SchemaNode } from '../../types/wizard.types';

describe('nodeState', () => {
  describe('updateNodeLabel', () => {
    it('should update node label', () => {
      const node: SchemaNode = { id: '1', label: 'Old Label' };
      const updated = updateNodeLabel(node, 'New Label');
      expect(updated.label).toBe('New Label');
      expect(node.label).toBe('Old Label'); // Original unchanged
    });
  });

  describe('addSubNode', () => {
    it('should add sub-node to node without sub-nodes', () => {
      const node: SchemaNode = { id: '1', label: 'Parent' };
      const subNode: SchemaNode = { id: '2', label: 'Child' };
      const updated = addSubNode(node, subNode);
      expect(updated.subData).toHaveLength(1);
      expect(updated.subData?.[0]).toEqual(subNode);
    });

    it('should add sub-node to node with existing sub-nodes', () => {
      const node: SchemaNode = {
        id: '1',
        label: 'Parent',
        subData: [{ id: '2', label: 'Child 1' }]
      };
      const subNode: SchemaNode = { id: '3', label: 'Child 2' };
      const updated = addSubNode(node, subNode);
      expect(updated.subData).toHaveLength(2);
      expect(updated.subData?.[1]).toEqual(subNode);
    });
  });

  describe('removeSubNode', () => {
    it('should remove sub-node by index', () => {
      const node: SchemaNode = {
        id: '1',
        label: 'Parent',
        subData: [
          { id: '2', label: 'Child 1' },
          { id: '3', label: 'Child 2' },
          { id: '4', label: 'Child 3' }
        ]
      };
      const updated = removeSubNode(node, 1);
      expect(updated.subData).toHaveLength(2);
      expect(updated.subData?.[0].id).toBe('2');
      expect(updated.subData?.[1].id).toBe('4');
    });

    it('should handle removing from empty sub-nodes', () => {
      const node: SchemaNode = { id: '1', label: 'Parent' };
      const updated = removeSubNode(node, 0);
      expect(updated.subData).toEqual([]);
    });
  });

  describe('updateSubNode', () => {
    it('should update sub-node by index', () => {
      const node: SchemaNode = {
        id: '1',
        label: 'Parent',
        subData: [
          { id: '2', label: 'Child 1' },
          { id: '3', label: 'Child 2' }
        ]
      };
      const updatedSubNode: SchemaNode = { id: '3', label: 'Updated Child' };
      const updated = updateSubNode(node, 1, updatedSubNode);
      expect(updated.subData?.[1].label).toBe('Updated Child');
      expect(updated.subData?.[0].label).toBe('Child 1'); // Other unchanged
    });
  });

  describe('hasSubNodes', () => {
    it('should return false for node without sub-nodes', () => {
      const node: SchemaNode = { id: '1', label: 'Node' };
      expect(hasSubNodes(node)).toBe(false);
    });

    it('should return true for node with sub-nodes', () => {
      const node: SchemaNode = {
        id: '1',
        label: 'Parent',
        subData: [{ id: '2', label: 'Child' }]
      };
      expect(hasSubNodes(node)).toBe(true);
    });
  });

  describe('getAllSubNodes', () => {
    it('should return empty array for node without sub-nodes', () => {
      const node: SchemaNode = { id: '1', label: 'Node' };
      expect(getAllSubNodes(node)).toEqual([]);
    });

    it('should return sub-nodes from subData', () => {
      const node: SchemaNode = {
        id: '1',
        label: 'Parent',
        subData: [
          { id: '2', label: 'Child 1' },
          { id: '3', label: 'Child 2' }
        ]
      };
      const result = getAllSubNodes(node);
      expect(result).toHaveLength(2);
      expect(result.map(n => n.id)).toEqual(['2', '3']);
    });

    it('should prefer subTasks over subData', () => {
      const node: SchemaNode = {
        id: '1',
        label: 'Parent',
        subData: [{ id: '2', label: 'Child 1' }],
        subTasks: [{ id: '3', label: 'Child 2' }]
      };
      const result = getAllSubNodes(node);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('3');
    });
  });
});
