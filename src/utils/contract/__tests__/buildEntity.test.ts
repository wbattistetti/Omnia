// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildSemanticContract } from '../buildEntity';
import type { TaskTreeNode } from '../../../types/taskTypes';
import type { SemanticContract } from '../../../types/semanticContract';
import { getSubTasksInfo } from '../../../components/TaskEditor/ResponseEditor/utils/regexGroupUtils';

// Mock getSubTasksInfo
vi.mock('../../../components/TaskEditor/ResponseEditor/utils/regexGroupUtils', () => ({
  getSubTasksInfo: vi.fn()
}));

describe('buildEntity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('buildSemanticContract', () => {
    it('should return null for null node', () => {
      const result = buildSemanticContract(null);

      expect(result).toBeNull();
    });

    it('should build contract for simple node', () => {
      vi.mocked(getSubTasksInfo).mockReturnValue([]);

      const node: TaskTreeNode = {
        id: 'node1',
        label: 'Email',
        type: 'email'
      };

      const result = buildSemanticContract(node);

      expect(result).not.toBeNull();
      expect(result?.entity.label).toBe('Email');
      expect(result?.entity.type).toBe('email');
      expect(result?.subentities).toBeUndefined();
      // ✅ Test per canonical format: nodo semplice → "value"
      expect(result?.outputCanonical.format).toBe('value');
      expect(result?.outputCanonical.keys).toBeUndefined();
    });

    it('should build contract for composite node', () => {
      vi.mocked(getSubTasksInfo).mockReturnValue([
        { subTaskKey: 'day', label: 'Day' },
        { subTaskKey: 'month', label: 'Month' },
        { subTaskKey: 'year', label: 'Year' }
      ]);

      const node: TaskTreeNode = {
        id: 'date',
        label: 'Date of Birth',
        type: 'date',
        subNodes: [
          { id: 'day', label: 'Day' } as TaskTreeNode,
          { id: 'month', label: 'Month' } as TaskTreeNode,
          { id: 'year', label: 'Year' } as TaskTreeNode
        ]
      };

      const result = buildSemanticContract(node);

      expect(result).not.toBeNull();
      expect(result?.entity.label).toBe('Date of Birth');
      expect(result?.subentities).toBeDefined();
      expect(result?.subentities).toHaveLength(3);
      // ✅ Test per canonical format: nodo composito → "object"
      expect(result?.outputCanonical.format).toBe('object');
      expect(result?.outputCanonical.keys).toEqual(['day', 'month', 'year']);
    });

    it('should use node.id when label is missing', () => {
      vi.mocked(getSubTasksInfo).mockReturnValue([]);

      const node: TaskTreeNode = {
        id: 'node1'
      };

      const result = buildSemanticContract(node);

      expect(result?.entity.label).toBe('node1');
    });

    it('should use generic type when type is missing', () => {
      vi.mocked(getSubTasksInfo).mockReturnValue([]);

      const node: TaskTreeNode = {
        id: 'node1',
        label: 'Test Node'
      };

      const result = buildSemanticContract(node);

      expect(result?.entity.type).toBe('generic');
    });

    it('should include constraints when present', () => {
      vi.mocked(getSubTasksInfo).mockReturnValue([]);

      const node: TaskTreeNode = {
        id: 'node1',
        label: 'Test Node',
        constraints: [
          {
            validation: {
              min: 0,
              max: 100
            }
          } as any
        ]
      };

      const result = buildSemanticContract(node);

      expect(result?.constraints).toEqual({
        min: 0,
        max: 100
      });
    });

    it('should include normalization when present', () => {
      vi.mocked(getSubTasksInfo).mockReturnValue([]);

      const node: TaskTreeNode = {
        id: 'node1',
        label: 'Test Node',
        constraints: [
          {
            normalization: 'Normalize to uppercase'
          } as any
        ]
      };

      const result = buildSemanticContract(node);

      expect(result?.normalization).toBe('Normalize to uppercase');
    });

    it('should use default redefinitionPolicy when missing', () => {
      vi.mocked(getSubTasksInfo).mockReturnValue([]);

      const node: TaskTreeNode = {
        id: 'node1',
        label: 'Test Node'
      };

      const result = buildSemanticContract(node);

      expect(result?.redefinitionPolicy).toBe('last_wins');
    });

    it('should read redefinitionPolicy from node', () => {
      vi.mocked(getSubTasksInfo).mockReturnValue([]);

      const node: TaskTreeNode = {
        id: 'node1',
        label: 'Test Node',
        constraints: [
          {
            redefinitionPolicy: 'first_wins'
          } as any
        ]
      };

      const result = buildSemanticContract(node);

      expect(result?.redefinitionPolicy).toBe('first_wins');
    });

    it('should include legacy mainGroup field', () => {
      vi.mocked(getSubTasksInfo).mockReturnValue([]);

      const node: TaskTreeNode = {
        id: 'node1',
        label: 'Test Node',
        type: 'email'
      };

      const result = buildSemanticContract(node);

      expect(result?.mainGroup).toEqual({
        name: 'Test Node',
        description: expect.any(String),
        kind: 'email'
      });
    });

    it('should include legacy subgroups field for composite node', () => {
      vi.mocked(getSubTasksInfo).mockReturnValue([
        { subTaskKey: 'day', label: 'Day' },
        { subTaskKey: 'month', label: 'Month' }
      ]);

      const node: TaskTreeNode = {
        id: 'date',
        label: 'Date',
        subNodes: [
          { id: 'day', label: 'Day' } as TaskTreeNode,
          { id: 'month', label: 'Month' } as TaskTreeNode
        ]
      };

      const result = buildSemanticContract(node);

      expect(result?.subgroups).toBeDefined();
      expect(result?.subgroups).toHaveLength(2);
      expect(result?.subgroups).toBe(result?.subentities);
    });

    it('should set version and timestamps', () => {
      vi.mocked(getSubTasksInfo).mockReturnValue([]);

      const node: TaskTreeNode = {
        id: 'node1',
        label: 'Test Node'
      };

      const result = buildSemanticContract(node);

      expect(result?.version).toBe(1);
      expect(result?.createdAt).toBeInstanceOf(Date);
      expect(result?.updatedAt).toBeInstanceOf(Date);
    });

    it('should maintain order of subentities', () => {
      vi.mocked(getSubTasksInfo).mockReturnValue([
        { subTaskKey: 'day', label: 'Day' },
        { subTaskKey: 'month', label: 'Month' },
        { subTaskKey: 'year', label: 'Year' }
      ]);

      const node: TaskTreeNode = {
        id: 'date',
        label: 'Date',
        subNodes: [
          { id: 'day', label: 'Day' } as TaskTreeNode,
          { id: 'month', label: 'Month' } as TaskTreeNode,
          { id: 'year', label: 'Year' } as TaskTreeNode
        ]
      };

      const result = buildSemanticContract(node);

      // ✅ Test per ordine stabile e deterministico delle subentities
      expect(result?.subentities?.map(s => s.subTaskKey)).toEqual(['day', 'month', 'year']);
      expect(result?.subentities?.map(s => s.label)).toEqual(['Day', 'Month', 'Year']);
      expect(result?.outputCanonical.keys).toEqual(['day', 'month', 'year']);
    });

    it('should set canonical format to value for simple node', () => {
      vi.mocked(getSubTasksInfo).mockReturnValue([]);

      const node: TaskTreeNode = {
        id: 'email',
        label: 'Email',
        type: 'email'
      };

      const result = buildSemanticContract(node);

      // ✅ Test per canonical format: nodo semplice → "value"
      expect(result?.outputCanonical.format).toBe('value');
      expect(result?.outputCanonical.keys).toBeUndefined();
    });

    it('should set canonical format to object for composite node', () => {
      vi.mocked(getSubTasksInfo).mockReturnValue([
        { subTaskKey: 'day', label: 'Day' },
        { subTaskKey: 'month', label: 'Month' }
      ]);

      const node: TaskTreeNode = {
        id: 'date',
        label: 'Date',
        subNodes: [
          { id: 'day', label: 'Day' } as TaskTreeNode,
          { id: 'month', label: 'Month' } as TaskTreeNode
        ]
      };

      const result = buildSemanticContract(node);

      // ✅ Test per canonical format: nodo composito → "object"
      expect(result?.outputCanonical.format).toBe('object');
      expect(result?.outputCanonical.keys).toEqual(['day', 'month']);
    });
  });
});
