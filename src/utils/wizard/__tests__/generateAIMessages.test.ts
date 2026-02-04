// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateAIMessagesForNode, AIMessages } from '../generateAIMessages';
import type { SemanticContract } from '../../../types/semanticContract';
import type { GenerationProgress } from '../types';

// Mock fetch
global.fetch = vi.fn();

describe('generateAIMessagesForNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockClear();
  });

  describe('successful generation', () => {
    it('should generate AI messages for simple contract (value format)', async () => {
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
        messages: {
          start: ['What\'s your email address?'],
          noInput: [
            'Could you share your email address?',
            'Please provide your email address.',
            'I need your email address.'
          ],
          noMatch: [
            'I didn\'t catch that. Email address?',
            'Sorry, could you repeat your email?',
            'I didn\'t understand. Email address?'
          ],
          confirmation: [
            'Is this correct: {{ \'{{input}}\' }}?',
            'Confirm: {{ \'{{input}}\' }}?'
          ],
          success: ['Thanks, got it.']
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await generateAIMessagesForNode(contract, 'Email');

      expect(result).toBeDefined();
      expect(result?.start).toHaveLength(1);
      expect(result?.start[0]).toContain('email');
      expect(result?.noInput).toHaveLength(3);
      expect(result?.noMatch).toHaveLength(3);
      expect(result?.confirmation).toHaveLength(2);
      expect(result?.success).toHaveLength(1);
    });

    it('should generate AI messages for composite contract (object format)', async () => {
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
        messages: {
          start: ['What\'s your date of birth (DD/MM/YYYY)?'],
          noInput: [
            'Could you share your date of birth?',
            'Please provide your date of birth.',
            'I need your date of birth.'
          ],
          noMatch: [
            'I didn\'t catch that. Date of birth (DD/MM/YYYY)?',
            'Sorry, could you repeat your date of birth?',
            'I didn\'t understand. Date of birth?'
          ],
          confirmation: [
            'Is this correct: {{ \'{{input}}\' }}?'
          ],
          success: ['Thanks, got it.']
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await generateAIMessagesForNode(contract, 'Date of Birth');

      expect(result).toBeDefined();
      expect(result?.start[0]).toContain('date of birth');
      expect(result?.start[0]).toContain('DD/MM/YYYY');
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
        messages: {
          start: ['Test message'],
          noInput: ['Test noInput'],
          noMatch: ['Test noMatch'],
          confirmation: ['Test confirmation'],
          success: ['Test success']
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const progressCalls: GenerationProgress[] = [];
      await generateAIMessagesForNode(contract, 'Test', null, (progress) => {
        progressCalls.push(progress);
      });

      expect(progressCalls.length).toBeGreaterThan(0);
      expect(progressCalls[0].currentAction).toContain('Generating AI messages');
    });
  });

  describe('fallback behavior', () => {
    it('should return null if API call fails and no existing messages', async () => {
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

      const result = await generateAIMessagesForNode(contract);

      expect(result).toBeNull();
    });

    it('should return existing messages if API call fails', async () => {
      const contract: SemanticContract = {
        entity: {
          label: 'Test',
          type: 'text',
          description: 'test'
        },
        outputCanonical: { format: 'value' }
      };

      const existingMessages: AIMessages = {
        start: ['Existing start message'],
        noInput: ['Existing noInput'],
        noMatch: ['Existing noMatch'],
        confirmation: ['Existing confirmation'],
        success: ['Existing success']
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error'
      });

      const result = await generateAIMessagesForNode(contract, undefined, existingMessages);

      expect(result).toEqual(existingMessages);
    });

    it('should return existing messages if AI returns no messages', async () => {
      const contract: SemanticContract = {
        entity: {
          label: 'Test',
          type: 'text',
          description: 'test'
        },
        outputCanonical: { format: 'value' }
      };

      const existingMessages: AIMessages = {
        start: ['Existing start'],
        noInput: [],
        noMatch: [],
        confirmation: [],
        success: []
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: false })
      });

      const result = await generateAIMessagesForNode(contract, undefined, existingMessages);

      expect(result).toEqual(existingMessages);
    });

    it('should return existing messages if validation fails', async () => {
      const contract: SemanticContract = {
        entity: {
          label: 'Test',
          type: 'text',
          description: 'test'
        },
        outputCanonical: { format: 'value' }
      };

      const existingMessages: AIMessages = {
        start: ['Existing start'],
        noInput: [],
        noMatch: [],
        confirmation: [],
        success: []
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          messages: {
            start: [] // Invalid: must have at least one start message
          }
        })
      });

      const result = await generateAIMessagesForNode(contract, undefined, existingMessages);

      expect(result).toEqual(existingMessages);
    });
  });

  describe('merge non-destructive', () => {
    it('should merge with existing messages (additive, no duplicates)', async () => {
      const contract: SemanticContract = {
        entity: {
          label: 'Test',
          type: 'text',
          description: 'test'
        },
        outputCanonical: { format: 'value' }
      };

      const existingMessages: AIMessages = {
        start: ['Existing start message'],
        noInput: ['Existing noInput 1'],
        noMatch: ['Existing noMatch 1'],
        confirmation: ['Existing confirmation'],
        success: ['Existing success']
      };

      const mockResponse = {
        success: true,
        messages: {
          start: ['New start message', 'Existing start message'], // Duplicate should be filtered
          noInput: ['New noInput 1', 'New noInput 2'],
          noMatch: ['New noMatch 1'],
          confirmation: ['New confirmation'],
          success: ['New success']
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await generateAIMessagesForNode(contract, undefined, existingMessages);

      expect(result).toBeDefined();
      // Should have existing + new (no duplicates)
      expect(result?.start).toHaveLength(2); // 1 existing + 1 new (1 duplicate filtered)
      expect(result?.start).toContain('Existing start message');
      expect(result?.start).toContain('New start message');
      expect(result?.noInput).toHaveLength(3); // 1 existing + 2 new
      expect(result?.noMatch).toHaveLength(2); // 1 existing + 1 new
    });
  });

  describe('schema validation', () => {
    it('should filter invalid messages in response', async () => {
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
        messages: {
          start: [
            'Valid start message',
            123, // Invalid: not a string
            '', // Invalid: empty string
            'Another valid'
          ],
          noInput: [],
          noMatch: [],
          confirmation: [],
          success: []
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await generateAIMessagesForNode(contract);

      // Only valid strings should be included
      expect(result?.start).toHaveLength(2);
      expect(result?.start).toContain('Valid start message');
      expect(result?.start).toContain('Another valid');
    });

    it('should handle single string values (convert to array)', async () => {
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
        messages: {
          start: 'Single start message', // Single string instead of array
          noInput: ['noInput message'],
          noMatch: ['noMatch message'],
          confirmation: ['confirmation message'],
          success: ['success message']
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await generateAIMessagesForNode(contract);

      // Single string should be converted to array
      expect(result?.start).toHaveLength(1);
      expect(result?.start[0]).toBe('Single start message');
    });
  });

  describe('snapshot test', () => {
    it('should produce stable AI messages for email node', async () => {
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
        messages: {
          start: ['What\'s your email address?'],
          noInput: [
            'Could you share your email address?',
            'Please provide your email address.',
            'I need your email address.'
          ],
          noMatch: [
            'I didn\'t catch that. Email address?',
            'Sorry, could you repeat your email?',
            'I didn\'t understand. Email address?'
          ],
          confirmation: [
            'Is this correct: {{ \'{{input}}\' }}?',
            'Confirm: {{ \'{{input}}\' }}?'
          ],
          success: ['Thanks, got it.']
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await generateAIMessagesForNode(contract, 'Email');

      // Snapshot: verify structure is stable
      const snapshot = {
        hasStart: result?.start.length > 0,
        startCount: result?.start.length || 0,
        noInputCount: result?.noInput.length || 0,
        noMatchCount: result?.noMatch.length || 0,
        confirmationCount: result?.confirmation.length || 0,
        successCount: result?.success.length || 0,
        startEndsWithQuestion: result?.start[0]?.endsWith('?') || false,
        confirmationHasPlaceholder: result?.confirmation.some(m => m.includes('{{input}}')) || false
      };

      expect(snapshot).toMatchInlineSnapshot(`
        {
          "confirmationCount": 2,
          "confirmationHasPlaceholder": true,
          "hasStart": true,
          "noInputCount": 3,
          "noMatchCount": 3,
          "startCount": 1,
          "startEndsWithQuestion": true,
          "successCount": 1,
        }
      `);
    });
  });
});
