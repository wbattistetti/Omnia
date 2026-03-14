// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { ExtractionResult } from '../types/semanticContract';

/**
 * Service for testing extraction via backend
 * Routes to VB.NET for regex, Python for other engines
 */
export class TestExtractionService {
  /**
   * Test extraction for a given task, text, and engine type
   * VB.NET for regex, Python for NER/LLM/Embedding
   */
  static async testExtraction(
    taskId: string,
    text: string,
    engineType: 'regex' | 'ner' | 'llm' | 'embedding' | 'rules' = 'regex',
    contractJson?: string  // Optional: contract JSON for VB.NET regex engine
  ): Promise<ExtractionResult> {
    try {
      // Route to VB.NET for regex (direct call, like other VB.NET endpoints)
      // Python for other engines (via Vite proxy)
      const isRegex = engineType === 'regex';
      const baseUrl = isRegex
        ? 'http://localhost:5000'  // Direct VB.NET call (same pattern as other services)
        : '';  // Relative URL for Python (via Vite proxy)

      const endpoint = isRegex
        ? `${baseUrl}/api/runtime/task/${taskId}/test-extraction`
        : `/api/task/${taskId}/test-extraction`;

      const requestBody: any = { text, engineType };
      if (isRegex && contractJson) {
        requestBody.contractJson = contractJson;
      }

      console.log('[TestExtractionService] Request:', {
        endpoint,
        taskId,
        text,
        engineType,
        hasContractJson: !!contractJson,
        contractJsonLength: contractJson?.length || 0,
        requestBodyKeys: Object.keys(requestBody)
      });

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      console.log('[TestExtractionService] Response status:', response.status, response.statusText);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
        console.error('[TestExtractionService] Error response:', error);
        throw new Error(error.detail || error.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      console.log('[TestExtractionService] Success:', result);

      return {
        values: result.values || {},
        hasMatch: result.hasMatch || false,
        source: result.source || engineType,
        errors: result.errors || [],
        confidence: result.confidence || 0
      };
    } catch (error) {
      console.error(`[TestExtractionService] Error testing ${engineType} extraction:`, error);
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
