// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateTestExamplesForNode } from '../generateTestExamples';
import type { TaskTreeNode } from '../../../types/taskTypes';
import type { SemanticContract } from '../../../types/semanticContract';
import type { GenerationProgress } from '../types';

// Mock global fetch (for future AI integration)
global.fetch = vi.fn();

describe('generateTestExamplesForNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generation for simple node', () => {
    it('should generate examples for email type', async () => {
      const node: TaskTreeNode = {
        id: 'node1',
        label: 'Email',
        type: 'email'
      };

      const contract: SemanticContract = {
        entity: {
          label: 'Email',
          type: 'email',
          description: 'An email address'
        },
        outputCanonical: {
          format: 'value'
        }
      };

      const examples = await generateTestExamplesForNode(node, contract);

      expect(examples.length).toBeGreaterThan(0);
      expect(examples.some(e => e.includes('@'))).toBe(true);
    });

    it('should generate examples for phone type', async () => {
      const node: TaskTreeNode = {
        id: 'node1',
        label: 'Phone',
        type: 'phone'
      };

      const contract: SemanticContract = {
        entity: {
          label: 'Phone',
          type: 'phone',
          description: 'A phone number'
        },
        outputCanonical: {
          format: 'value'
        }
      };

      const examples = await generateTestExamplesForNode(node, contract);

      expect(examples.length).toBeGreaterThan(0);
      expect(examples.some(e => /\d/.test(e))).toBe(true);
    });

    it('should generate generic examples for unknown type', async () => {
      const node: TaskTreeNode = {
        id: 'node1',
        label: 'Text',
        type: 'text'
      };

      const contract: SemanticContract = {
        entity: {
          label: 'Text',
          type: 'text',
          description: 'A text value'
        },
        outputCanonical: {
          format: 'value'
        }
      };

      const examples = await generateTestExamplesForNode(node, contract);

      expect(examples.length).toBeGreaterThan(0);
    });
  });

  describe('generation for composite node', () => {
    it('should generate examples for date with subentities', async () => {
      const node: TaskTreeNode = {
        id: 'node1',
        label: 'Date of Birth',
        type: 'date',
        subNodes: [
          { id: 'day', label: 'Day' } as TaskTreeNode,
          { id: 'month', label: 'Month' } as TaskTreeNode,
          { id: 'year', label: 'Year' } as TaskTreeNode
        ]
      };

      const contract: SemanticContract = {
        entity: {
          label: 'Date of Birth',
          type: 'date',
          description: 'A date with day, month, year'
        },
        subentities: [
          {
            subTaskKey: 'day',
            label: 'Day',
            type: 'number'
          },
          {
            subTaskKey: 'month',
            label: 'Month',
            type: 'string'
          },
          {
            subTaskKey: 'year',
            label: 'Year',
            type: 'number'
          }
        ],
        outputCanonical: {
          format: 'object',
          keys: ['day', 'month', 'year']
        }
      };

      const examples = await generateTestExamplesForNode(node, contract);

      expect(examples.length).toBeGreaterThan(0);
      // Should have at least one complete example
      expect(examples.some(e => e.includes('aprile') || e.includes('marzo'))).toBe(true);
    });

    it('should generate partial examples for composite node', async () => {
      const node: TaskTreeNode = {
        id: 'node1',
        label: 'Date',
        type: 'date',
        subNodes: [
          { id: 'month', label: 'Month' } as TaskTreeNode,
          { id: 'year', label: 'Year' } as TaskTreeNode
        ]
      };

      const contract: SemanticContract = {
        entity: {
          label: 'Date',
          type: 'date',
          description: 'A date'
        },
        subentities: [
          {
            subTaskKey: 'month',
            label: 'Month',
            type: 'string'
          },
          {
            subTaskKey: 'year',
            label: 'Year',
            type: 'number'
          }
        ],
        outputCanonical: {
          format: 'object',
          keys: ['month', 'year']
        }
      };

      const examples = await generateTestExamplesForNode(node, contract);

      expect(examples.length).toBeGreaterThan(1); // Should have complete and partial examples
    });
  });

  describe('progress reporting', () => {
    it('should call onProgress callback', async () => {
      const node: TaskTreeNode = {
        id: 'node1',
        label: 'Test Node'
      };

      const contract: SemanticContract = {
        entity: {
          label: 'Test Node',
          type: 'text',
          description: 'A text'
        },
        outputCanonical: {
          format: 'value'
        }
      };

      const progressCalls: GenerationProgress[] = [];

      await generateTestExamplesForNode(node, contract, (progress) => {
        progressCalls.push(progress);
      });

      expect(progressCalls.length).toBeGreaterThan(0);
      expect(progressCalls[0].currentAction).toBe('Generating test examples...');
      expect(progressCalls[progressCalls.length - 1].currentAction).toContain('Generated');
    });
  });

  describe('edge cases', () => {
    it('should handle contract with legacy subgroups', async () => {
      const node: TaskTreeNode = {
        id: 'node1',
        label: 'Date'
      };

      const contract: SemanticContract = {
        entity: {
          label: 'Date',
          type: 'date',
          description: 'A date'
        },
        subgroups: [
          {
            subTaskKey: 'day',
            label: 'Day',
            type: 'number'
          }
        ],
        outputCanonical: {
          format: 'object',
          keys: ['day']
        }
      };

      const examples = await generateTestExamplesForNode(node, contract);

      expect(examples.length).toBeGreaterThan(0);
    });

    it('should handle node without label', async () => {
      const node: TaskTreeNode = {
        id: 'node1'
      };

      const contract: SemanticContract = {
        entity: {
          label: 'node1',
          type: 'text',
          description: 'A text'
        },
        outputCanonical: {
          format: 'value'
        }
      };

      const progressCalls: GenerationProgress[] = [];

      await generateTestExamplesForNode(node, contract, (progress) => {
        progressCalls.push(progress);
      });

      expect(progressCalls[0].currentNodeLabel).toBe('node1');
    });

    it('should handle contract with mainGroup (legacy)', async () => {
      const node: TaskTreeNode = {
        id: 'node1',
        label: 'Test'
      };

      const contract: SemanticContract = {
        entity: {
          label: 'Test',
          type: 'text',
          description: 'A text'
        },
        mainGroup: {
          name: 'test',
          description: 'test',
          kind: 'email'
        },
        outputCanonical: {
          format: 'value'
        }
      };

      const examples = await generateTestExamplesForNode(node, contract);

      expect(examples.length).toBeGreaterThan(0);
    });
  });
});
