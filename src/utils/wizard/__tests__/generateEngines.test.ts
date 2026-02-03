// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateEngineForNode, buildEngineConfigFromAIResponse } from '../generateEngines';
import { EngineService } from '../../../services/EngineService';
import { buildAIPrompt } from '../../aiPromptTemplates';
import type { TaskTreeNode } from '../../../types/taskTypes';
import type { SemanticContract, EngineConfig, EngineType } from '../../../types/semanticContract';
import type { GenerationProgress } from '../types';

vi.mock('../../../services/EngineService');
vi.mock('../../aiPromptTemplates');

// Mock global fetch
global.fetch = vi.fn();
global.localStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn()
} as any;

describe('buildEngineConfigFromAIResponse', () => {
  describe('regex engine', () => {
    it('should build regex config from AI response', () => {
      const aiResponse = {
        regex: '\\d{2}/\\d{2}/\\d{4}'
      };

      const config = buildEngineConfigFromAIResponse('regex', aiResponse);

      expect(config.regex).toBe('\\d{2}/\\d{2}/\\d{4}');
    });

    it('should handle missing regex in response', () => {
      const aiResponse = {};

      const config = buildEngineConfigFromAIResponse('regex', aiResponse);

      expect(config.regex).toBe('');
    });
  });

  describe('llm engine', () => {
    it('should build LLM config from AI response', () => {
      const aiResponse = {
        extraction_prompt: 'Extract date from text',
        model: 'gpt-4'
      };

      const config = buildEngineConfigFromAIResponse('llm', aiResponse);

      expect(config.llmPrompt).toBe('Extract date from text');
      expect(config.llmModel).toBe('gpt-4');
    });

    it('should handle missing model in response', () => {
      const aiResponse = {
        extraction_prompt: 'Extract date from text'
      };

      const config = buildEngineConfigFromAIResponse('llm', aiResponse);

      expect(config.llmPrompt).toBe('Extract date from text');
      expect(config.llmModel).toBeUndefined();
    });
  });

  describe('rule_based engine', () => {
    it('should build rule-based config from AI response', () => {
      const aiResponse = {
        rules: [
          { condition: 'if contains day', action: 'extract day' }
        ]
      };

      const config = buildEngineConfigFromAIResponse('rule_based', aiResponse);

      expect(config.rules).toHaveLength(1);
      expect(config.rules?.[0].condition).toBe('if contains day');
    });

    it('should handle missing rules in response', () => {
      const aiResponse = {};

      const config = buildEngineConfigFromAIResponse('rule_based', aiResponse);

      expect(config.rules).toEqual([]);
    });
  });

  describe('ner engine', () => {
    it('should build NER config from AI response', () => {
      const aiResponse = {
        entityTypes: { day: 'DATE_COMPONENT' },
        contextPatterns: { day: 'before month' }
      };

      const config = buildEngineConfigFromAIResponse('ner', aiResponse);

      expect(config.nerEntityTypes).toEqual({ day: 'DATE_COMPONENT' });
      expect(config.nerContextPatterns).toEqual({ day: 'before month' });
    });
  });

  describe('embedding engine', () => {
    it('should build embedding config from AI response', () => {
      const aiResponse = {
        examples: {
          positive: ['example1', 'example2'],
          negative: ['bad1', 'bad2']
        },
        thresholds: {
          default: 0.8
        }
      };

      const config = buildEngineConfigFromAIResponse('embedding', aiResponse);

      expect(config.embeddingExamples?.positive).toEqual(['example1', 'example2']);
      expect(config.embeddingExamples?.negative).toEqual(['bad1', 'bad2']);
      expect(config.embeddingThreshold).toBe(0.8);
    });

    it('should use default threshold when missing', () => {
      const aiResponse = {
        examples: {
          positive: [],
          negative: []
        }
      };

      const config = buildEngineConfigFromAIResponse('embedding', aiResponse);

      expect(config.embeddingThreshold).toBe(0.7);
    });
  });
});

describe('generateEngineForNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(global.localStorage.getItem).mockReturnValue(null);
  });

  describe('successful engine generation', () => {
    it('should generate regex engine', async () => {
      const node: TaskTreeNode = {
        id: 'node1',
        label: 'Test Node',
        type: 'date'
      };

      const contract: SemanticContract = {
        entity: {
          label: 'Test Node',
          type: 'date',
          description: 'A date'
        },
        outputCanonical: {
          format: 'value'
        }
      };

      const mockPrompt = 'Generate regex for date';
      const mockResponse = {
        regex: '\\d{2}/\\d{2}/\\d{4}'
      };

      vi.mocked(buildAIPrompt).mockReturnValue(mockPrompt);
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      } as Response);
      vi.mocked(EngineService.save).mockResolvedValue(undefined);

      const result = await generateEngineForNode(node, 'regex', contract);

      expect(result).toBeDefined();
      expect(result?.type).toBe('regex');
      expect(result?.config.regex).toBe('\\d{2}/\\d{2}/\\d{4}');
      expect(result?.generatedBy).toBe('ai');
      expect(EngineService.save).toHaveBeenCalled();
    });

    it('should generate LLM engine', async () => {
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

      const mockResponse = {
        extraction_prompt: 'Extract date',
        model: 'gpt-4'
      };

      vi.mocked(buildAIPrompt).mockReturnValue('Generate LLM prompt');
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      } as Response);
      vi.mocked(EngineService.save).mockResolvedValue(undefined);

      const result = await generateEngineForNode(node, 'llm', contract);

      expect(result?.type).toBe('llm');
      expect(result?.config.llmPrompt).toBe('Extract date');
      expect(result?.config.llmModel).toBe('gpt-4');
    });

    it('should call onProgress callback during generation', async () => {
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

      vi.mocked(buildAIPrompt).mockReturnValue('Generate regex');
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ regex: '\\d+' })
      } as Response);
      vi.mocked(EngineService.save).mockResolvedValue(undefined);

      await generateEngineForNode(node, 'regex', contract, (progress) => {
        progressCalls.push(progress);
      });

      expect(progressCalls.length).toBeGreaterThan(0);
      expect(progressCalls[0].currentAction).toContain('Generating regex engine');
    });
  });

  describe('error handling', () => {
    it('should return null when API call fails', async () => {
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

      vi.mocked(buildAIPrompt).mockReturnValue('Generate regex');
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error'
      } as Response);

      const result = await generateEngineForNode(node, 'regex', contract);

      expect(result).toBeNull();
      expect(EngineService.save).not.toHaveBeenCalled();
    });

    it('should return null when fetch throws error', async () => {
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

      vi.mocked(buildAIPrompt).mockReturnValue('Generate regex');
      vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'));

      const result = await generateEngineForNode(node, 'regex', contract);

      expect(result).toBeNull();
    });
  });

  describe('localStorage integration', () => {
    it('should use provider from localStorage', async () => {
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

      vi.mocked(global.localStorage.getItem).mockImplementation((key: string) => {
        if (key === 'omnia.aiProvider') return 'groq';
        if (key === 'omnia.aiModel') return 'llama-3';
        return null;
      });

      vi.mocked(buildAIPrompt).mockReturnValue('Generate regex');
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ regex: '\\d+' })
      } as Response);
      vi.mocked(EngineService.save).mockResolvedValue(undefined);

      await generateEngineForNode(node, 'regex', contract);

      const fetchCall = vi.mocked(global.fetch).mock.calls[0];
      const body = JSON.parse(fetchCall[1]?.body as string);
      expect(body.provider).toBe('groq');
      expect(body.model).toBe('llama-3');
    });
  });
});
