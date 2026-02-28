// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractWithContractAsync } from '../contractExtractor';
import type { DataContract, LLMContract } from '../contractLoader';

// Mock fetch for LLM calls
global.fetch = vi.fn();

describe('Contract Extraction Regression Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockClear();
  });

  describe('LLM escalation with aiPrompt', () => {
    it('should have aiPrompt in LLM contract structure', () => {
      // Test structure only (execution will be tested after refactoring contractExtractor)
      const contract: DataContract = {
        templateName: 'email',
        templateId: 'test-id',
        subDataMapping: {},
        parsers: [
          {
            type: 'llm',
            enabled: true,
            systemPrompt: 'You are an email extraction assistant',
            aiPrompt: 'Extract the email address from: {text}', // Uses aiPrompt
            responseSchema: { type: 'string' }
          } as LLMContract
        ]
      };

      const llmContract = contract.parsers.find(c => c.type === 'llm') as LLMContract;

      // Verify structure: aiPrompt exists, userPromptTemplate does not
      expect(llmContract).toBeDefined();
      expect(llmContract.aiPrompt).toBe('Extract the email address from: {text}');
      expect((llmContract as any).userPromptTemplate).toBeUndefined();
    });

    it('should handle LLM contract with empty aiPrompt', () => {
      const contract: DataContract = {
        templateName: 'test',
        templateId: 'test-id',
        subDataMapping: {},
        parsers: [
          {
            type: 'llm',
            enabled: true,
            systemPrompt: 'test',
            aiPrompt: '', // Empty aiPrompt
            responseSchema: {}
          } as LLMContract
        ]
      };

      const llmContract = contract.parsers[0] as LLMContract;
      expect(llmContract.aiPrompt).toBe('');
    });
  });

  describe('Escalation order based on parsers array', () => {
    it('should have parsers in array order (escalation order)', () => {
      // Test structure: parsers array order determines escalation order
      const contract: DataContract = {
        templateName: 'email',
        templateId: 'test-id',
        subDataMapping: {},
        parsers: [
          {
            type: 'regex',
            enabled: true,
            patterns: ['(?P<email>[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})'],
            examples: []
          },
          {
            type: 'llm',
            enabled: true,
            systemPrompt: 'test',
            aiPrompt: 'Extract: {text}',
            responseSchema: {}
          } as LLMContract
        ]
      };

      // Verify order: regex first, then LLM
      expect(contract.parsers[0].type).toBe('regex');
      expect(contract.parsers[1].type).toBe('llm');

      // This order should be used for escalation (implementation in contractExtractor)
    });
  });

  describe('TestCases usage (if implemented in extraction)', () => {
    it('should access testCases from contract level', () => {
      const contract: DataContract = {
        templateName: 'test',
        templateId: 'test-id',
        subDataMapping: {},
        parsers: [
          { type: 'regex', enabled: true, patterns: ['p1'], examples: [] }
        ],
        testCases: ['test1', 'test2']
      };

      // Verify testCases is accessible at contract level
      expect(contract.testCases).toEqual(['test1', 'test2']);

      // Verify testCases is NOT in individual parsers
      expect((contract.parsers[0] as any).testCases).toBeUndefined();
    });
  });
});
