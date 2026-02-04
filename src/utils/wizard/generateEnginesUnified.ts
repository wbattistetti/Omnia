// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * CONTRACT LAYER - generateEnginesUnified.ts
 *
 * Generates all extraction engines for semantic contracts.
 * Returns all five engine types: regex, rule_based, ner, llm, embedding.
 *
 * Architecture:
 * - Pure function for merge logic (deterministic)
 * - Side effect: API call to backend (isolated)
 * - Non-destructive: preserves all existing contract fields
 * - Additive: only adds engines to contract (does not modify contract structure)
 *
 * @see ARCHITECTURE.md for complete architecture documentation
 */

import type { SemanticContract, EngineConfig, EngineType } from '../../types/semanticContract';
import type { GenerationProgress } from './types';

/**
 * Engines response from AI
 * All five engine types must be present
 */
interface EnginesResponse {
  regex?: {
    regex?: string;
    explanation?: string;
  };
  rule_based?: {
    rules?: Array<{
      condition?: string;
      action?: string;
      examples?: string[];
    }>;
  };
  ner?: {
    nerEntityTypes?: Record<string, string>;
    nerContextPatterns?: Record<string, string>;
  };
  llm?: {
    systemPrompt?: string;
    userPromptTemplate?: string;
    responseSchema?: object;
  };
  embedding?: {
    embeddingExamples?: {
      positive?: string[];
      negative?: string[];
    };
    embeddingThreshold?: number;
  };
}

/**
 * Validate AI response structure
 * Returns validated engines or null if invalid
 */
function validateEngines(data: any): EnginesResponse | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const validated: EnginesResponse = {};

  // Validate regex engine
  if (data.regex !== undefined) {
    if (typeof data.regex === 'object' && data.regex !== null) {
      validated.regex = {
        regex: typeof data.regex.regex === 'string' ? data.regex.regex : undefined,
        explanation: typeof data.regex.explanation === 'string' ? data.regex.explanation : undefined
      };
    }
  }

  // Validate rule_based engine
  if (data.rule_based !== undefined) {
    if (typeof data.rule_based === 'object' && data.rule_based !== null) {
      if (Array.isArray(data.rule_based.rules)) {
        validated.rule_based = {
          rules: data.rule_based.rules.filter((rule: any) => {
            return (
              rule &&
              typeof rule === 'object' &&
              (typeof rule.condition === 'string' || rule.condition === undefined) &&
              (typeof rule.action === 'string' || rule.action === undefined)
            );
          })
        };
      } else {
        validated.rule_based = { rules: [] };
      }
    }
  }

  // Validate ner engine
  if (data.ner !== undefined) {
    if (typeof data.ner === 'object' && data.ner !== null) {
      validated.ner = {
        nerEntityTypes: typeof data.ner.nerEntityTypes === 'object' && data.ner.nerEntityTypes !== null
          ? data.ner.nerEntityTypes
          : {},
        nerContextPatterns: typeof data.ner.nerContextPatterns === 'object' && data.ner.nerContextPatterns !== null
          ? data.ner.nerContextPatterns
          : {}
      };
    }
  }

  // Validate llm engine
  if (data.llm !== undefined) {
    if (typeof data.llm === 'object' && data.llm !== null) {
      validated.llm = {
        systemPrompt: typeof data.llm.systemPrompt === 'string' ? data.llm.systemPrompt : undefined,
        userPromptTemplate: typeof data.llm.userPromptTemplate === 'string' ? data.llm.userPromptTemplate : undefined,
        responseSchema: typeof data.llm.responseSchema === 'object' && data.llm.responseSchema !== null
          ? data.llm.responseSchema
          : undefined
      };
    }
  }

  // Validate embedding engine
  if (data.embedding !== undefined) {
    if (typeof data.embedding === 'object' && data.embedding !== null) {
      const examples = data.embedding.embeddingExamples;
      validated.embedding = {
        embeddingExamples: {
          positive: Array.isArray(examples?.positive) ? examples.positive.filter((ex: any) => typeof ex === 'string') : [],
          negative: Array.isArray(examples?.negative) ? examples.negative.filter((ex: any) => typeof ex === 'string') : []
        },
        embeddingThreshold: typeof data.embedding.embeddingThreshold === 'number'
          ? data.embedding.embeddingThreshold
          : 0.7
      };
    }
  }

  // At least one engine must be present
  if (!validated.regex && !validated.rule_based && !validated.ner && !validated.llm && !validated.embedding) {
    return null; // Invalid: must have at least one engine
  }

  return validated;
}

/**
 * Convert engines response to EngineConfig array
 * Creates EngineConfig objects for each engine type
 */
