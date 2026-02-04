// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateConstraintsForNode } from '../generateConstraints';
import type { SemanticContract } from '../../../types/semanticContract';
import type { GenerationProgress } from '../types';

// Mock fetch
global.fetch = vi.fn();

describe('generateConstraintsForNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockClear();
  });

  describe('successful generation', () => {
    it('should generate constraints for email contract', async () => {
      const contract: SemanticContract = {
        entity: {
          label: 'Email',
          type: 'email',
          description: 'an email address'
        },
        outputCanonical: { format: 'value' },
        canonicalExamples: {
          complete: [
            {
              input: 'my email is user@example.com',
              expected: 'user@example.com'
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
        constraints: {
          constraints: {
            format: 'email',
            pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
            minLength: 5,
            maxLength: 254,
            required: true
          },
          subentityConstraints: []
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await generateConstraintsForNode(contract, 'Email');

      expect(result.constraints).toBeDefined();
      expect(result.constraints?.format).toEqual(['email']);
      expect(result.constraints?.pattern).toBe('^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$');
      expect(result.constraints?.minLength).toBe(5);
      expect(result.constraints?.maxLength).toBe(254);
      expect(result.constraints?.required).toBe(true);
      expect(result.version).toBe(2);
    });

    it('should generate constraints for date contract with subentities', async () => {
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
        ],
        canonicalExamples: {
          complete: [
            {
              input: 'I was born on 15 April 2020',
              expected: { day: '15', month: '04', year: '2020' }
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
        constraints: {
          constraints: {
            format: 'date'
          },
          subentityConstraints: [
            {
              subTaskKey: 'day',
              constraints: {
                min: 1,
                max: 31,
                format: 'number'
              }
            },
            {
              subTaskKey: 'month',
              constraints: {
                min: 1,
                max: 12,
                format: 'number'
              }
            },
            {
              subTaskKey: 'year',
              constraints: {
                min: 1900,
                max: 2100,
                format: 'number'
              }
            }
          ]
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await generateConstraintsForNode(contract, 'Date of Birth');

      expect(result.constraints?.format).toEqual(['date']);
      expect(result.subentities?.[0]?.constraints?.min).toBe(1);
      expect(result.subentities?.[0]?.constraints?.max).toBe(31);
      expect(result.subentities?.[1]?.constraints?.min).toBe(1);
      expect(result.subentities?.[1]?.constraints?.max).toBe(12);
      expect(result.subentities?.[2]?.constraints?.min).toBe(1900);
      expect(result.subentities?.[2]?.constraints?.max).toBe(2100);
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
        constraints: {
          constraints: {
            minLength: 1,
            maxLength: 100
          },
          subentityConstraints: []
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const progressCalls: GenerationProgress[] = [];
      await generateConstraintsForNode(contract, 'Test', (progress) => {
        progressCalls.push(progress);
      });

      expect(progressCalls.length).toBeGreaterThan(0);
      expect(progressCalls[0].currentAction).toContain('Generating constraints');
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

      const result = await generateConstraintsForNode(originalContract);

      expect(result).toEqual(originalContract);
    });

    it('should return original contract if AI returns no constraints', async () => {
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

      const result = await generateConstraintsForNode(originalContract);

      expect(result).toEqual(originalContract);
    });

    it('should return original contract if validation fails', async () => {
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
          constraints: 'invalid structure' // Not an object
        })
      });

      const result = await generateConstraintsForNode(originalContract);

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

      const result = await generateConstraintsForNode(originalContract);

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
        constraints: {
          constraints: {
            format: 'date',
            pattern: '^\\d{2}/\\d{2}/\\d{4}$'
          },
          subentityConstraints: []
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await generateConstraintsForNode(originalContract);

      // All original fields preserved
      expect(result.entity.label).toBe('Date');
      expect(result.entity.type).toBe('date');
      expect(result.constraints?.min).toBe(1); // Preserved
      expect(result.constraints?.max).toBe(31); // Preserved
      expect(result.normalization).toBe('original normalization');
      expect(result.redefinitionPolicy).toBe('last_wins');
      expect(result.outputCanonical.format).toBe('object');
      expect(result.version).toBe(2); // Incremented

      // New constraints added
      expect(result.constraints?.format).toEqual(['date']);
      expect(result.constraints?.pattern).toBe('^\\d{2}/\\d{2}/\\d{4}$');
    });

    it('should not overwrite existing constraints', async () => {
      const originalContract: SemanticContract = {
        entity: {
          label: 'Test',
          type: 'text',
          description: 'test'
        },
        outputCanonical: { format: 'value' },
        constraints: {
          minLength: 5,
          maxLength: 100,
          pattern: '^existing$'
        }
      };

      const mockResponse = {
        success: true,
        constraints: {
          constraints: {
            minLength: 10, // Should NOT overwrite existing 5
            maxLength: 200, // Should NOT overwrite existing 100
            pattern: '^new$' // Should NOT overwrite existing pattern
          },
          subentityConstraints: []
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await generateConstraintsForNode(originalContract);

      // Existing constraints preserved
      expect(result.constraints?.minLength).toBe(5); // Not overwritten
      expect(result.constraints?.maxLength).toBe(100); // Not overwritten
      expect(result.constraints?.pattern).toBe('^existing$'); // Not overwritten
    });

    it('should merge examples arrays (non-destructive)', async () => {
      const originalContract: SemanticContract = {
        entity: {
          label: 'Test',
          type: 'text',
          description: 'test'
        },
        outputCanonical: { format: 'value' },
        constraints: {
          examples: {
            valid: ['existing1', 'existing2'],
            invalid: ['invalid1'],
            edgeCases: ['edge1']
          }
        }
      };

      const mockResponse = {
        success: true,
        constraints: {
          constraints: {
            examples: {
              valid: ['new1', 'new2'],
              invalid: ['invalid2'],
              edgeCases: ['edge2']
            }
          },
          subentityConstraints: []
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await generateConstraintsForNode(originalContract);

      // Examples merged (non-destructive)
      expect(result.constraints?.examples?.valid).toHaveLength(4);
      expect(result.constraints?.examples?.valid).toContain('existing1');
      expect(result.constraints?.examples?.valid).toContain('new1');
      expect(result.constraints?.examples?.invalid).toHaveLength(2);
      expect(result.constraints?.examples?.edgeCases).toHaveLength(2);
    });
  });

  describe('schema validation', () => {
    it('should filter invalid subentity constraints', async () => {
      const contract: SemanticContract = {
        entity: {
          label: 'Test',
          type: 'text',
          description: 'test'
        },
        outputCanonical: { format: 'value' },
        subentities: [
          {
            subTaskKey: 'valid',
            label: 'Valid',
            meaning: 'test'
          }
        ]
      };

      const mockResponse = {
        success: true,
        constraints: {
          constraints: {},
          subentityConstraints: [
            { subTaskKey: 'valid', constraints: { min: 1 } },
            { invalid: 'structure' }, // Invalid, should be filtered
            { subTaskKey: 123 }, // Invalid type, should be filtered
            { subTaskKey: 'valid', constraints: 'not object' } // Invalid, should be filtered
          ]
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await generateConstraintsForNode(contract);

      // Only valid subentity constraint should be applied
      expect(result.subentities?.[0]?.constraints?.min).toBe(1);
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
        constraints: {
          constraints: {
            format: 'date'
          },
          subentityConstraints: [
            {
              subTaskKey: 'day',
              constraints: {
                min: 1,
                max: 31
              }
            }
          ]
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await generateConstraintsForNode(legacyContract);

      // Should not crash, should preserve legacy structure
      expect(result.mainGroup).toBeDefined();
      expect(result.subgroups).toBeDefined();
      expect(result.subgroups?.[0]?.constraints?.min).toBe(1);
    });
  });

  describe('snapshot test', () => {
    it('should produce stable constraints for email node', async () => {
      const contract: SemanticContract = {
        entity: {
          label: 'Email',
          type: 'email',
          description: 'an email address'
        },
        outputCanonical: { format: 'value' },
        canonicalExamples: {
          complete: [
            {
              input: 'my email is user@example.com',
              expected: 'user@example.com'
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
        constraints: {
          constraints: {
            format: 'email',
            pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
            minLength: 5,
            maxLength: 254,
            required: true
          },
          subentityConstraints: []
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await generateConstraintsForNode(contract, 'Email');

      // Snapshot: verify structure is stable
      const snapshot = {
        hasConstraints: !!result.constraints,
        format: result.constraints?.format,
        hasPattern: !!result.constraints?.pattern,
        minLength: result.constraints?.minLength,
        maxLength: result.constraints?.maxLength,
        required: result.constraints?.required,
        version: result.version
      };

      expect(snapshot).toMatchInlineSnapshot(`
        {
          "format": [
            "email",
          ],
          "hasConstraints": true,
          "hasPattern": true,
          "maxLength": 254,
          "minLength": 5,
          "required": true,
          "version": 2,
        }
      `);
    });

    it('should produce stable constraints for date node', async () => {
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
        constraints: {
          constraints: {
            format: 'date'
          },
          subentityConstraints: [
            {
              subTaskKey: 'day',
              constraints: {
                min: 1,
                max: 31,
                format: 'number'
              }
            },
            {
              subTaskKey: 'month',
              constraints: {
                min: 1,
                max: 12,
                format: 'number'
              }
            },
            {
              subTaskKey: 'year',
              constraints: {
                min: 1900,
                max: 2100,
                format: 'number'
              }
            }
          ]
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await generateConstraintsForNode(contract, 'Date of Birth');

      // Snapshot: verify structure is stable
      const snapshot = {
        hasConstraints: !!result.constraints,
        format: result.constraints?.format,
        subentityConstraintsCount: result.subentities?.filter(s => s.constraints).length || 0,
        dayMin: result.subentities?.[0]?.constraints?.min,
        dayMax: result.subentities?.[0]?.constraints?.max,
        monthMin: result.subentities?.[1]?.constraints?.min,
        monthMax: result.subentities?.[1]?.constraints?.max,
        yearMin: result.subentities?.[2]?.constraints?.min,
        yearMax: result.subentities?.[2]?.constraints?.max,
        version: result.version
      };

      expect(snapshot).toMatchInlineSnapshot(`
        {
          "dayMax": 31,
          "dayMin": 1,
          "format": [
            "date",
          ],
          "hasConstraints": true,
          "monthMax": 12,
          "monthMin": 1,
          "subentityConstraintsCount": 3,
          "version": 2,
          "yearMax": 2100,
          "yearMin": 1900,
        }
      `);
    });
  });
});
