// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Mode State Tests
 *
 * Unit tests for mode state management functions.
 * Tests recursion, propagation, and edge cases.
 */

import { describe, it, expect } from 'vitest';
import {
  setNodeModeWithPropagation,
  setNodeModeWithoutPropagation,
  isModeConsistent,
  getNodesInAIMode,
  getNodesInManualMode,
  hasNodesInAIMode,
  areAllNodesManual
} from '../../state/modeState';
import type { SchemaNode } from '../../types/wizard.types';

describe('modeState', () => {
  describe('setNodeModeWithPropagation', () => {
    it('should set mode on node without children', () => {
      const node: SchemaNode = { id: '1', label: 'Node 1' };
      const updated = setNodeModeWithPropagation(node, 'ai');
      expect(updated.mode).toBe('ai');
    });

    it('should propagate AI mode to children', () => {
      const node: SchemaNode = {
        id: '1',
        label: 'Parent',
        subData: [
          { id: '2', label: 'Child 1' },
          { id: '3', label: 'Child 2' }
        ]
      };
      const updated = setNodeModeWithPropagation(node, 'ai');
      expect(updated.mode).toBe('ai');
      expect(updated.subData?.[0].mode).toBe('ai');
      expect(updated.subData?.[1].mode).toBe('ai');
    });

    it('should not propagate manual mode to children', () => {
      const node: SchemaNode = {
        id: '1',
        label: 'Parent',
        subData: [
          { id: '2', label: 'Child 1', mode: 'ai' }
        ]
      };
      const updated = setNodeModeWithPropagation(node, 'manual');
      expect(updated.mode).toBe('manual');
      expect(updated.subData?.[0].mode).toBe('ai'); // Child unchanged
    });

    it('should propagate AI mode recursively to nested children', () => {
      const node: SchemaNode = {
        id: '1',
        label: 'Parent',
        subData: [
          {
            id: '2',
            label: 'Child',
            subData: [
              { id: '3', label: 'Grandchild' }
            ]
          }
        ]
      };
      const updated = setNodeModeWithPropagation(node, 'ai');
      expect(updated.mode).toBe('ai');
      expect(updated.subData?.[0].mode).toBe('ai');
      expect(updated.subData?.[0].subData?.[0].mode).toBe('ai');
    });

    it('should throw error if recursion depth exceeds maximum', () => {
      // Create a very deep structure (11 levels)
      let node: SchemaNode = { id: '1', label: 'Level 1' };
      for (let i = 2; i <= 12; i++) {
        node = {
          id: `level-${i}`,
          label: `Level ${i}`,
          subData: [node]
        };
      }
      expect(() => setNodeModeWithPropagation(node, 'ai')).toThrow('Recursion depth exceeded');
    });
  });

  describe('setNodeModeWithoutPropagation', () => {
    it('should set mode without propagating', () => {
      const node: SchemaNode = {
        id: '1',
        label: 'Parent',
        subData: [
          { id: '2', label: 'Child', mode: 'manual' }
        ]
      };
      const updated = setNodeModeWithoutPropagation(node, 'ai');
      expect(updated.mode).toBe('ai');
      expect(updated.subData?.[0].mode).toBe('manual'); // Child unchanged
    });
  });

  describe('isModeConsistent', () => {
    it('should return true for non-AI mode', () => {
      const node: SchemaNode = { id: '1', label: 'Node', mode: 'manual' };
      expect(isModeConsistent(node)).toBe(true);
    });

    it('should return true for AI mode with all children in AI mode', () => {
      const node: SchemaNode = {
        id: '1',
        label: 'Parent',
        mode: 'ai',
        subData: [
          { id: '2', label: 'Child 1', mode: 'ai' },
          { id: '3', label: 'Child 2', mode: 'ai' }
        ]
      };
      expect(isModeConsistent(node)).toBe(true);
    });

    it('should return false for AI mode with child not in AI mode', () => {
      const node: SchemaNode = {
        id: '1',
        label: 'Parent',
        mode: 'ai',
        subData: [
          { id: '2', label: 'Child', mode: 'manual' }
        ]
      };
      expect(isModeConsistent(node)).toBe(false);
    });
  });

  describe('getNodesInAIMode', () => {
    it('should return empty array for structure with no AI nodes', () => {
      const structure: SchemaNode[] = [
        { id: '1', label: 'Node 1', mode: 'manual' }
      ];
      expect(getNodesInAIMode(structure)).toEqual([]);
    });

    it('should return all AI nodes from structure', () => {
      const structure: SchemaNode[] = [
        { id: '1', label: 'Node 1', mode: 'ai' },
        { id: '2', label: 'Node 2', mode: 'manual' },
        { id: '3', label: 'Node 3', mode: 'ai' }
      ];
      const result = getNodesInAIMode(structure);
      expect(result).toHaveLength(2);
      expect(result.map(n => n.id)).toEqual(['1', '3']);
    });

    it('should return AI nodes recursively from nested structure', () => {
      const structure: SchemaNode[] = [
        {
          id: '1',
          label: 'Parent',
          mode: 'ai',
          subData: [
            { id: '2', label: 'Child 1', mode: 'ai' },
            { id: '3', label: 'Child 2', mode: 'manual' }
          ]
        }
      ];
      const result = getNodesInAIMode(structure);
      expect(result).toHaveLength(2);
      expect(result.map(n => n.id)).toEqual(['1', '2']);
    });
  });

  describe('hasNodesInAIMode', () => {
    it('should return false when no AI nodes', () => {
      const structure: SchemaNode[] = [
        { id: '1', label: 'Node', mode: 'manual' }
      ];
      expect(hasNodesInAIMode(structure)).toBe(false);
    });

    it('should return true when AI nodes exist', () => {
      const structure: SchemaNode[] = [
        { id: '1', label: 'Node', mode: 'ai' }
      ];
      expect(hasNodesInAIMode(structure)).toBe(true);
    });
  });

  describe('areAllNodesManual', () => {
    it('should return true when all nodes are manual', () => {
      const structure: SchemaNode[] = [
        { id: '1', label: 'Node 1', mode: 'manual' },
        { id: '2', label: 'Node 2', mode: 'manual' }
      ];
      expect(areAllNodesManual(structure)).toBe(true);
    });

    it('should return false when any node is in AI mode', () => {
      const structure: SchemaNode[] = [
        { id: '1', label: 'Node 1', mode: 'manual' },
        { id: '2', label: 'Node 2', mode: 'ai' }
      ];
      expect(areAllNodesManual(structure)).toBe(false);
    });

    it('should return false when structure is empty', () => {
      expect(areAllNodesManual([])).toBe(false);
    });
  });
});
