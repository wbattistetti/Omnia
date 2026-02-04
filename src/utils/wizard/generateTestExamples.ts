// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * CONTRACT LAYER - generateTestExamples.ts
 *
 * Generates test examples for semantic contracts.
 * Returns three types of test examples: validExamples, edgeCaseExamples, invalidExamples.
 *
 * Architecture:
 * - Pure function for merge logic (deterministic)
 * - Side effect: API call to backend (isolated)
 * - Non-destructive: preserves existing test examples if present
 * - Additive: only adds new test examples
 *
 * @see ARCHITECTURE.md for complete architecture documentation
 */

import type { TaskTreeNode } from '../../types/taskTypes';
import type { SemanticContract } from '../../types/semanticContract';
import type { GenerationProgress } from './types';

/**
 * Test examples response from AI
 * Three arrays: validExamples, edgeCaseExamples, invalidExamples
 */
interface TestExamplesResponse {
  validExamples?: string[];
  edgeCaseExamples?: string[];
  invalidExamples?: string[];
}

/**
 * Validate AI response structure
 * Returns validated test examples or null if invalid
 */
function validateTestExamples(data: any): TestExamplesResponse | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const validated: TestExamplesResponse = {
    validExamples: [],
    edgeCaseExamples: [],
    invalidExamples: []
  };

  // Validate validExamples
  if (data.validExamples !== undefined) {
    if (Array.isArray(data.validExamples)) {
      validated.validExamples = data.validExamples.filter((ex: any) => typeof ex === 'string' && ex.trim().length > 0);
    }
  }

  // Validate edgeCaseExamples
  if (data.edgeCaseExamples !== undefined) {
    if (Array.isArray(data.edgeCaseExamples)) {
      validated.edgeCaseExamples = data.edgeCaseExamples.filter((ex: any) => typeof ex === 'string' && ex.trim().length > 0);
    }
  }

  // Validate invalidExamples
  if (data.invalidExamples !== undefined) {
    if (Array.isArray(data.invalidExamples)) {
      validated.invalidExamples = data.invalidExamples.filter((ex: any) => typeof ex === 'string' && ex.trim().length > 0);
    }
  }

  // At least one valid example must be present
  if (!validated.validExamples || validated.validExamples.length === 0) {
    return null; // Invalid: must have at least one valid example
  }

  return validated;
}

/**
 * Merge test examples (pure function)
 * Non-destructive: preserves existing test examples
 * Additive: only adds new test examples (no duplicates)
 */
function mergeTestExamples(
  existingExamples: string[],
  newExamples: TestExamplesResponse
): string[] {
  // Combine all new examples
  const allNewExamples = [
    ...(newExamples.validExamples || []),
    ...(newExamples.edgeCaseExamples || []),
    ...(newExamples.invalidExamples || [])
  ];

  // Merge with existing (avoid duplicates)
  const merged = [...existingExamples];
  for (const newEx of allNewExamples) {
    if (!merged.includes(newEx)) {
      merged.push(newEx);
    }
  }

  return merged;
}

/**
 * Generate test examples for a node using AI
 *
 * This function:
 * 1. Calls backend API to get AI-generated test examples
 * 2. Validates AI response
 * 3. Merges with existing test examples (non-destructively)
 * 4. Returns combined test examples array or existing if generation fails
 *
 * @param node - Task tree node (for context)
 * @param contract - Semantic contract to generate test examples for
 * @param existingExamples - Optional existing test examples to merge with
 * @param onProgress - Optional progress callback
 * @returns Array of test examples (combined valid, edge case, and invalid)
 */
export async function generateTestExamplesForNode(
  node: TaskTreeNode,
  contract: SemanticContract,
  existingExamples?: string[],
  onProgress?: (progress: GenerationProgress) => void
): Promise<string[]> {
  const nodeId = node.id || node.templateId;
  const nodeLabel = node.label || nodeId;

  if (onProgress) {
    onProgress({
      currentStep: 0,
      totalSteps: 1,
      currentNodeId: nodeId,
      currentNodeLabel: nodeLabel,
      currentAction: 'Generating test examples with AI...',
      percentage: 0
    });
  }

  try {
    // Call backend API
    const response = await fetch('/api/nlp/generate-test-examples', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contract,
        nodeLabel,
        provider: localStorage.getItem('omnia.aiProvider') || 'openai',
        model: localStorage.getItem('omnia.aiModel') || undefined
      })
    });

    if (!response.ok) {
      console.warn('[generateTestExamples] API call failed:', response.statusText);
      return existingExamples || []; // Fallback to existing examples
    }

    const data = await response.json();

    if (!data.success || !data.testExamples) {
      console.warn('[generateTestExamples] AI generation failed or returned no test examples');
      return existingExamples || []; // Fallback to existing examples
    }

    // Validate test examples structure
    const validated = validateTestExamples(data.testExamples);

    if (!validated) {
      console.warn('[generateTestExamples] Invalid test examples structure, returning existing examples');
      return existingExamples || []; // Fallback to existing examples
    }

    // Merge with existing examples (pure function)
    const merged = mergeTestExamples(existingExamples || [], validated);

    if (onProgress) {
      onProgress({
        currentStep: 1,
        totalSteps: 1,
        currentNodeId: nodeId,
        currentNodeLabel: nodeLabel,
        currentAction: `Generated ${merged.length} test examples (${validated.validExamples.length} valid, ${validated.edgeCaseExamples.length} edge cases, ${validated.invalidExamples.length} invalid)`,
        percentage: 100
      });
    }

    return merged;

  } catch (error) {
    console.warn('[generateTestExamples] Error during generation:', error);
    return existingExamples || []; // Fallback to existing examples
  }
}
