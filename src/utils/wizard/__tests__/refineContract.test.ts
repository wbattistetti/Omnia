// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { refineContract } from '../refineContract';
import type { SemanticContract } from '../../../types/semanticContract';
import type { GenerationProgress } from '../types';

// Mock fetch
global.fetch = vi.fn();

describe('refineContract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockClear();
  });

  describe('successful refinement', () => {
    it('should refine contract with AI enhancements', async () => {
      const originalContract: SemanticContract = {
        entity: {
          label: 'Date of Birth',
          type: 'date',
          description: 'a date'
        },
        outputCanonical: {
          format: 'object',
          keys: ['day', 'month', 'year']
        },
        subentities: [
          {
            subTaskKey: 'day',
            label: 'Day',
            meaning: 'day'
          }
        ]
      };

      const mockRefinement = {
        success: true,
        refinement: {
          enhancedDescription: 'a date composed of day, month, and year components',
          enhancedSubentities: [
            {
              subTaskKey: 'day',
              enhancedMeaning: 'numeric day of the month (1-31)',
              enhancedConstraints: {
                description: 'Day must be between 1 and 31',
                examples: {
                  valid: ['1', '15', '31'],
                  invalid: ['0', '32', 'abc'],
                  edgeCases: ['1', '31']
                }
              }
            }
          ]
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRefinement
      });

      const result = await refineContract(originalContract, 'Date of Birth');

      expect(result.entity.description).toBe('a date composed of day, month, and year components');
      expect(result.subentities?.[0]?.meaning).toBe('numeric day of the month (1-31)');
      expect(result.subentities?.[0]?.constraints?.description).toBe('Day must be between 1 and 31');
      expect(result.updatedAt).toBeDefined();
      expect(result.version).toBe(2);
    });

    it('should call onProgress callback during refinement', async () => {
      const contract: SemanticContract = {
        entity: {
          label: 'Test',
          type: 'text',
          description: 'test'
        },
        outputCanonical: { format: 'value' }
      };

      const mockRefinement = {
        success: true,
        refinement: {
          enhancedDescription: 'enhanced description'
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRefinement
      });

      const progressCalls: GenerationProgress[] = [];
      await refineContract(contract, 'Test', (progress) => {
        progressCalls.push(progress);
      });

      expect(progressCalls.length).toBeGreaterThan(0);
      expect(progressCalls[0].currentAction).toContain('Refining contract');
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

      const result = await refineContract(originalContract);

      expect(result).toEqual(originalContract);
      expect(result.entity.description).toBe('original');
    });

    it('should return original contract if AI returns no refinement', async () => {
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

      const result = await refineContract(originalContract);

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
          refinement: 'invalid structure' // Not an object
        })
      });

      const result = await refineContract(originalContract);

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

      const result = await refineContract(originalContract);

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

      const mockRefinement = {
        success: true,
        refinement: {
          enhancedDescription: 'enhanced description'
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRefinement
      });

      const result = await refineContract(originalContract);

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

    it('should not modify contract structure', async () => {
      const originalContract: SemanticContract = {
        entity: {
          label: 'Test',
          type: 'text',
          description: 'test'
        },
        outputCanonical: { format: 'value' },
        subentities: [
          {
            subTaskKey: 'field1',
            label: 'Field 1',
            meaning: 'original meaning'
          }
        ]
      };

      const mockRefinement = {
        success: true,
        refinement: {
          enhancedDescription: 'enhanced'
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRefinement
      });

      const result = await refineContract(originalContract);

      // Structure preserved
      expect(result.subentities?.length).toBe(1);
      expect(result.subentities?.[0]?.subTaskKey).toBe('field1');
      expect(result.subentities?.[0]?.label).toBe('Field 1');
      expect(result.subentities?.[0]?.meaning).toBe('original meaning');
    });
  });

  describe('schema validation', () => {
    it('should handle null values in refinement', async () => {
      const originalContract: SemanticContract = {
        entity: {
          label: 'Test',
          type: 'text',
          description: 'original'
        },
        outputCanonical: { format: 'value' }
      };

      const mockRefinement = {
        success: true,
        refinement: {
          enhancedDescription: null,
          enhancedConstraints: null
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRefinement
      });

      const result = await refineContract(originalContract);

      // Should not crash, should return original
      expect(result.entity.description).toBe('original');
    });

    it('should filter invalid subentities in refinement', async () => {
      const originalContract: SemanticContract = {
        entity: {
          label: 'Test',
          type: 'text',
          description: 'original'
        },
        outputCanonical: { format: 'value' },
        subentities: [
          {
            subTaskKey: 'valid',
            label: 'Valid',
            meaning: 'original'
          }
        ]
      };

      const mockRefinement = {
        success: true,
        refinement: {
          enhancedSubentities: [
            { subTaskKey: 'valid', enhancedMeaning: 'enhanced' },
            { invalid: 'structure' }, // Invalid, should be filtered
            { subTaskKey: 123 } // Invalid type, should be filtered
          ]
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRefinement
      });

      const result = await refineContract(originalContract);

      // Only valid subentity should be enhanced
      expect(result.subentities?.[0]?.meaning).toBe('enhanced');
    });
  });

  describe('additional constraints', () => {
    it('should add additional constraints to entity', async () => {
      const originalContract: SemanticContract = {
        entity: {
          label: 'Age',
          type: 'number',
          description: 'age'
        },
        outputCanonical: { format: 'value' }
      };

      const mockRefinement = {
        success: true,
        refinement: {
          additionalConstraints: [
            {
              field: 'entity',
              type: 'min',
              value: 0,
              description: 'Age must be at least 0'
            },
            {
              field: 'entity',
              type: 'max',
              value: 150,
              description: 'Age must be at most 150'
            }
          ]
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRefinement
      });

      const result = await refineContract(originalContract);

      expect(result.constraints?.min).toBe(0);
      expect(result.constraints?.max).toBe(150);
    });

    it('should add additional constraints to subentities', async () => {
      const originalContract: SemanticContract = {
        entity: {
          label: 'Date',
          type: 'date',
          description: 'date'
        },
        outputCanonical: { format: 'object', keys: ['day'] },
        subentities: [
          {
            subTaskKey: 'day',
            label: 'Day',
            meaning: 'day'
          }
        ]
      };

      const mockRefinement = {
        success: true,
        refinement: {
          additionalConstraints: [
            {
              field: 'day',
              type: 'min',
              value: 1,
              description: 'Day must be at least 1'
            },
            {
              field: 'day',
              type: 'max',
              value: 31,
              description: 'Day must be at most 31'
            }
          ]
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRefinement
      });

      const result = await refineContract(originalContract);

      expect(result.subentities?.[0]?.constraints?.min).toBe(1);
      expect(result.subentities?.[0]?.constraints?.max).toBe(31);
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

      const mockRefinement = {
        success: true,
        refinement: {
          enhancedDescription: 'enhanced'
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRefinement
      });

      const result = await refineContract(legacyContract);

      // Should not crash, should preserve legacy structure
      expect(result.mainGroup).toBeDefined();
      expect(result.subgroups).toBeDefined();
    });
  });
});
