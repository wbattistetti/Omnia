// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { ExtractionResult } from '../types/semanticContract';

/**
 * Service for testing extraction via backend
 * Frontend sends test phrase, backend executes full runtime (engine + contract)
 */
export class TestExtractionService {
  /**
   * Test extraction for a given task and text
   * Backend executes full runtime and returns canonical output
   */
  static async testExtraction(
    taskId: string,
    text: string
  ): Promise<ExtractionResult> {
    try {
      const response = await fetch(`/api/task/${taskId}/test-extraction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(error.detail || `HTTP ${response.status}`);
      }

      const result = await response.json();

      return {
        values: result.values || {},
        hasMatch: result.hasMatch || false,
        source: result.source || null,
        errors: result.errors || [],
        confidence: result.confidence
      };
    } catch (error) {
      console.error('[TestExtractionService] Error testing extraction:', error);
      return {
        values: {},
        hasMatch: false,
        source: null,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        confidence: 0
      };
    }
  }
}
