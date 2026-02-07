// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Purity Tests for Critical Domain Functions
 *
 * These tests verify that critical domain functions remain pure:
 * - No side effects (no mutations)
 * - Deterministic (same input → same output)
 * - No external dependencies (no React, no state, no hooks)
 *
 * These are the 3 most critical functions in the domain layer that, if mutated, break everything.
 * Note: applyNodeUpdate is also critical but is in features/node-editing/core/, not domain/.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getMainNodes,
  getSubNodes,
} from '../taskTree';
import {
  getNodeStepKeys,
} from '../node';
import type { TaskTree } from '@types/taskTypes';

// Mock the migration helper to avoid Vite alias resolution issues in tests
vi.mock('@utils/taskTreeMigrationHelpers', () => ({
  getNodesWithFallback: (taskTree: any) => {
    if (!taskTree || !taskTree.nodes) return [];
    return Array.isArray(taskTree.nodes) ? taskTree.nodes : [];
  },
}));

describe('Domain Layer Purity - Critical Functions (Domain Layer Only)', () => {
  describe('getMainNodes - Purity Guarantees', () => {
    it('should not mutate input taskTree', () => {
      const originalTaskTree: TaskTree = {
        id: 'test-1',
        nodes: [
          { id: 'node-1', label: 'Node 1' },
          { id: 'node-2', label: 'Node 2' },
        ] as any,
      };

      // Deep clone to verify no mutation
      const inputClone = JSON.parse(JSON.stringify(originalTaskTree));

      const result = getMainNodes(originalTaskTree);

      // Verify input was not mutated
      expect(originalTaskTree).toEqual(inputClone);
      expect(result).toBeDefined();
    });

    it('should be deterministic (same input → same output)', () => {
      const taskTree: TaskTree = {
        id: 'test-2',
        nodes: [
          { id: 'node-1', label: 'Node 1' },
        ] as any,
      };

      const result1 = getMainNodes(taskTree);
      const result2 = getMainNodes(taskTree);
      const result3 = getMainNodes(taskTree);

      // All results should be identical
      expect(result1).toEqual(result2);
      expect(result2).toEqual(result3);
    });

    it('should handle null input without side effects', () => {
      const result1 = getMainNodes(null);
      const result2 = getMainNodes(null);

      expect(result1).toEqual([]);
      expect(result2).toEqual([]);
      expect(result1).toEqual(result2);
    });

    it('should handle undefined input without side effects', () => {
      const result1 = getMainNodes(undefined);
      const result2 = getMainNodes(undefined);

      expect(result1).toEqual([]);
      expect(result2).toEqual([]);
      expect(result1).toEqual(result2);
    });
  });

  describe('getSubNodes - Purity Guarantees', () => {
    it('should not mutate input main node', () => {
      const originalMain = {
        id: 'main-1',
        label: 'Main 1',
        subNodes: [
          { id: 'sub-1', label: 'Sub 1' },
          { id: 'sub-2', label: 'Sub 2' },
        ],
      };

      // Deep clone to verify no mutation
      const inputClone = JSON.parse(JSON.stringify(originalMain));

      const result = getSubNodes(originalMain);

      // Verify input was not mutated
      expect(originalMain).toEqual(inputClone);
      expect(result).toBeDefined();
    });

    it('should be deterministic (same input → same output)', () => {
      const main = {
        id: 'main-1',
        subNodes: [
          { id: 'sub-1', label: 'Sub 1' },
        ],
      };

      const result1 = getSubNodes(main);
      const result2 = getSubNodes(main);
      const result3 = getSubNodes(main);

      // All results should be identical
      expect(result1).toEqual(result2);
      expect(result2).toEqual(result3);
    });

    it('should handle null input without side effects', () => {
      const result1 = getSubNodes(null);
      const result2 = getSubNodes(null);

      expect(result1).toEqual([]);
      expect(result2).toEqual([]);
      expect(result1).toEqual(result2);
    });

    it('should handle undefined input without side effects', () => {
      const result1 = getSubNodes(undefined);
      const result2 = getSubNodes(undefined);

      expect(result1).toEqual([]);
      expect(result2).toEqual([]);
      expect(result1).toEqual(result2);
    });
  });

  describe('getNodeStepKeys - Purity Guarantees', () => {
    it('should not mutate input node', () => {
      const originalNode = {
        id: 'node-1',
        label: 'Node 1',
        steps: {
          start: { escalations: [] },
          noMatch: { escalations: [] },
        },
      };

      // Deep clone to verify no mutation
      const inputClone = JSON.parse(JSON.stringify(originalNode));

      const result = getNodeStepKeys(originalNode);

      // Verify input was not mutated
      expect(originalNode).toEqual(inputClone);
      expect(result).toBeDefined();
    });

    it('should be deterministic (same input → same output)', () => {
      const node = {
        id: 'node-1',
        steps: {
          start: { escalations: [] },
          noMatch: { escalations: [] },
        },
      };

      const result1 = getNodeStepKeys(node);
      const result2 = getNodeStepKeys(node);
      const result3 = getNodeStepKeys(node);

      // All results should be identical
      expect(result1).toEqual(result2);
      expect(result2).toEqual(result3);
    });

    it('should handle null input without side effects', () => {
      const result1 = getNodeStepKeys(null);
      const result2 = getNodeStepKeys(null);

      expect(result1).toEqual([]);
      expect(result2).toEqual([]);
      expect(result1).toEqual(result2);
    });

    it('should handle undefined input without side effects', () => {
      const result1 = getNodeStepKeys(undefined);
      const result2 = getNodeStepKeys(undefined);

      expect(result1).toEqual([]);
      expect(result2).toEqual([]);
      expect(result1).toEqual(result2);
    });

    it('should handle array steps format without mutation', () => {
      const originalNode = {
        id: 'node-1',
        steps: [
          { type: 'start', escalations: [] },
          { type: 'noMatch', escalations: [] },
        ],
      };

      const inputClone = JSON.parse(JSON.stringify(originalNode));

      const result = getNodeStepKeys(originalNode);

      expect(originalNode).toEqual(inputClone);
      expect(result).toContain('start');
      expect(result).toContain('noMatch');
    });
  });

  // Note: applyNodeUpdate is also critical but is in features/node-editing/core/, not domain/
  // It should be tested separately in its own test file
});
