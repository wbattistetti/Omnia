// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateEscalationForNode } from '../generateEscalation';
import type { SemanticContract, EngineConfig, EngineEscalation } from '../../../types/semanticContract';
import type { GenerationProgress } from '../types';

// Mock fetch
global.fetch = vi.fn();

describe('generateEscalationForNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockClear();
  });

  describe('successful generation', () => {
    it('should generate escalation for simple contract with multiple engines', async () => {
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

      const engines: EngineConfig[] = [
        {
          type: 'regex',
          config: { regex: 'test' },
          version: 1,
          generatedAt: new Date(),
          generatedBy: 'ai'
        },
        {
          type: 'rule_based',
          config: { rules: [] },
          version: 1,
          generatedAt: new Date(),
          generatedBy: 'ai'
        },
        {
          type: 'llm',
          config: { llmPrompt: 'test' },
          version: 1,
          generatedAt: new Date(),
          generatedBy: 'ai'
        }
      ];

      const mockResponse = {
        success: true,
        escalation: {
          engines: [
            { type: 'regex', priority: 1, enabled: true },
            { type: 'rule_based', priority: 2, enabled: true },
            { type: 'llm', priority: 3, enabled: false }
          ],
          defaultEngine: 'regex',
          explanation: 'Regex first for speed, rule_based as fallback'
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await generateEscalationForNode(contract, engines, 'node-1', 'Email');

      expect(result).toBeDefined();
      expect(result?.nodeId).toBe('node-1');
      expect(result?.engines).toHaveLength(3);
      expect(result?.engines[0].type).toBe('regex');
      expect(result?.engines[0].priority).toBe(1);
      expect(result?.engines[0].enabled).toBe(true);
      expect(result?.defaultEngine).toBe('regex');
    });

    it('should generate escalation for composite contract', async () => {
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
          }
        ]
      };

      const engines: EngineConfig[] = [
        {
          type: 'regex',
          config: { regex: 'test' },
          version: 1,
          generatedAt: new Date(),
          generatedBy: 'ai'
        },
        {
          type: 'ner',
          config: { nerEntityTypes: {}, nerContextPatterns: {} },
          version: 1,
          generatedAt: new Date(),
          generatedBy: 'ai'
        }
      ];

      const mockResponse = {
        success: true,
        escalation: {
          engines: [
            { type: 'regex', priority: 1, enabled: true },
            { type: 'ner', priority: 2, enabled: true }
          ],
          defaultEngine: 'regex',
          explanation: 'Regex for pattern matching, NER as fallback'
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await generateEscalationForNode(contract, engines, 'node-2', 'Date of Birth');

      expect(result).toBeDefined();
      expect(result?.engines).toHaveLength(2);
      expect(result?.engines[0].type).toBe('regex');
      expect(result?.engines[1].type).toBe('ner');
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

      const engines: EngineConfig[] = [
        {
          type: 'regex',
          config: { regex: 'test' },
          version: 1,
          generatedAt: new Date(),
          generatedBy: 'ai'
        }
      ];

      const mockResponse = {
        success: true,
        escalation: {
          engines: [{ type: 'regex', priority: 1, enabled: true }],
          defaultEngine: 'regex'
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const progressCalls: GenerationProgress[] = [];
      await generateEscalationForNode(contract, engines, 'node-3', 'Test', null, (progress) => {
        progressCalls.push(progress);
      });

      expect(progressCalls.length).toBeGreaterThan(0);
      expect(progressCalls[0].currentAction).toContain('Generating escalation');
    });
  });

  describe('fallback behavior', () => {
    it('should return null if API call fails and no existing escalation', async () => {
      const contract: SemanticContract = {
        entity: {
          label: 'Test',
          type: 'text',
          description: 'test'
        },
        outputCanonical: { format: 'value' }
      };

      const engines: EngineConfig[] = [
        {
          type: 'regex',
          config: { regex: 'test' },
          version: 1,
          generatedAt: new Date(),
          generatedBy: 'ai'
        }
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error'
      });

      const result = await generateEscalationForNode(contract, engines, 'node-4');

      expect(result).toBeNull();
    });

    it('should return existing escalation if API call fails', async () => {
      const contract: SemanticContract = {
        entity: {
          label: 'Test',
          type: 'text',
          description: 'test'
        },
        outputCanonical: { format: 'value' }
      };

      const engines: EngineConfig[] = [
        {
          type: 'regex',
          config: { regex: 'test' },
          version: 1,
          generatedAt: new Date(),
          generatedBy: 'ai'
        }
      ];

      const existingEscalation: EngineEscalation = {
        nodeId: 'node-5',
        engines: [
          { type: 'regex', priority: 1, enabled: true }
        ],
        defaultEngine: 'regex'
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error'
      });

      const result = await generateEscalationForNode(
        contract,
        engines,
        'node-5',
        undefined,
        existingEscalation
      );

      expect(result).toEqual(existingEscalation);
    });

    it('should return null if no engines available', async () => {
      const contract: SemanticContract = {
        entity: {
          label: 'Test',
          type: 'text',
          description: 'test'
        },
        outputCanonical: { format: 'value' }
      };

      const engines: EngineConfig[] = [];

      const result = await generateEscalationForNode(contract, engines, 'node-6');

      expect(result).toBeNull();
    });

    it('should return existing escalation if AI returns no escalation', async () => {
      const contract: SemanticContract = {
        entity: {
          label: 'Test',
          type: 'text',
          description: 'test'
        },
        outputCanonical: { format: 'value' }
      };

      const engines: EngineConfig[] = [
        {
          type: 'regex',
          config: { regex: 'test' },
          version: 1,
          generatedAt: new Date(),
          generatedBy: 'ai'
        }
      ];

      const existingEscalation: EngineEscalation = {
        nodeId: 'node-7',
        engines: [
          { type: 'regex', priority: 1, enabled: true }
        ],
        defaultEngine: 'regex'
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: false })
      });

      const result = await generateEscalationForNode(
        contract,
        engines,
        'node-7',
        undefined,
        existingEscalation
      );

      expect(result).toEqual(existingEscalation);
    });

    it('should return existing escalation if validation fails', async () => {
      const contract: SemanticContract = {
        entity: {
          label: 'Test',
          type: 'text',
          description: 'test'
        },
        outputCanonical: { format: 'value' }
      };

      const engines: EngineConfig[] = [
        {
          type: 'regex',
          config: { regex: 'test' },
          version: 1,
          generatedAt: new Date(),
          generatedBy: 'ai'
        }
      ];

      const existingEscalation: EngineEscalation = {
        nodeId: 'node-8',
        engines: [
          { type: 'regex', priority: 1, enabled: true }
        ],
        defaultEngine: 'regex'
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          escalation: {
            engines: [] // Invalid: must have at least one engine
          }
        })
      });

      const result = await generateEscalationForNode(
        contract,
        engines,
        'node-8',
        undefined,
        existingEscalation
      );

      expect(result).toEqual(existingEscalation);
    });
  });

  describe('merge non-destructive', () => {
    it('should merge with existing escalation (additive)', async () => {
      const contract: SemanticContract = {
        entity: {
          label: 'Test',
          type: 'text',
          description: 'test'
        },
        outputCanonical: { format: 'value' }
      };

      const engines: EngineConfig[] = [
        {
          type: 'regex',
          config: { regex: 'test' },
          version: 1,
          generatedAt: new Date(),
          generatedBy: 'ai'
        },
        {
          type: 'llm',
          config: { llmPrompt: 'test' },
          version: 1,
          generatedAt: new Date(),
          generatedBy: 'ai'
        }
      ];

      const existingEscalation: EngineEscalation = {
        nodeId: 'node-9',
        engines: [
          { type: 'regex', priority: 1, enabled: true }
        ],
        defaultEngine: 'regex'
      };

      const mockResponse = {
        success: true,
        escalation: {
          engines: [
            { type: 'regex', priority: 1, enabled: true },
            { type: 'llm', priority: 2, enabled: false }
          ],
          defaultEngine: 'regex'
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await generateEscalationForNode(
        contract,
        engines,
        'node-9',
        undefined,
        existingEscalation
      );

      expect(result).toBeDefined();
      expect(result?.engines).toHaveLength(2);
      expect(result?.engines[0].type).toBe('regex');
      expect(result?.engines[1].type).toBe('llm');
      // Existing engine preserved, new engine added
    });

    it('should update priorities when merging', async () => {
      const contract: SemanticContract = {
        entity: {
          label: 'Test',
          type: 'text',
          description: 'test'
        },
        outputCanonical: { format: 'value' }
      };

      const engines: EngineConfig[] = [
        {
          type: 'regex',
          config: { regex: 'test' },
          version: 1,
          generatedAt: new Date(),
          generatedBy: 'ai'
        },
        {
          type: 'llm',
          config: { llmPrompt: 'test' },
          version: 1,
          generatedAt: new Date(),
          generatedBy: 'ai'
        }
      ];

      const existingEscalation: EngineEscalation = {
        nodeId: 'node-10',
        engines: [
          { type: 'regex', priority: 2, enabled: true },
          { type: 'llm', priority: 1, enabled: true }
        ],
        defaultEngine: 'llm'
      };

      const mockResponse = {
        success: true,
        escalation: {
          engines: [
            { type: 'regex', priority: 1, enabled: true },
            { type: 'llm', priority: 2, enabled: true }
          ],
          defaultEngine: 'regex'
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await generateEscalationForNode(
        contract,
        engines,
        'node-10',
        undefined,
        existingEscalation
      );

      expect(result).toBeDefined();
      // Priorities should be updated
      expect(result?.engines[0].priority).toBe(1);
      expect(result?.engines[1].priority).toBe(2);
      expect(result?.defaultEngine).toBe('regex');
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

      const engines: EngineConfig[] = [
        {
          type: 'regex',
          config: { regex: 'test' },
          version: 1,
          generatedAt: new Date(),
          generatedBy: 'ai'
        }
      ];

      const mockResponse = {
        success: true,
        escalation: {
          engines: [
            { type: 'regex', priority: 1, enabled: true }, // Valid
            { type: 'invalid', priority: 2, enabled: true }, // Invalid: not in available engines
            { type: 'regex', priority: 'invalid', enabled: true }, // Invalid: priority not number
            { type: 'regex', priority: 3, enabled: 'invalid' } // Invalid: enabled not boolean
          ],
          defaultEngine: 'regex'
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await generateEscalationForNode(contract, engines, 'node-11');

      expect(result).toBeDefined();
      // Only valid engines should be included
      expect(result?.engines).toHaveLength(1);
      expect(result?.engines[0].type).toBe('regex');
    });

    it('should ensure at least one engine is enabled', async () => {
      const contract: SemanticContract = {
        entity: {
          label: 'Test',
          type: 'text',
          description: 'test'
        },
        outputCanonical: { format: 'value' }
      };

      const engines: EngineConfig[] = [
        {
          type: 'regex',
          config: { regex: 'test' },
          version: 1,
          generatedAt: new Date(),
          generatedBy: 'ai'
        }
      ];

      const mockResponse = {
        success: true,
        escalation: {
          engines: [
            { type: 'regex', priority: 1, enabled: false } // All disabled
          ],
          defaultEngine: 'regex'
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await generateEscalationForNode(contract, engines, 'node-12');

      expect(result).toBeDefined();
      // At least one engine should be enabled
      expect(result?.engines.some(e => e.enabled)).toBe(true);
    });
  });

  describe('snapshot test', () => {
    it('should produce stable escalation for email node', async () => {
      const contract: SemanticContract = {
        entity: {
          label: 'Email',
          type: 'email',
          description: 'an email address'
        },
        outputCanonical: { format: 'value' }
      };

      const engines: EngineConfig[] = [
        {
          type: 'regex',
          config: { regex: 'test' },
          version: 1,
          generatedAt: new Date(),
          generatedBy: 'ai'
        },
        {
          type: 'rule_based',
          config: { rules: [] },
          version: 1,
          generatedAt: new Date(),
          generatedBy: 'ai'
        },
        {
          type: 'llm',
          config: { llmPrompt: 'test' },
          version: 1,
          generatedAt: new Date(),
          generatedBy: 'ai'
        }
      ];

      const mockResponse = {
        success: true,
        escalation: {
          engines: [
            { type: 'regex', priority: 1, enabled: true },
            { type: 'rule_based', priority: 2, enabled: true },
            { type: 'llm', priority: 3, enabled: false }
          ],
          defaultEngine: 'regex',
          explanation: 'Regex first for speed, rule_based as fallback'
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await generateEscalationForNode(contract, engines, 'email-node', 'Email');

      // Snapshot: verify structure is stable
      const snapshot = {
        nodeId: result?.nodeId,
        enginesCount: result?.engines.length,
        engineTypes: result?.engines.map(e => e.type).sort(),
        priorities: result?.engines.map(e => e.priority).sort(),
        enabledCount: result?.engines.filter(e => e.enabled).length,
        defaultEngine: result?.defaultEngine
      };

      expect(snapshot).toMatchInlineSnapshot(`
        {
          "defaultEngine": "regex",
          "enabledCount": 2,
          "engineTypes": [
            "llm",
            "regex",
            "rule_based",
          ],
          "enginesCount": 3,
          "nodeId": "email-node",
          "priorities": [
            1,
            2,
            3,
          ],
        }
      `);
    });
  });
});
