// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect } from 'vitest';
import {
  readSubgroupMeaning,
  readSubgroupOptionality,
  readSubgroupFormats,
  readSubgroupNormalization,
  readSubgroupConstraints
} from '../readSubgroupProperties';
import type { TaskTreeNode } from '../../../types/taskTypes';

describe('readSubgroupProperties', () => {
  describe('readSubgroupMeaning', () => {
    it('should read meaning from constraints', () => {
      const subNode: TaskTreeNode = {
        id: 'day',
        label: 'Day',
        constraints: [
          {
            description: 'Day description from constraints'
          } as any
        ]
      };

      const result = readSubgroupMeaning(subNode, { subTaskKey: 'day', label: 'Day' });

      expect(result).toBe('Day description from constraints');
    });

    it('should read meaning from constraints.validation', () => {
      const subNode: TaskTreeNode = {
        id: 'day',
        label: 'Day',
        constraints: [
          {
            validation: {
              description: 'Day description from validation'
            }
          } as any
        ]
      };

      const result = readSubgroupMeaning(subNode, { subTaskKey: 'day', label: 'Day' });

      expect(result).toBe('Day description from validation');
    });

    it('should read meaning from dataContract', () => {
      const subNode: TaskTreeNode = {
        id: 'day',
        label: 'Day',
        dataContract: {
          description: 'Day description from dataContract'
        } as any
      };

      const result = readSubgroupMeaning(subNode, { subTaskKey: 'day', label: 'Day' });

      expect(result).toBe('Day description from dataContract');
    });

    it('should use heuristic for day', () => {
      const result = readSubgroupMeaning(undefined, { subTaskKey: 'day', label: 'Day' });

      expect(result).toBe('numeric day of the month (1-31)');
    });

    it('should use heuristic for month', () => {
      const result = readSubgroupMeaning(undefined, { subTaskKey: 'month', label: 'Month' });

      expect(result).toBe('numeric month (1-12) or textual (january, february, etc.)');
    });

    it('should use heuristic for year', () => {
      const result = readSubgroupMeaning(undefined, { subTaskKey: 'year', label: 'Year' });

      expect(result).toBe('year with 2 or 4 digits');
    });

    it('should use heuristic for first name', () => {
      const result = readSubgroupMeaning(undefined, { subTaskKey: 'firstName', label: 'First Name' });

      expect(result).toBe('first name or given name');
    });

    it('should use heuristic for last name', () => {
      const result = readSubgroupMeaning(undefined, { subTaskKey: 'lastName', label: 'Last Name' });

      expect(result).toBe('last name or family name');
    });

    it('should use heuristic for street', () => {
      const result = readSubgroupMeaning(undefined, { subTaskKey: 'street', label: 'Street' });

      expect(result).toBe('street address');
    });

    it('should use generic fallback', () => {
      const subNode: TaskTreeNode = {
        id: 'custom',
        label: 'Custom',
        type: 'text'
      };

      const result = readSubgroupMeaning(subNode, { subTaskKey: 'custom', label: 'Custom' });

      expect(result).toBe('custom of the text');
    });
  });

  describe('readSubgroupOptionality', () => {
    it('should return true (optional) when subNode is undefined', () => {
      const result = readSubgroupOptionality(undefined);

      expect(result).toBe(true);
    });

    it('should read optionality from constraints (required=false)', () => {
      const subNode: TaskTreeNode = {
        id: 'day',
        label: 'Day',
        constraints: [
          {
            required: false
          } as any
        ]
      };

      const result = readSubgroupOptionality(subNode);

      expect(result).toBe(true); // optional = !required
    });

    it('should read optionality from constraints (required=true)', () => {
      const subNode: TaskTreeNode = {
        id: 'day',
        label: 'Day',
        constraints: [
          {
            required: true
          } as any
        ]
      };

      const result = readSubgroupOptionality(subNode);

      expect(result).toBe(false); // optional = !required
    });

    it('should read optionality from constraints.validation', () => {
      const subNode: TaskTreeNode = {
        id: 'day',
        label: 'Day',
        constraints: [
          {
            validation: {
              required: false
            }
          } as any
        ]
      };

      const result = readSubgroupOptionality(subNode);

      expect(result).toBe(true);
    });

    it('should read optionality from dataContract', () => {
      const subNode: TaskTreeNode = {
        id: 'day',
        label: 'Day',
        dataContract: {
          required: false
        } as any
      };

      const result = readSubgroupOptionality(subNode);

      expect(result).toBe(true);
    });

    it('should default to optional when no constraints', () => {
      const subNode: TaskTreeNode = {
        id: 'day',
        label: 'Day'
      };

      const result = readSubgroupOptionality(subNode);

      expect(result).toBe(true);
    });
  });

  describe('readSubgroupFormats', () => {
    it('should return undefined when subNode is undefined', () => {
      const result = readSubgroupFormats(undefined);

      expect(result).toBeUndefined();
    });

    it('should read formats from constraints', () => {
      const subNode: TaskTreeNode = {
        id: 'day',
        label: 'Day',
        constraints: [
          {
            format: ['numeric']
          } as any
        ]
      };

      const result = readSubgroupFormats(subNode);

      expect(result).toEqual(['numeric']);
    });

    it('should convert single format to array', () => {
      const subNode: TaskTreeNode = {
        id: 'day',
        label: 'Day',
        constraints: [
          {
            format: 'numeric'
          } as any
        ]
      };

      const result = readSubgroupFormats(subNode);

      expect(result).toEqual(['numeric']);
    });

    it('should read formats from dataContract', () => {
      const subNode: TaskTreeNode = {
        id: 'day',
        label: 'Day',
        dataContract: {
          format: ['textual']
        } as any
      };

      const result = readSubgroupFormats(subNode);

      expect(result).toEqual(['textual']);
    });

    it('should infer formats for number type', () => {
      const subNode: TaskTreeNode = {
        id: 'day',
        label: 'Day',
        type: 'number'
      };

      const result = readSubgroupFormats(subNode);

      expect(result).toEqual(['numeric']);
    });

    it('should infer formats for text type', () => {
      const subNode: TaskTreeNode = {
        id: 'month',
        label: 'Month',
        type: 'text'
      };

      const result = readSubgroupFormats(subNode);

      expect(result).toEqual(['textual']);
    });

    it('should infer default formats when type is unknown', () => {
      const subNode: TaskTreeNode = {
        id: 'custom',
        label: 'Custom'
      };

      const result = readSubgroupFormats(subNode);

      expect(result).toEqual(['numeric', 'textual']);
    });
  });

  describe('readSubgroupNormalization', () => {
    it('should return undefined when subNode is undefined', () => {
      const result = readSubgroupNormalization(undefined);

      expect(result).toBeUndefined();
    });

    it('should read normalization from constraints', () => {
      const subNode: TaskTreeNode = {
        id: 'year',
        label: 'Year',
        constraints: [
          {
            normalization: 'Custom normalization'
          } as any
        ]
      };

      const result = readSubgroupNormalization(subNode);

      expect(result).toBe('Custom normalization');
    });

    it('should read normalization from dataContract', () => {
      const subNode: TaskTreeNode = {
        id: 'year',
        label: 'Year',
        dataContract: {
          normalization: 'Normalize from dataContract'
        } as any
      };

      const result = readSubgroupNormalization(subNode);

      expect(result).toBe('Normalize from dataContract');
    });

    it('should infer normalization for year', () => {
      const subNode: TaskTreeNode = {
        id: 'year',
        label: 'Year',
        subTaskKey: 'year'
      };

      const result = readSubgroupNormalization(subNode);

      expect(result).toBe('year always 4 digits (61 -> 1961, 05 -> 2005)');
    });

    it('should infer normalization for month', () => {
      const subNode: TaskTreeNode = {
        id: 'month',
        label: 'Month',
        subTaskKey: 'month'
      };

      const result = readSubgroupNormalization(subNode);

      expect(result).toBe('month always numeric (january -> 1, february -> 2)');
    });

    it('should infer normalization for day', () => {
      const subNode: TaskTreeNode = {
        id: 'day',
        label: 'Day',
        subTaskKey: 'day'
      };

      const result = readSubgroupNormalization(subNode);

      expect(result).toBe('day always numeric (1-31)');
    });

    it('should return undefined when no normalization is available', () => {
      const subNode: TaskTreeNode = {
        id: 'custom',
        label: 'Custom',
        subTaskKey: 'custom'
      };

      const result = readSubgroupNormalization(subNode);

      expect(result).toBeUndefined();
    });
  });

  describe('readSubgroupConstraints', () => {
    it('should return undefined when subNode is undefined', () => {
      const result = readSubgroupConstraints(undefined);

      expect(result).toBeUndefined();
    });

    it('should delegate to readEntityConstraints', () => {
      const subNode: TaskTreeNode = {
        id: 'day',
        label: 'Day',
        constraints: [
          {
            validation: {
              min: 1,
              max: 31
            }
          } as any
        ]
      };

      const result = readSubgroupConstraints(subNode);

      expect(result).toEqual({
        min: 1,
        max: 31
      });
    });
  });
});
