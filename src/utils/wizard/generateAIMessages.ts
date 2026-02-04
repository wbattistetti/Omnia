// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * CONTRACT LAYER - generateAIMessages.ts
 *
 * Generates AI dialogue messages for semantic contracts.
 * Returns messages for all dialogue steps: start, noInput, noMatch, confirmation, success.
 *
 * Architecture:
 * - Pure function for merge logic (deterministic)
 * - Side effect: API call to backend (isolated)
 * - Non-destructive: preserves existing messages if present
 * - Additive: only adds new messages
 *
 * @see ARCHITECTURE.md for complete architecture documentation
 */

import type { SemanticContract } from '../../types/semanticContract';
import type { GenerationProgress } from './types';

/**
 * AI Messages structure
 * All message types are arrays of strings
 */
export interface AIMessages {
  start: string[];
  noInput: string[];
  noMatch: string[];
  confirmation: string[];
  success: string[];
}

/**
 * AI Messages response from backend
 */
interface AIMessagesResponse {
  start?: string[];
  noInput?: string[];
  noMatch?: string[];
  confirmation?: string[];
  success?: string[];
}

/**
 * Validate AI response structure
 * Returns validated messages or null if invalid
 */
function validateAIMessages(data: any): AIMessagesResponse | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const validated: AIMessagesResponse = {};

  // Validate each message type
  const messageTypes = ['start', 'noInput', 'noMatch', 'confirmation', 'success'];

  for (const msgType of messageTypes) {
    if (data[msgType] !== undefined) {
      if (Array.isArray(data[msgType])) {
        // Filter to ensure all items are strings and non-empty
        validated[msgType] = data[msgType].filter((msg: any) =>
          typeof msg === 'string' && msg.trim().length > 0
        );
      } else if (typeof data[msgType] === 'string' && data[msgType].trim().length > 0) {
        // Single value -> convert to array
        validated[msgType] = [data[msgType].trim()];
      } else {
        validated[msgType] = [];
      }
    }
  }

  // At least start message must be present
  if (!validated.start || validated.start.length === 0) {
    return null; // Invalid: must have at least one start message
  }

  return validated;
}

/**
 * Merge AI messages (pure function)
 * Non-destructive: preserves existing messages
 * Additive: only adds new messages (no duplicates)
 */
function mergeAIMessages(
  existingMessages: AIMessages | null,
  newMessages: AIMessagesResponse
): AIMessages {
  // If no existing messages, use new ones
  if (!existingMessages) {
    return {
      start: newMessages.start || [],
      noInput: newMessages.noInput || [],
      noMatch: newMessages.noMatch || [],
      confirmation: newMessages.confirmation || [],
      success: newMessages.success || []
    };
  }

  // Merge: preserve existing messages, add new ones (avoid duplicates)
  const merged: AIMessages = {
    start: [...existingMessages.start],
    noInput: [...existingMessages.noInput],
    noMatch: [...existingMessages.noMatch],
    confirmation: [...existingMessages.confirmation],
    success: [...existingMessages.success]
  };

  // Add new messages (avoid duplicates)
  if (newMessages.start) {
    for (const msg of newMessages.start) {
      if (!merged.start.includes(msg)) {
        merged.start.push(msg);
      }
    }
  }

  if (newMessages.noInput) {
    for (const msg of newMessages.noInput) {
      if (!merged.noInput.includes(msg)) {
        merged.noInput.push(msg);
      }
    }
  }

  if (newMessages.noMatch) {
    for (const msg of newMessages.noMatch) {
      if (!merged.noMatch.includes(msg)) {
        merged.noMatch.push(msg);
      }
    }
  }

  if (newMessages.confirmation) {
    for (const msg of newMessages.confirmation) {
      if (!merged.confirmation.includes(msg)) {
        merged.confirmation.push(msg);
      }
    }
  }

  if (newMessages.success) {
    for (const msg of newMessages.success) {
      if (!merged.success.includes(msg)) {
        merged.success.push(msg);
      }
    }
  }

  return merged;
}

/**
 * Generate AI messages for a contract using AI
 *
 * This function:
 * 1. Calls backend API to get AI-generated messages
 * 2. Validates AI response
 * 3. Merges with existing messages (non-destructively)
 * 4. Returns combined messages or existing if generation fails
 *
 * @param contract - Semantic contract to generate messages for
 * @param nodeLabel - Optional node label for context
 * @param existingMessages - Optional existing messages to merge with
 * @param onProgress - Optional progress callback
 * @returns AIMessages object or existing messages if generation fails
 */
export async function generateAIMessagesForNode(
  contract: SemanticContract,
  nodeLabel?: string,
  existingMessages?: AIMessages | null,
  onProgress?: (progress: GenerationProgress) => void
): Promise<AIMessages | null> {
  if (onProgress) {
    onProgress({
      currentStep: 0,
      totalSteps: 1,
      currentNodeId: '',
      currentNodeLabel: nodeLabel || contract.entity.label,
      currentAction: 'Generating AI messages with AI...',
      percentage: 0
    });
  }

  try {
    // Call backend API
    const response = await fetch('/api/nlp/generate-ai-messages', {
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
      console.warn('[generateAIMessages] API call failed:', response.statusText);
      return existingMessages || null; // Fallback to existing messages
    }

    const data = await response.json();

    if (!data.success || !data.messages) {
      console.warn('[generateAIMessages] AI generation failed or returned no messages');
      return existingMessages || null; // Fallback to existing messages
    }

    // Validate messages structure
    const validated = validateAIMessages(data.messages);

    if (!validated) {
      console.warn('[generateAIMessages] Invalid messages structure, returning existing messages');
      return existingMessages || null; // Fallback to existing messages
    }

    // Merge with existing messages (pure function)
    const merged = mergeAIMessages(existingMessages || null, validated);

    if (onProgress) {
      onProgress({
        currentStep: 1,
        totalSteps: 1,
        currentNodeId: '',
        currentNodeLabel: nodeLabel || contract.entity.label,
        currentAction: `Generated AI messages (${merged.start.length} start, ${merged.noInput.length} noInput, ${merged.noMatch.length} noMatch)`,
        percentage: 100
      });
    }

    return merged;

  } catch (error) {
    console.warn('[generateAIMessages] Error during generation:', error);
    return existingMessages || null; // Fallback to existing messages
  }
}