function convertToEngineConfigs(engines: EnginesResponse): EngineConfig[] {
  const configs: EngineConfig[] = [];

  // Regex engine
  if (engines.regex?.regex) {
    configs.push({
      type: 'regex',
      config: {
        regex: engines.regex.regex
      },
      version: 1,
      generatedAt: new Date(),
      generatedBy: 'ai'
    });
  }

  // Rule-based engine
  if (engines.rule_based?.rules && engines.rule_based.rules.length > 0) {
    configs.push({
      type: 'rule_based',
      config: {
        rules: engines.rule_based.rules.map(rule => ({
          condition: rule.condition || '',
          action: rule.action || '',
          examples: rule.examples || []
        }))
      },
      version: 1,
      generatedAt: new Date(),
      generatedBy: 'ai'
    });
  }

  // NER engine
  if (engines.ner && (engines.ner.nerEntityTypes || engines.ner.nerContextPatterns)) {
    configs.push({
      type: 'ner',
      config: {
        nerEntityTypes: engines.ner.nerEntityTypes || {},
        nerContextPatterns: engines.ner.nerContextPatterns || {}
      },
      version: 1,
      generatedAt: new Date(),
      generatedBy: 'ai'
    });
  }

  // LLM engine
  if (engines.llm && (engines.llm.systemPrompt || engines.llm.userPromptTemplate)) {
    configs.push({
      type: 'llm',
      config: {
        llmPrompt: engines.llm.userPromptTemplate || '',
        llmModel: undefined // Model is selected at runtime
      },
      version: 1,
      generatedAt: new Date(),
      generatedBy: 'ai'
    });
  }

  // Embedding engine
  if (engines.embedding && engines.embedding.embeddingExamples) {
    configs.push({
      type: 'embedding',
      config: {
        embeddingExamples: {
          positive: engines.embedding.embeddingExamples.positive || [],
          negative: engines.embedding.embeddingExamples.negative || []
        },
        embeddingThreshold: engines.embedding.embeddingThreshold || 0.7
      },
      version: 1,
      generatedAt: new Date(),
      generatedBy: 'ai'
    });
  }

  return configs;
}

/**
 * Merge engines into contract (pure function)
 * Non-destructive: preserves all existing contract fields
 * Additive: only adds engines (does not modify contract structure)
 *
 * Note: This function does NOT modify the contract directly.
 * Engines are stored separately in the task template.
 * This function returns the contract unchanged and the engines separately.
 */
function mergeEnginesIntoContract(
  contract: SemanticContract,
  engines: EnginesResponse
): { contract: SemanticContract; engines: EngineConfig[] } {
  // Create a deep copy to avoid mutating original
  const mergedContract: SemanticContract = JSON.parse(JSON.stringify(contract));

  // Convert engines to EngineConfig array
  const engineConfigs = convertToEngineConfigs(engines);

  // Update metadata (non-destructive)
  mergedContract.updatedAt = new Date();
  if (mergedContract.version) {
    mergedContract.version = mergedContract.version + 1;
  } else {
    mergedContract.version = 2;
  }

  // Return contract (unchanged structure) and engines separately
  // Engines are stored in the task template, not in the contract
  return {
    contract: mergedContract,
    engines: engineConfigs
  };
}

/**
 * Generate all engines for a contract using AI
 *
 * This function:
 * 1. Calls backend API to get AI-generated engines
 * 2. Validates AI response
 * 3. Converts to EngineConfig array
 * 4. Returns contract (unchanged) and engines separately
 * 5. Returns original contract if generation fails
 *
 * @param contract - Semantic contract to generate engines for
 * @param nodeLabel - Optional node label for context
 * @param onProgress - Optional progress callback
 * @returns Object with contract (unchanged) and engines array, or original contract if generation fails
 */
export async function generateEnginesForNode(
  contract: SemanticContract,
  nodeLabel?: string,
  onProgress?: (progress: GenerationProgress) => void
): Promise<{ contract: SemanticContract; engines: EngineConfig[] }> {
  if (onProgress) {
    onProgress({
      currentStep: 0,
      totalSteps: 1,
      currentNodeId: '',
      currentNodeLabel: nodeLabel || contract.entity.label,
      currentAction: 'Generating engines with AI...',
      percentage: 0
    });
  }

  try {
    // Call backend API
    const response = await fetch('/api/nlp/generate-engines', {
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
      console.warn('[generateEngines] API call failed:', response.statusText);
      return { contract, engines: [] }; // Fallback to original contract with empty engines
    }

    const data = await response.json();

    if (!data.success || !data.engines) {
      console.warn('[generateEngines] AI generation failed or returned no engines');
      return { contract, engines: [] }; // Fallback to original contract with empty engines
    }

    // Validate engines structure
    const validated = validateEngines(data.engines);

    if (!validated) {
      console.warn('[generateEngines] Invalid engines structure, returning original contract');
      return { contract, engines: [] }; // Fallback to original contract with empty engines
    }

    // Merge into contract (pure function)
    const result = mergeEnginesIntoContract(contract, validated);

    if (onProgress) {
      onProgress({
        currentStep: 1,
        totalSteps: 1,
        currentNodeId: '',
        currentNodeLabel: nodeLabel || contract.entity.label,
        currentAction: `Generated ${result.engines.length} engines`,
        percentage: 100
      });
    }

    return result;

  } catch (error) {
    console.warn('[generateEngines] Error during generation:', error);
    return { contract, engines: [] }; // Fallback to original contract with empty engines
  }
}
