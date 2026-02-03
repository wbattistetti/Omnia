// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect } from 'vitest';
import {
  readEntityDescription,
  readEntityConstraints,
  readEntityNormalization,
  readRedefinitionPolicy
} from '../readEntityProperties';
import type { TaskTreeNode } from '../../../types/taskTypes';
import type { RedefinitionPolicy } from '../../../types/semanticContract';

describe('readEntityProperties', () => {
  describe('readEntityDescription', () => {
    it('should read description from constraints', () => {
      const node: TaskTreeNode = {
        id: 'node1',
        label: 'Test Node',
        constraints: [
          {
            description: 'A test description from constraints'
          } as any
        ]
      };

      const result = readEntityDescription(node, []);

      expect(result).toBe('A test description from constraints');
    });

    it('should read description from constraints.validation', () => {
      const node: TaskTreeNode = {
        id: 'node1',
        label: 'Test Node',
        constraints: [
          {
            validation: {
              description: 'A test description from validation'
            }
          } as any
        ]
      };

      const result = readEntityDescription(node, []);

      expect(result).toBe('A test description from validation');
    });

    it('should read description from dataContract', () => {
      const node: TaskTreeNode = {
        id: 'node1',
        label: 'Test Node',
        dataContract: {
          description: 'A test description from dataContract'
        } as any
      };

      const result = readEntityDescription(node, []);

      expect(result).toBe('A test description from dataContract');
    });

    it('should read description from dataContract.validation', () => {
      const node: TaskTreeNode = {
        id: 'node1',
        label: 'Test Node',
        dataContract: {
          validation: {
            description: 'A test description from dataContract.validation'
          }
        } as any
      };

      const result = readEntityDescription(node, []);

      expect(result).toBe('A test description from dataContract.validation');
    });

    it('should use heuristic fallback for simple node', () => {
      const node: TaskTreeNode = {
        id: 'node1',
        label: 'Test Node',
        type: 'date'
      };

      const result = readEntityDescription(node, []);

      expect(result).toBe('a simple date');
    });

    it('should use heuristic fallback for composite node', () => {
      const node: TaskTreeNode = {
        id: 'node1',
        label: 'Date of Birth',
        type: 'date'
      };

      const subTasksInfo = [
        { subTaskKey: 'day', label: 'Day' },
        { subTaskKey: 'month', label: 'Month' },
        { subTaskKey: 'year', label: 'Year' }
      ];

      const result = readEntityDescription(node, subTasksInfo);

      expect(result).toBe('a date of birth composed of day, month, year');
    });

    it('should use generic type when type is missing', () => {
      const node: TaskTreeNode = {
        id: 'node1',
        label: 'Test Node'
      };

      const result = readEntityDescription(node, []);

      expect(result).toBe('a simple value');
    });

    it('should prioritize constraints over dataContract', () => {
      const node: TaskTreeNode = {
        id: 'node1',
        label: 'Test Node',
        constraints: [
          {
            description: 'From constraints'
          } as any
        ],
        dataContract: {
          description: 'From dataContract'
        } as any
      };

      const result = readEntityDescription(node, []);

      expect(result).toBe('From constraints');
    });
  });

  describe('readEntityConstraints', () => {
    it('should return undefined for empty constraints', () => {
      const node: TaskTreeNode = {
        id: 'node1',
        label: 'Test Node'
      };

      const result = readEntityConstraints(node);

      expect(result).toBeUndefined();
    });

    it('should read min/max constraints', () => {
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

      const result = readEntityConstraints(node);

      expect(result).toEqual({
        min: 0,
        max: 100
      });
    });

    it('should read minLength/maxLength constraints', () => {
      const node: TaskTreeNode = {
        id: 'node1',
        label: 'Test Node',
        constraints: [
          {
            validation: {
              minLength: 2,
              maxLength: 50
            }
          } as any
        ]
      };

      const result = readEntityConstraints(node);

      expect(result).toEqual({
        minLength: 2,
        maxLength: 50
      });
    });

    it('should read format as array', () => {
      const node: TaskTreeNode = {
        id: 'node1',
        label: 'Test Node',
        constraints: [
          {
            validation: {
              format: ['numeric', 'textual']
            }
          } as any
        ]
      };

      const result = readEntityConstraints(node);

      expect(result?.format).toEqual(['numeric', 'textual']);
    });

    it('should convert single format to array', () => {
      const node: TaskTreeNode = {
        id: 'node1',
        label: 'Test Node',
        constraints: [
          {
            validation: {
              format: 'numeric'
            }
          } as any
        ]
      };

      const result = readEntityConstraints(node);

      expect(result?.format).toEqual(['numeric']);
    });

    it('should read pattern constraint', () => {
      const node: TaskTreeNode = {
        id: 'node1',
        label: 'Test Node',
        constraints: [
          {
            validation: {
              pattern: '\\d{2}/\\d{2}/\\d{4}'
            }
          } as any
        ]
      };

      const result = readEntityConstraints(node);

      expect(result?.pattern).toBe('\\d{2}/\\d{2}/\\d{4}');
    });

    it('should read regex as pattern', () => {
      const node: TaskTreeNode = {
        id: 'node1',
        label: 'Test Node',
        constraints: [
          {
            validation: {
              regex: '\\d+'
            }
          } as any
        ]
      };

      const result = readEntityConstraints(node);

      expect(result?.pattern).toBe('\\d+');
    });

    it('should read required constraint', () => {
      const node: TaskTreeNode = {
        id: 'node1',
        label: 'Test Node',
        constraints: [
          {
            validation: {
              required: true
            }
          } as any
        ]
      };

      const result = readEntityConstraints(node);

      expect(result?.required).toBe(true);
    });

    it('should read examples constraint', () => {
      const node: TaskTreeNode = {
        id: 'node1',
        label: 'Test Node',
        constraints: [
          {
            validation: {
              examples: {
                valid: ['example1', 'example2'],
                invalid: ['bad1'],
                edgeCases: ['edge1']
              }
            }
          } as any
        ]
      };

      const result = readEntityConstraints(node);

      expect(result?.examples).toEqual({
        valid: ['example1', 'example2'],
        invalid: ['bad1'],
        edgeCases: ['edge1']
      });
    });

    it('should read description from validation', () => {
      const node: TaskTreeNode = {
        id: 'node1',
        label: 'Test Node',
        constraints: [
          {
            validation: {
              description: 'Constraint description'
            }
          } as any
        ]
      };

      const result = readEntityConstraints(node);

      expect(result?.description).toBe('Constraint description');
    });

    it('should read description from constraint root', () => {
      const node: TaskTreeNode = {
        id: 'node1',
        label: 'Test Node',
        constraints: [
          {
            description: 'Constraint description',
            validation: {}
          } as any
        ]
      };

      const result = readEntityConstraints(node);

      expect(result?.description).toBe('Constraint description');
    });

    it('should return undefined when validation is missing', () => {
      const node: TaskTreeNode = {
        id: 'node1',
        label: 'Test Node',
        constraints: [
          {} as any
        ]
      };

      const result = readEntityConstraints(node);

      expect(result).toBeUndefined();
    });

    it('should return undefined when no properties are set', () => {
      const node: TaskTreeNode = {
        id: 'node1',
        label: 'Test Node',
        constraints: [
          {
            validation: {}
          } as any
        ]
      };

      const result = readEntityConstraints(node);

      expect(result).toBeUndefined();
    });
  });

  describe('readEntityNormalization', () => {
    it('should read normalization from constraints', () => {
      const node: TaskTreeNode = {
        id: 'node1',
        label: 'Test Node',
        constraints: [
          {
            normalization: 'Normalize to uppercase'
          } as any
        ]
      };

      const result = readEntityNormalization(node);

      expect(result).toBe('Normalize to uppercase');
    });

    it('should read normalization from constraints.validation', () => {
      const node: TaskTreeNode = {
        id: 'node1',
        label: 'Test Node',
        constraints: [
          {
            validation: {
              normalization: 'Normalize from validation'
            }
          } as any
        ]
      };

      const result = readEntityNormalization(node);

      expect(result).toBe('Normalize from validation');
    });

    it('should read normalization from dataContract', () => {
      const node: TaskTreeNode = {
        id: 'node1',
        label: 'Test Node',
        dataContract: {
          normalization: 'Normalize from dataContract'
        } as any
      };

      const result = readEntityNormalization(node);

      expect(result).toBe('Normalize from dataContract');
    });

    it('should return undefined when normalization is missing', () => {
      const node: TaskTreeNode = {
        id: 'node1',
        label: 'Test Node'
      };

      const result = readEntityNormalization(node);

      expect(result).toBeUndefined();
    });

    it('should prioritize constraints over dataContract', () => {
      const node: TaskTreeNode = {
        id: 'node1',
        label: 'Test Node',
        constraints: [
          {
            normalization: 'From constraints'
          } as any
        ],
        dataContract: {
          normalization: 'From dataContract'
        } as any
      };

      const result = readEntityNormalization(node);

      expect(result).toBe('From constraints');
    });
  });

  describe('readRedefinitionPolicy', () => {
    it('should read redefinitionPolicy from constraints', () => {
      const node: TaskTreeNode = {
        id: 'node1',
        label: 'Test Node',
        constraints: [
          {
            redefinitionPolicy: 'first_wins'
          } as any
        ]
      };

      const result = readRedefinitionPolicy(node);

      expect(result).toBe('first_wins');
    });

    it('should read redefinitionPolicy from constraints.validation', () => {
      const node: TaskTreeNode = {
        id: 'node1',
        label: 'Test Node',
        constraints: [
          {
            validation: {
              redefinitionPolicy: 'accumulate'
            }
          } as any
        ]
      };

      const result = readRedefinitionPolicy(node);

      expect(result).toBe('accumulate');
    });

    it('should read redefinitionPolicy from dataContract', () => {
      const node: TaskTreeNode = {
        id: 'node1',
        label: 'Test Node',
        dataContract: {
          redefinitionPolicy: 'explicit_correction'
        } as any
      };

      const result = readRedefinitionPolicy(node);

      expect(result).toBe('explicit_correction');
    });

    it('should return undefined when redefinitionPolicy is missing', () => {
      const node: TaskTreeNode = {
        id: 'node1',
        label: 'Test Node'
      };

      const result = readRedefinitionPolicy(node);

      expect(result).toBeUndefined();
    });

    it('should prioritize constraints over dataContract', () => {
      const node: TaskTreeNode = {
        id: 'node1',
        label: 'Test Node',
        constraints: [
          {
            redefinitionPolicy: 'first_wins'
          } as any
        ],
        dataContract: {
          redefinitionPolicy: 'accumulate'
        } as any
      };

      const result = readRedefinitionPolicy(node);

      expect(result).toBe('first_wins');
    });
  });
});
