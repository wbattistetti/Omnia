// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateEnginesForNode } from '../generateEnginesUnified';
import type { SemanticContract, EngineConfig } from '../../../types/semanticContract';
import type { GenerationProgress } from '../types';

// Mock fetch
global.fetch = vi.fn();

describe('generateEnginesForNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockClear();
  });

  describe('successful generation', () => {
    it('should generate all engines for simple contract (value format)', async () => {
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
        engines: {
          regex: {
            regex: '(?P<email>[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})',
            explanation: 'Email regex pattern'
          },
          rule_based: {
            rules: [
              {
                condition: 'if input contains @',
                action: 'extract as email',
                examples: ['user@example.com']
              }
            ]
          },
          ner: {
            nerEntityTypes: {},
            nerContextPatterns: {}
          },
          llm: {
            systemPrompt: 'Extract email from user input',
            userPromptTemplate: 'Extract email from: {input}',
            responseSchema: { type: 'string' }
          },
          embedding: {
            embeddingExamples: {
              positive: ['user@example.com', 'admin@test.org'],
              negative: ['not an email', 'invalid']
            },
            embeddingThreshold: 0.7
          }
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await generateEnginesForNode(contract, 'Email');

      expect(result.contract).toBeDefined();
      expect(result.engines).toBeDefined();
      expect(result.engines.length).toBeGreaterThan(0);

      // Check regex engine
      const regexEngine = result.engines.find(e => e.type === 'regex');
      expect(regexEngine).toBeDefined();
      expect(regexEngine?.config.regex).toContain('@');

      // Check rule_based engine
      const ruleEngine = result.engines.find(e => e.type === 'rule_based');
      expect(ruleEngine).toBeDefined();
      expect(ruleEngine?.config.rules).toHaveLength(1);

      // Check ner engine
      const nerEngine = result.engines.find(e => e.type === 'ner');
      expect(nerEngine).toBeDefined();

      // Check llm engine
      const llmEngine = result.engines.find(e => e.type === 'llm');
      expect(llmEngine).toBeDefined();
      expect(llmEngine?.config.llmPrompt).toContain('{input}');

      // Check embedding engine
      const embeddingEngine = result.engines.find(e => e.type === 'embedding');
      expect(embeddingEngine).toBeDefined();
      expect(embeddingEngine?.config.embeddingExamples?.positive).toHaveLength(2);
    });

    it('should generate all engines for composite contract (object format)', async () => {
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
        engines: {
          regex: {
            regex: '(?P<day>\\d{1,2})[-/](?P<month>\\d{1,2})[-/](?P<year>\\d{4})',
            explanation: 'Date regex with named groups'
          },
          rule_based: {
            rules: [
              {
                condition: 'if input matches date pattern',
                action: 'extract day, month, year',
                examples: ['15/04/2020']
              }
            ]
          },
          ner: {
            nerEntityTypes: {
              day: 'DATE_COMPONENT',
              month: 'DATE_COMPONENT',
              year: 'DATE_COMPONENT'
            },
            nerContextPatterns: {
              day: 'day of month',
              month: 'month of year',
              year: 'year'
            }
          },
          llm: {
            systemPrompt: 'Extract date components from user input',
            userPromptTemplate: 'Extract date from: {input}',
            responseSchema: {
              type: 'object',
              properties: {
                day: { type: 'string' },
                month: { type: 'string' },
                year: { type: 'string' }
              }
            }
          },
          embedding: {
            embeddingExamples: {
              positive: ['15/04/2020', '01-01-2021'],
              negative: ['not a date', 'invalid']
            },
            embeddingThreshold: 0.7
          }
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await generateEnginesForNode(contract, 'Date of Birth');

      expect(result.contract).toBeDefined();
      expect(result.engines).toBeDefined();

      // Check regex engine has named groups
      const regexEngine = result.engines.find(e => e.type === 'regex');
      expect(regexEngine?.config.regex).toContain('?P<day>');
      expect(regexEngine?.config.regex).toContain('?P<month>');
      expect(regexEngine?.config.regex).toContain('?P<year>');

      // Check ner engine has entity types for subentities
      const nerEngine = result.engines.find(e => e.type === 'ner');
      expect(nerEngine?.config.nerEntityTypes?.['day']).toBe('DATE_COMPONENT');
      expect(nerEngine?.config.nerEntityTypes?.['month']).toBe('DATE_COMPONENT');
      expect(nerEngine?.config.nerEntityTypes?.['year']).toBe('DATE_COMPONENT');
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
        engines: {
          regex: { regex: 'test' },
          rule_based: { rules: [] },
          ner: { nerEntityTypes: {}, nerContextPatterns: {} },
          llm: { systemPrompt: 'test', userPromptTemplate: 'test' },
          embedding: { embeddingExamples: { positive: [], negative: [] }, embeddingThreshold: 0.7 }
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const progressCalls: GenerationProgress[] = [];
      await generateEnginesForNode(contract, 'Test', (progress) => {
        progressCalls.push(progress);
      });

      expect(progressCalls.length).toBeGreaterThan(0);
      expect(progressCalls[0].currentAction).toContain('Generating engines');
    });
  });

  describe('fallback behavior', () => {
    it('should return original contract with empty engines if API call fails', async () => {
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

      const result = await generateEnginesForNode(originalContract);

      expect(result.contract).toEqual(originalContract);
      expect(result.engines).toEqual([]);
    });

    it('should return original contract with empty engines if AI returns no engines', async () => {
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

      const result = await generateEnginesForNode(originalContract);

      expect(result.contract).toEqual(originalContract);
      expect(result.engines).toEqual([]);
    });

    it('should return original contract with empty engines if validation fails', async () => {
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
          engines: {} // Invalid: no engines
        })
      });

      const result = await generateEnginesForNode(originalContract);

      expect(result.contract).toEqual(originalContract);
      expect(result.engines).toEqual([]);
    });

    it('should return original contract with empty engines if fetch throws error', async () => {
      const originalContract: SemanticContract = {
        entity: {
          label: 'Test',
          type: 'text',
          description: 'original'
        },
        outputCanonical: { format: 'value' }
      };

      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const result = await generateEnginesForNode(originalContract);

      expect(result.contract).toEqual(originalContract);
      expect(result.engines).toEqual([]);
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
        engines: {
          regex: { regex: 'test' },
          rule_based: { rules: [] },
          ner: { nerEntityTypes: {}, nerContextPatterns: {} },
          llm: { systemPrompt: 'test', userPromptTemplate: 'test' },
          embedding: { embeddingExamples: { positive: [], negative: [] }, embeddingThreshold: 0.7 }
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await generateEnginesForNode(originalContract);

      // All original fields preserved
      expect(result.contract.entity.label).toBe('Date');
      expect(result.contract.entity.type).toBe('date');
      expect(result.contract.constraints?.min).toBe(1);
      expect(result.contract.constraints?.max).toBe(31);
      expect(result.contract.normalization).toBe('original normalization');
      expect(result.contract.redefinitionPolicy).toBe('last_wins');
      expect(result.contract.outputCanonical.format).toBe('object');
      expect(result.contract.outputCanonical.keys).toEqual(['day', 'month']);
      expect(result.contract.version).toBe(2); // Incremented
    });
  });

  describe('schema validation', () => {
    it('should filter invalid engines in response', async () => {
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
        engines: {
          regex: {
            regex: 'valid regex'
          },
          rule_based: {
            rules: [
              { condition: 'valid', action: 'valid' },
              { invalid: 'structure' }, // Invalid, should be filtered
              { condition: 123 } // Invalid type, should be filtered
            ]
          },
          ner: {
            nerEntityTypes: 'invalid', // Invalid type, should be filtered
            nerContextPatterns: {}
          },
          llm: {
            systemPrompt: 'valid',
            userPromptTemplate: 'valid'
          },
          embedding: {
            embeddingExamples: {
              positive: ['valid', 123], // Invalid type, should be filtered
              negative: ['valid']
            },
            embeddingThreshold: 0.7
          }
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await generateEnginesForNode(contract);

      // Regex engine should be present
      const regexEngine = result.engines.find(e => e.type === 'regex');
      expect(regexEngine).toBeDefined();

      // Rule-based engine should have only valid rules
      const ruleEngine = result.engines.find(e => e.type === 'rule_based');
      expect(ruleEngine?.config.rules).toHaveLength(1);

      // NER engine should have empty entity types if invalid
      const nerEngine = result.engines.find(e => e.type === 'ner');
      expect(nerEngine?.config.nerEntityTypes).toEqual({});

      // Embedding engine should have only valid examples
      const embeddingEngine = result.engines.find(e => e.type === 'embedding');
      expect(embeddingEngine?.config.embeddingExamples?.positive).toHaveLength(1);
    });
  });

  describe('snapshot test', () => {
    it('should produce stable engines for email node', async () => {
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
        engines: {
          regex: {
            regex: '(?P<email>[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})',
            explanation: 'Email regex pattern'
          },
          rule_based: {
            rules: [
              {
                condition: 'if input contains @',
                action: 'extract as email',
                examples: ['user@example.com']
              }
            ]
          },
          ner: {
            nerEntityTypes: {},
            nerContextPatterns: {}
          },
          llm: {
            systemPrompt: 'Extract email from user input',
            userPromptTemplate: 'Extract email from: {input}',
            responseSchema: { type: 'string' }
          },
          embedding: {
            embeddingExamples: {
              positive: ['user@example.com', 'admin@test.org'],
              negative: ['not an email', 'invalid']
            },
            embeddingThreshold: 0.7
          }
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await generateEnginesForNode(contract, 'Email');

      // Snapshot: verify structure is stable
      const snapshot = {
        enginesCount: result.engines.length,
        engineTypes: result.engines.map(e => e.type).sort(),
        hasRegex: result.engines.some(e => e.type === 'regex'),
        hasRuleBased: result.engines.some(e => e.type === 'rule_based'),
        hasNer: result.engines.some(e => e.type === 'ner'),
        hasLlm: result.engines.some(e => e.type === 'llm'),
        hasEmbedding: result.engines.some(e => e.type === 'embedding'),
        contractVersion: result.contract.version
      };

      expect(snapshot).toMatchInlineSnapshot(`
        {
          "contractVersion": 2,
          "engineTypes": [
            "embedding",
            "llm",
            "ner",
            "regex",
            "rule_based",
          ],
          "enginesCount": 5,
          "hasEmbedding": true,
          "hasLlm": true,
          "hasNer": true,
          "hasRegex": true,
          "hasRuleBased": true,
        }
      `);
    });

    it('should produce stable engines for date node', async () => {
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
        engines: {
          regex: {
            regex: '(?P<day>\\d{1,2})[-/](?P<month>\\d{1,2})[-/](?P<year>\\d{4})',
            explanation: 'Date regex with named groups'
          },
          rule_based: {
            rules: [
              {
                condition: 'if input matches date pattern',
                action: 'extract day, month, year',
                examples: ['15/04/2020']
              }
            ]
          },
          ner: {
            nerEntityTypes: {
              day: 'DATE_COMPONENT',
              month: 'DATE_COMPONENT',
              year: 'DATE_COMPONENT'
            },
            nerContextPatterns: {
              day: 'day of month',
              month: 'month of year',
              year: 'year'
            }
          },
          llm: {
            systemPrompt: 'Extract date components from user input',
            userPromptTemplate: 'Extract date from: {input}',
            responseSchema: {
              type: 'object',
              properties: {
                day: { type: 'string' },
                month: { type: 'string' },
                year: { type: 'string' }
              }
            }
          },
          embedding: {
            embeddingExamples: {
              positive: ['15/04/2020', '01-01-2021'],
              negative: ['not a date', 'invalid']
            },
            embeddingThreshold: 0.7
          }
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await generateEnginesForNode(contract, 'Date of Birth');

      // Snapshot: verify structure is stable
      const snapshot = {
        enginesCount: result.engines.length,
        engineTypes: result.engines.map(e => e.type).sort(),
        regexHasNamedGroups: result.engines.find(e => e.type === 'regex')?.config.regex?.includes('?P<day>') || false,
        nerEntityTypesCount: Object.keys(result.engines.find(e => e.type === 'ner')?.config.nerEntityTypes || {}).length,
        contractVersion: result.contract.version
      };

      expect(snapshot).toMatchInlineSnapshot(`
        {
          "contractVersion": 2,
          "engineTypes": [
            "embedding",
            "llm",
            "ner",
            "regex",
            "rule_based",
          ],
          "enginesCount": 5,
          "nerEntityTypesCount": 3,
          "regexHasNamedGroups": true,
        }
      `);
    });
  });
});
