// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateTestExamplesForNode } from '../generateTestExamples';
import type { TaskTreeNode } from '../../../types/taskTypes';
import type { SemanticContract } from '../../../types/semanticContract';
import type { GenerationProgress } from '../types';

// Mock fetch
global.fetch = vi.fn();

describe('generateTestExamplesForNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockClear();
  });

  describe('successful generation', () => {
    it('should generate test examples for simple contract (value format)', async () => {
      const node: TaskTreeNode = {
        id: 'node1',
        label: 'Email',
        type: 'email'
      };

      const contract: SemanticContract = {
        entity: {
          label: 'Email',
          type: 'email',
          description: 'an email address'
        },
        outputCanonical: {
          format: 'value'
        }
      };

      const mockResponse = {
        success: true,
        testExamples: {
          validExamples: [
            'my email is user@example.com',
            'contact me at admin@test.org',
            'email: test@domain.it'
          ],
          edgeCaseExamples: [
            'user.name+tag@example.co.uk',
            'very.long.email.address@very.long.domain.name.com'
          ],
          invalidExamples: [
            'not an email address',
            'invalid@',
            '@domain.com'
          ]
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const examples = await generateTestExamplesForNode(node, contract);

      expect(examples.length).toBeGreaterThan(0);
      expect(examples.some(e => e.includes('@'))).toBe(true);
      expect(examples.length).toBe(8); // 3 valid + 2 edge + 3 invalid
    });

    it('should generate test examples for composite contract (object format)', async () => {
      const node: TaskTreeNode = {
        id: 'node2',
        label: 'Date of Birth',
        type: 'date'
      };

      const contract: SemanticContract = {
        entity: {
          label: 'Date of Birth',
          type: 'date',
          description: 'a date composed of day, month, and year'
        },
        outputCanonical: {
          format: 'object',
          keys: ['day', 'month', 'year']
        },
        subentities: [
          {
            subTaskKey: 'day',
            label: 'Day',
            meaning: 'numeric day of the month (1-31)'
          },
          {
            subTaskKey: 'month',
            label: 'Month',
            meaning: 'numeric month of the year (1-12)'
          },
          {
            subTaskKey: 'year',
            label: 'Year',
            meaning: 'numeric year (4 digits preferred)'
          }
        ]
      };

      const mockResponse = {
        success: true,
        testExamples: {
          validExamples: [
            'I was born on 15 April 2020',
            'born on 01/01/1990',
            'date of birth: 25-12-1985'
          ],
          edgeCaseExamples: [
            'born in April 2020',
            '01/01/00'
          ],
          invalidExamples: [
            'born on the 32nd of month 13',
            'invalid date format',
            'not a date'
          ]
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const examples = await generateTestExamplesForNode(node, contract);

      expect(examples.length).toBeGreaterThan(0);
      expect(examples.length).toBe(8); // 3 valid + 2 edge + 3 invalid
    });

    it('should call onProgress callback during generation', async () => {
      const node: TaskTreeNode = {
        id: 'node3',
        label: 'Test'
      };

      const contract: SemanticContract = {
        entity: {
          label: 'Test',
          type: 'text',
          description: 'test'
        },
        outputCanonical: { format: 'value' }
      };

      const mockResponse = {
        success: true,
        testExamples: {
          validExamples: ['test input'],
          edgeCaseExamples: [],
          invalidExamples: []
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const progressCalls: GenerationProgress[] = [];
      await generateTestExamplesForNode(node, contract, undefined, (progress) => {
        progressCalls.push(progress);
      });

      expect(progressCalls.length).toBeGreaterThan(0);
      expect(progressCalls[0].currentAction).toContain('Generating test examples');
    });
  });

  describe('fallback behavior', () => {
    it('should return empty array if API call fails and no existing examples', async () => {
      const node: TaskTreeNode = {
        id: 'node4',
        label: 'Test'
      };

      const contract: SemanticContract = {
        entity: {
          label: 'Test',
          type: 'text',
          description: 'test'
        },
        outputCanonical: { format: 'value' }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error'
      });

      const examples = await generateTestExamplesForNode(node, contract);

      expect(examples).toEqual([]);
    });

    it('should return existing examples if API call fails', async () => {
      const node: TaskTreeNode = {
        id: 'node5',
        label: 'Test'
      };

      const contract: SemanticContract = {
        entity: {
          label: 'Test',
          type: 'text',
          description: 'test'
        },
        outputCanonical: { format: 'value' }
      };

      const existingExamples = ['existing example 1', 'existing example 2'];

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error'
      });

      const examples = await generateTestExamplesForNode(node, contract, existingExamples);

      expect(examples).toEqual(existingExamples);
    });

    it('should return existing examples if AI returns no test examples', async () => {
      const node: TaskTreeNode = {
        id: 'node6',
        label: 'Test'
      };

      const contract: SemanticContract = {
        entity: {
          label: 'Test',
          type: 'text',
          description: 'test'
        },
        outputCanonical: { format: 'value' }
      };

      const existingExamples = ['existing example'];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: false })
      });

      const examples = await generateTestExamplesForNode(node, contract, existingExamples);

      expect(examples).toEqual(existingExamples);
    });

    it('should return existing examples if validation fails', async () => {
      const node: TaskTreeNode = {
        id: 'node7',
        label: 'Test'
      };

      const contract: SemanticContract = {
        entity: {
          label: 'Test',
          type: 'text',
          description: 'test'
        },
        outputCanonical: { format: 'value' }
      };

      const existingExamples = ['existing example'];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          testExamples: {
            validExamples: [] // Invalid: must have at least one valid example
          }
        })
      });

      const examples = await generateTestExamplesForNode(node, contract, existingExamples);

      expect(examples).toEqual(existingExamples);
    });
  });

  describe('merge non-destructive', () => {
    it('should merge with existing examples (additive, no duplicates)', async () => {
      const node: TaskTreeNode = {
        id: 'node8',
        label: 'Test'
      };

      const contract: SemanticContract = {
        entity: {
          label: 'Test',
          type: 'text',
          description: 'test'
        },
        outputCanonical: { format: 'value' }
      };

      const existingExamples = ['existing example 1', 'existing example 2'];

      const mockResponse = {
        success: true,
        testExamples: {
          validExamples: ['new example 1', 'existing example 1'], // Duplicate should be filtered
          edgeCaseExamples: ['edge case 1'],
          invalidExamples: ['invalid 1']
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const examples = await generateTestExamplesForNode(node, contract, existingExamples);

      // Should have existing + new (no duplicates)
      expect(examples.length).toBe(5); // 2 existing + 3 new (1 duplicate filtered)
      expect(examples).toContain('existing example 1');
      expect(examples).toContain('existing example 2');
      expect(examples).toContain('new example 1');
      expect(examples).toContain('edge case 1');
      expect(examples).toContain('invalid 1');
    });
  });

  describe('schema validation', () => {
    it('should filter invalid examples in response', async () => {
      const node: TaskTreeNode = {
        id: 'node9',
        label: 'Test'
      };

      const contract: SemanticContract = {
        entity: {
          label: 'Test',
          type: 'text',
          description: 'test'
        },
        outputCanonical: { format: 'value' }
      };

      const mockResponse = {
        success: true,
        testExamples: {
          validExamples: [
            'valid example',
            123, // Invalid: not a string
            '', // Invalid: empty string
            'another valid'
          ],
          edgeCaseExamples: [],
          invalidExamples: []
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const examples = await generateTestExamplesForNode(node, contract);

      // Only valid strings should be included
      expect(examples.length).toBe(2);
      expect(examples).toContain('valid example');
      expect(examples).toContain('another valid');
    });
  });

  describe('snapshot test', () => {
    it('should produce stable test examples for email node', async () => {
      const node: TaskTreeNode = {
        id: 'email-node',
        label: 'Email',
        type: 'email'
      };

      const contract: SemanticContract = {
        entity: {
          label: 'Email',
          type: 'email',
          description: 'an email address'
        },
        outputCanonical: { format: 'value' }
      };

      const mockResponse = {
        success: true,
        testExamples: {
          validExamples: [
            'my email is user@example.com',
            'contact me at admin@test.org'
          ],
          edgeCaseExamples: [
            'user.name+tag@example.co.uk'
          ],
          invalidExamples: [
            'not an email address',
            'invalid@'
          ]
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const examples = await generateTestExamplesForNode(node, contract);

      // Snapshot: verify structure is stable
      const snapshot = {
        examplesCount: examples.length,
        hasValidExamples: examples.some(e => e.includes('@')),
        hasInvalidExamples: examples.some(e => !e.includes('@') || e.endsWith('@'))
      };

      expect(snapshot).toMatchInlineSnapshot(`
        {
          "examplesCount": 5,
          "hasInvalidExamples": true,
          "hasValidExamples": true,
        }
      `);
    });
  });
});
