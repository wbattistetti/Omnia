// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect } from 'vitest';
import { buildSubgroup, buildSubgroups } from '../buildSubgroups';
import type { TaskTreeNode } from '../../../types/taskTypes';

describe('buildSubgroups', () => {
  describe('buildSubgroup', () => {
    it('should build subgroup with complete subNode', () => {
      const subNode: TaskTreeNode = {
        id: 'day',
        label: 'Day',
        type: 'number',
        constraints: [
          {
            description: 'Day description',
            validation: {
              min: 1,
              max: 31,
              required: true
            }
          } as any
        ]
      };

      const info = { subTaskKey: 'day', label: 'Day' };
      const result = buildSubgroup(subNode, info);

      expect(result.subTaskKey).toBe('day');
      expect(result.label).toBe('Day');
      expect(result.type).toBe('number');
      expect(result.meaning).toBe('Day description');
      expect(result.optional).toBe(false);
      expect(result.constraints).toEqual({
        min: 1,
        max: 31,
        required: true,
        description: 'Day description'
      });
    });

    it('should build subgroup with undefined subNode', () => {
      const info = { subTaskKey: 'day', label: 'Day' };
      const result = buildSubgroup(undefined, info);

      expect(result.subTaskKey).toBe('day');
      expect(result.label).toBe('Day');
      expect(result.type).toBeUndefined();
      expect(result.meaning).toBe('numeric day of the month (1-31)');
      expect(result.optional).toBe(true);
    });

    it('should build subgroup with all properties', () => {
      const subNode: TaskTreeNode = {
        id: 'month',
        label: 'Month',
        type: 'text',
        constraints: [
          {
            format: ['numeric', 'textual'],
            normalization: 'Custom normalization'
          } as any
        ],
        dataContract: {
          required: false
        } as any
      };

      const info = { subTaskKey: 'month', label: 'Month' };
      const result = buildSubgroup(subNode, info);

      expect(result.subTaskKey).toBe('month');
      expect(result.label).toBe('Month');
      expect(result.type).toBe('text');
      expect(result.optional).toBe(true);
      expect(result.formats).toEqual(['numeric', 'textual']);
      expect(result.normalization).toBe('Custom normalization');
    });

    it('should use heuristic meaning when description is missing', () => {
      const subNode: TaskTreeNode = {
        id: 'year',
        label: 'Year',
        type: 'number'
      };

      const info = { subTaskKey: 'year', label: 'Year' };
      const result = buildSubgroup(subNode, info);

      expect(result.meaning).toBe('year with 2 or 4 digits');
    });

    it('should handle subNode without constraints', () => {
      const subNode: TaskTreeNode = {
        id: 'custom',
        label: 'Custom'
      };

      const info = { subTaskKey: 'custom', label: 'Custom' };
      const result = buildSubgroup(subNode, info);

      expect(result.subTaskKey).toBe('custom');
      expect(result.label).toBe('Custom');
      expect(result.constraints).toBeUndefined();
    });
  });

  describe('buildSubgroups', () => {
    it('should build multiple subgroups', () => {
      const node: TaskTreeNode = {
        id: 'date',
        label: 'Date',
        subNodes: [
          { id: 'day', label: 'Day' } as TaskTreeNode,
          { id: 'month', label: 'Month' } as TaskTreeNode,
          { id: 'year', label: 'Year' } as TaskTreeNode
        ]
      };

      const subTasksInfo = [
        { subTaskKey: 'day', label: 'Day' },
        { subTaskKey: 'month', label: 'Month' },
        { subTaskKey: 'year', label: 'Year' }
      ];

      const result = buildSubgroups(node, subTasksInfo);

      expect(result).toHaveLength(3);
      expect(result[0].subTaskKey).toBe('day');
      expect(result[1].subTaskKey).toBe('month');
      expect(result[2].subTaskKey).toBe('year');
    });

    it('should map subNodes correctly by index', () => {
      const node: TaskTreeNode = {
        id: 'date',
        label: 'Date',
        subNodes: [
          { id: 'day', label: 'Day', type: 'number' } as TaskTreeNode,
          { id: 'month', label: 'Month', type: 'text' } as TaskTreeNode
        ]
      };

      const subTasksInfo = [
        { subTaskKey: 'day', label: 'Day' },
        { subTaskKey: 'month', label: 'Month' }
      ];

      const result = buildSubgroups(node, subTasksInfo);

      expect(result[0].type).toBe('number');
      expect(result[1].type).toBe('text');
    });

    it('should handle missing subNodes', () => {
      const node: TaskTreeNode = {
        id: 'date',
        label: 'Date'
        // No subNodes
      };

      const subTasksInfo = [
        { subTaskKey: 'day', label: 'Day' },
        { subTaskKey: 'month', label: 'Month' }
      ];

      const result = buildSubgroups(node, subTasksInfo);

      expect(result).toHaveLength(2);
      expect(result[0].subTaskKey).toBe('day');
      expect(result[0].type).toBeUndefined();
    });

    it('should handle empty subTasksInfo', () => {
      const node: TaskTreeNode = {
        id: 'node',
        label: 'Node'
      };

      const subTasksInfo: Array<{ subTaskKey: string; label: string }> = [];

      const result = buildSubgroups(node, subTasksInfo);

      expect(result).toHaveLength(0);
    });

    it('should maintain order of subentities', () => {
      const node: TaskTreeNode = {
        id: 'date',
        label: 'Date',
        subNodes: [
          { id: 'day', label: 'Day' } as TaskTreeNode,
          { id: 'month', label: 'Month' } as TaskTreeNode,
          { id: 'year', label: 'Year' } as TaskTreeNode
        ]
      };

      const subTasksInfo = [
        { subTaskKey: 'day', label: 'Day' },
        { subTaskKey: 'month', label: 'Month' },
        { subTaskKey: 'year', label: 'Year' }
      ];

      const result = buildSubgroups(node, subTasksInfo);

      // ✅ Test per ordine stabile e deterministico
      expect(result.map(s => s.subTaskKey)).toEqual(['day', 'month', 'year']);
      expect(result.map(s => s.label)).toEqual(['Day', 'Month', 'Year']);
    });
  });
});
