// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect } from 'vitest';
import type { DataContract, RegexContract, LLMContract, RulesContract } from '../contractLoader';

describe('DataContract Structure - Refactoring Tests', () => {
  describe('testCases location', () => {
    it('should have testCases at contract level, not in individual engines', () => {
      const contract: DataContract = {
        templateName: 'email',
        templateId: 'test-id',
        subDataMapping: {},
        parsers: [
          {
            type: 'regex',
            enabled: true,
            patterns: ['pattern1'],
            examples: []
            // testCases should NOT be here
          } as RegexContract
        ],
        // testCases should be HERE at contract level
        testCases: ['test1', 'test2']
      };

      expect(contract.testCases).toBeDefined();
      expect(contract.testCases).toEqual(['test1', 'test2']);

      // Verify testCases is NOT in individual engines
      const regexContract = contract.parsers[0] as RegexContract;
      expect(regexContract.testCases).toBeUndefined();
    });

    it('should allow empty testCases array at contract level', () => {
      const contract: DataContract = {
        templateName: 'test',
        templateId: 'test-id',
        subDataMapping: {},
        parsers: [
          { type: 'regex', enabled: true, patterns: [], examples: [] }
        ],
        testCases: []
      };

      expect(contract.testCases).toEqual([]);
    });

    it('should allow testCases to be optional (undefined)', () => {
      const contract: DataContract = {
        templateName: 'test',
        templateId: 'test-id',
        subDataMapping: {},
        parsers: [
          { type: 'regex', enabled: true, patterns: [], examples: [] }
        ]
        // testCases can be omitted
      };

      expect(contract.testCases).toBeUndefined();
    });
  });

  describe('LLM contract - aiPrompt naming', () => {
    it('should use aiPrompt instead of userPromptTemplate', () => {
      const llmContract: LLMContract = {
        type: 'llm',
        enabled: true,
        systemPrompt: 'You are a data extraction assistant',
        aiPrompt: 'Extract email from: {input}', // New name
        responseSchema: { type: 'string' }
      };

      expect(llmContract.aiPrompt).toBe('Extract email from: {input}');

      // Verify old name does not exist
      expect((llmContract as any).userPromptTemplate).toBeUndefined();
    });

    it('should allow empty aiPrompt', () => {
      const llmContract: LLMContract = {
        type: 'llm',
        enabled: true,
        systemPrompt: 'test',
        aiPrompt: '',
        responseSchema: {}
      };

      expect(llmContract.aiPrompt).toBe('');
    });
  });

  describe('Type-specific properties', () => {
    it('should have only regex properties in RegexContract', () => {
      const regexContract: RegexContract = {
        type: 'regex',
        enabled: true,
        patterns: ['pattern1', 'pattern2'],
        examples: ['example1']
        // Should NOT have: entityTypes, extractorCode, systemPrompt, etc.
      };

      expect(regexContract.patterns).toEqual(['pattern1', 'pattern2']);
      expect((regexContract as any).entityTypes).toBeUndefined();
      expect((regexContract as any).extractorCode).toBeUndefined();
      expect((regexContract as any).systemPrompt).toBeUndefined();
    });

    it('should have only rules properties in RulesContract', () => {
      const rulesContract: RulesContract = {
        type: 'rules',
        enabled: true,
        extractorCode: 'function extract() { return value; }',
        validators: []
        // Should NOT have: patterns, entityTypes, systemPrompt, etc.
      };

      expect(rulesContract.extractorCode).toBeDefined();
      expect((rulesContract as any).patterns).toBeUndefined();
      expect((rulesContract as any).entityTypes).toBeUndefined();
      expect((rulesContract as any).systemPrompt).toBeUndefined();
    });

    it('should have only LLM properties in LLMContract', () => {
      const llmContract: LLMContract = {
        type: 'llm',
        enabled: true,
        systemPrompt: 'system',
        aiPrompt: 'user',
        responseSchema: {}
        // Should NOT have: patterns, extractorCode, entityTypes, etc.
      };

      expect(llmContract.systemPrompt).toBeDefined();
      expect(llmContract.aiPrompt).toBeDefined();
      expect((llmContract as any).patterns).toBeUndefined();
      expect((llmContract as any).extractorCode).toBeUndefined();
      expect((llmContract as any).entityTypes).toBeUndefined();
    });
  });

  describe('Contract serialization', () => {
    it('should serialize testCases at contract level in JSON', () => {
      const contract: DataContract = {
        templateName: 'email',
        templateId: 'test-id',
        subDataMapping: {},
        parsers: [
          { type: 'regex', enabled: true, patterns: ['p1'], examples: [] }
        ],
        testCases: ['t1', 't2']
      };

      const json = JSON.stringify(contract);
      const parsed = JSON.parse(json) as DataContract;

      expect(parsed.testCases).toEqual(['t1', 't2']);
      expect(parsed.parsers[0].testCases).toBeUndefined();
    });

    it('should serialize aiPrompt in LLM parsers', () => {
      const contract: DataContract = {
        templateName: 'test',
        templateId: 'test-id',
        subDataMapping: {},
        parsers: [
          {
            type: 'llm',
            enabled: true,
            systemPrompt: 'system',
            aiPrompt: 'Extract: {input}',
            responseSchema: {}
          }
        ]
      };

      const json = JSON.stringify(contract);
      const parsed = JSON.parse(json) as DataContract;

      const llmContract = parsed.parsers[0] as LLMContract;
      expect(llmContract.aiPrompt).toBe('Extract: {input}');
      expect((llmContract as any).userPromptTemplate).toBeUndefined();
    });
  });

  describe('Backward compatibility (during migration)', () => {
    it('should handle old format with testCases in engines gracefully', () => {
      // Old format (during migration period)
      const oldFormat = {
        templateName: 'test',
        templateId: 'test-id',
        subDataMapping: {},
        parsers: [
          {
            type: 'regex',
            enabled: true,
            patterns: ['p1'],
            examples: [],
            testCases: ['old1', 'old2'] // Old location
          }
        ]
      };

      // Migration helper (to be implemented)
      const migrated: DataContract = {
        ...oldFormat,
        testCases: (oldFormat.parsers[0] as any).testCases, // Migrate to contract level
        parsers: oldFormat.parsers.map(c => {
          const { testCases, ...rest } = c as any;
          return rest; // Remove from engine
        })
      };

      expect(migrated.testCases).toEqual(['old1', 'old2']);
      expect((migrated.parsers[0] as any).testCases).toBeUndefined();
    });

    it('should prefer contract-level testCases over engine-level', () => {
      const mixedFormat = {
        templateName: 'test',
        templateId: 'test-id',
        subDataMapping: {},
        testCases: ['new'], // New location
        parsers: [
          {
            type: 'regex',
            enabled: true,
            patterns: ['p1'],
            examples: [],
            testCases: ['old'] // Old location (should be ignored)
          }
        ]
      };

      const migrated: DataContract = {
        ...mixedFormat,
        testCases: mixedFormat.testCases, // Prefer new location
        parsers: mixedFormat.parsers.map(c => {
          const { testCases, ...rest } = c as any;
          return rest;
        })
      };

      expect(migrated.testCases).toEqual(['new']); // New format takes precedence
    });
  });
});
