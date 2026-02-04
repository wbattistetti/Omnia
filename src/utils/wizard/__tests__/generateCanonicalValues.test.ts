// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateCanonicalValuesForNode } from '../generateCanonicalValues';
import type { SemanticContract } from '../../../types/semanticContract';
import type { GenerationProgress } from '../types';

// Mock fetch
global.fetch = vi.fn();

describe('generateCanonicalValuesForNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockClear();
  });

  describe('successful generation', () => {
    it('should generate canonical values for simple contract (value format)', async () => {
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
        canonicalValues: {
          canonicalExamples: [
            {
              input: 'my email is user@example.com',
              expected: 'user@example.com',
              description: 'Standard email format'
            },
            {
              input: 'contact me at admin@test.org',
              expected: 'admin@test.org'
            }
          ],
          partialExamples: [
            {
              input: 'email: user@',
              expected: null,
              description: 'Incomplete email'
            }
          ],
          invalidExamples: [
            {
              input: 'not an email address',
              expected: null,
              description: 'Not a valid email'
            }
          ]
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await generateCanonicalValuesForNode(contract, 'Email');

      expect(result.canonicalExamples).toBeDefined();
      expect(result.canonicalExamples?.complete).toHaveLength(2);
      expect(result.canonicalExamples?.complete[0].input).toBe('my email is user@example.com');
      expect(result.canonicalExamples?.complete[0].expected).toBe('user@example.com');
      expect(result.canonicalExamples?.partial).toHaveLength(1);
      expect(result.canonicalExamples?.stress).toHaveLength(1);
      expect(result.version).toBe(2);
    });

    it('should generate canonical values for composite contract (object format)', async () => {
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
        canonicalValues: {
          canonicalExamples: [
            {
              input: 'I was born on 15 April 2020',
              expected: { day: '15', month: '04', year: '2020' },
              description: 'Full date with all components'
            }
          ],
          partialExamples: [
            {
              input: 'born in April 2020',
              expected: { day: null, month: '04', year: '2020' },
              description: 'Missing day component'
            }
          ],
          invalidExamples: [
            {
              input: 'born on the 32nd of month 13',
              expected: null,
              description: 'Invalid date values'
            }
          ]
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await generateCanonicalValuesForNode(contract, 'Date of Birth');

      expect(result.canonicalExamples).toBeDefined();
      expect(result.canonicalExamples?.complete).toHaveLength(1);
      expect(result.canonicalExamples?.complete[0].expected).toEqual({
        day: '15',
        month: '04',
        year: '2020'
      });
    });

    it('should call onProgress callback during generation', async () => {
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
        canonicalValues: {
          canonicalExamples: [
            {
              input: 'test input',
              expected: 'test output'
            }
          ],
          partialExamples: [],
          invalidExamples: []
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const progressCalls: GenerationProgress[] = [];
      await generateCanonicalValuesForNode(contract, 'Test', (progress) => {
        progressCalls.push(progress);
      });

      expect(progressCalls.length).toBeGreaterThan(0);
      expect(progressCalls[0].currentAction).toContain('Generating canonical values');
    });
  });

  describe('fallback behavior', () => {
    it('should return original contract if API call fails', async () => {
      const originalContract: SemanticContract = {
        entity: {
          label: 'Test',
          type: 'text',
          description: 'original'
        },
        outputCanonical: { format: 'value' }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error'
      });

      const result = await generateCanonicalValuesForNode(originalContract);

      expect(result).toEqual(originalContract);
      expect(result.canonicalExamples).toBeUndefined();
    });

    it('should return original contract if AI returns no canonical values', async () => {
      const originalContract: SemanticContract = {
        entity: {
          label: 'Test',
          type: 'text',
          description: 'original'
        },
        outputCanonical: { format: 'value' }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: false })
      });

      const result = await generateCanonicalValuesForNode(originalContract);

      expect(result).toEqual(originalContract);
    });

    it('should return original contract if validation fails (no canonical examples)', async () => {
      const originalContract: SemanticContract = {
        entity: {
          label: 'Test',
          type: 'text',
          description: 'original'
        },
        outputCanonical: { format: 'value' }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          canonicalValues: {
            canonicalExamples: [], // Invalid: must have at least one
            partialExamples: [],
            invalidExamples: []
          }
        })
      });

      const result = await generateCanonicalValuesForNode(originalContract);

      expect(result).toEqual(originalContract);
    });

    it('should return original contract if fetch throws error', async () => {
      const originalContract: SemanticContract = {
        entity: {
          label: 'Test',
          type: 'text',
          description: 'original'
        },
        outputCanonical: { format: 'value' }
      };

      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const result = await generateCanonicalValuesForNode(originalContract);

      expect(result).toEqual(originalContract);
    });
  });

  describe('merge non-destructive', () => {
    it('should preserve all existing contract fields', async () => {
      const originalContract: SemanticContract = {
        entity: {
          label: 'Date',
          type: 'date',
          description: 'original description'
        },
        constraints: {
          min: 1,
          max: 31
        },
        normalization: 'original normalization',
        redefinitionPolicy: 'last_wins',
        outputCanonical: {
          format: 'object',
          keys: ['day', 'month']
        },
        version: 1,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01')
      };

      const mockResponse = {
        success: true,
        canonicalValues: {
          canonicalExamples: [
            {
              input: 'test',
              expected: { day: '1', month: '01' }
            }
          ],
          partialExamples: [],
          invalidExamples: []
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await generateCanonicalValuesForNode(originalContract);

      // All original fields preserved
      expect(result.entity.label).toBe('Date');
      expect(result.entity.type).toBe('date');
      expect(result.constraints?.min).toBe(1);
      expect(result.constraints?.max).toBe(31);
      expect(result.normalization).toBe('original normalization');
      expect(result.redefinitionPolicy).toBe('last_wins');
      expect(result.outputCanonical.format).toBe('object');
      expect(result.outputCanonical.keys).toEqual(['day', 'month']);
      expect(result.version).toBe(2); // Incremented
    });

    it('should merge with existing canonicalExamples (non-destructive)', async () => {
      const originalContract: SemanticContract = {
        entity: {
          label: 'Test',
          type: 'text',
          description: 'test'
        },
        outputCanonical: { format: 'value' },
        canonicalExamples: {
          complete: [
            {
              input: 'existing example',
              expected: 'existing output'
            }
          ],
          partial: [],
          incomplete: [],
          ambiguous: [],
          noisy: [],
          stress: []
        }
      };

      const mockResponse = {
        success: true,
        canonicalValues: {
          canonicalExamples: [
            {
              input: 'new example',
              expected: 'new output'
            }
          ],
          partialExamples: [
            {
              input: 'partial example',
              expected: null
            }
          ],
          invalidExamples: []
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await generateCanonicalValuesForNode(originalContract);

      // Existing examples preserved
      expect(result.canonicalExamples?.complete).toHaveLength(2);
      expect(result.canonicalExamples?.complete[0].input).toBe('existing example');
      expect(result.canonicalExamples?.complete[1].input).toBe('new example');
      // New partial examples added
      expect(result.canonicalExamples?.partial).toHaveLength(1);
    });
  });

  describe('schema validation', () => {
    it('should filter invalid examples in response', async () => {
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
        canonicalValues: {
          canonicalExamples: [
            { input: 'valid example', expected: 'output' },
            { invalid: 'structure' }, // Invalid, should be filtered
            { input: 123 }, // Invalid type, should be filtered
            { input: 'valid', expected: 'output' } // Valid
          ],
          partialExamples: [],
          invalidExamples: []
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await generateCanonicalValuesForNode(contract);

      // Only valid examples should be included
      expect(result.canonicalExamples?.complete).toHaveLength(2);
      expect(result.canonicalExamples?.complete[0].input).toBe('valid example');
      expect(result.canonicalExamples?.complete[1].input).toBe('valid');
    });

    it('should ensure invalidExamples have expected: null', async () => {
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
        canonicalValues: {
          canonicalExamples: [
            { input: 'valid', expected: 'output' }
          ],
          partialExamples: [],
          invalidExamples: [
            { input: 'invalid', expected: null }, // Valid
            { input: 'invalid2', expected: 'not null' } // Invalid, should be filtered
          ]
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await generateCanonicalValuesForNode(contract);

      // Only invalid examples with expected: null should be included
      expect(result.canonicalExamples?.stress).toHaveLength(1);
      expect(result.canonicalExamples?.stress[0].input).toBe('invalid');
      expect(result.canonicalExamples?.stress[0].expected).toBeNull();
    });
  });

  describe('backward compatibility', () => {
    it('should work with legacy contract structure', async () => {
      const legacyContract: any = {
        mainGroup: {
          name: 'Date',
          description: 'date',
          kind: 'date'
        },
        subgroups: [
          {
            subTaskKey: 'day',
            label: 'Day',
            meaning: 'day'
          }
        ],
        outputCanonical: { format: 'object', keys: ['day'] }
      };

      const mockResponse = {
        success: true,
        canonicalValues: {
          canonicalExamples: [
            {
              input: 'test',
              expected: { day: '1' }
            }
          ],
          partialExamples: [],
          invalidExamples: []
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await generateCanonicalValuesForNode(legacyContract);

      // Should not crash, should preserve legacy structure
      expect(result.mainGroup).toBeDefined();
      expect(result.subgroups).toBeDefined();
      expect(result.canonicalExamples).toBeDefined();
    });
  });

  describe('snapshot test', () => {
    it('should produce stable canonical values for email node', async () => {
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
        canonicalValues: {
          canonicalExamples: [
            {
              input: 'my email is user@example.com',
              expected: 'user@example.com',
              description: 'Standard email format'
            },
            {
              input: 'contact me at admin@test.org',
              expected: 'admin@test.org'
            }
          ],
          partialExamples: [
            {
              input: 'email: user@',
              expected: null,
              description: 'Incomplete email'
            }
          ],
          invalidExamples: [
            {
              input: 'not an email address',
              expected: null,
              description: 'Not a valid email'
            }
          ]
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await generateCanonicalValuesForNode(contract, 'Email');

      // Snapshot: verify structure is stable
      const snapshot = {
        hasCanonicalExamples: !!result.canonicalExamples,
        completeCount: result.canonicalExamples?.complete.length || 0,
        partialCount: result.canonicalExamples?.partial.length || 0,
        stressCount: result.canonicalExamples?.stress.length || 0,
        outputFormat: result.outputCanonical.format,
        version: result.version
      };

      expect(snapshot).toMatchInlineSnapshot(`
        {
          "completeCount": 2,
          "hasCanonicalExamples": true,
          "outputFormat": "value",
          "partialCount": 1,
          "stressCount": 1,
          "version": 2,
        }
      `);
    });

    it('should produce stable canonical values for date node', async () => {
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
        canonicalValues: {
          canonicalExamples: [
            {
              input: 'I was born on 15 April 2020',
              expected: { day: '15', month: '04', year: '2020' },
              description: 'Full date with all components'
            }
          ],
          partialExamples: [
            {
              input: 'born in April 2020',
              expected: { day: null, month: '04', year: '2020' },
              description: 'Missing day component'
            }
          ],
          invalidExamples: [
            {
              input: 'born on the 32nd of month 13',
              expected: null,
              description: 'Invalid date values'
            }
          ]
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await generateCanonicalValuesForNode(contract, 'Date of Birth');

      // Snapshot: verify structure is stable
      const snapshot = {
        hasCanonicalExamples: !!result.canonicalExamples,
        completeCount: result.canonicalExamples?.complete.length || 0,
        partialCount: result.canonicalExamples?.partial.length || 0,
        stressCount: result.canonicalExamples?.stress.length || 0,
        outputFormat: result.outputCanonical.format,
        outputKeys: result.outputCanonical.keys,
        version: result.version
      };

      expect(snapshot).toMatchInlineSnapshot(`
        {
          "completeCount": 1,
          "hasCanonicalExamples": true,
          "outputFormat": "object",
          "outputKeys": [
            "day",
            "month",
            "year",
          ],
          "partialCount": 1,
          "stressCount": 1,
          "version": 2,
        }
      `);
    });
  });
});
