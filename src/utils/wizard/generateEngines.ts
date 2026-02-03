// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { TaskTreeNode } from '../../types/taskTypes';
import type { SemanticContract, EngineConfig, EngineType } from '../../types/semanticContract';
import { EngineService } from '../../services/EngineService';
import { buildAIPrompt } from '../aiPromptTemplates';
import type { GenerationProgress } from './types';

/**
 * Build engine config from AI response
 * Pure function: input → output
 */
export function buildEngineConfigFromAIResponse(engineType: EngineType, aiResponse: any): EngineConfig['config'] {
  switch (engineType) {
    case 'regex':
      return {
        regex: aiResponse.regex || ''
      };
    case 'llm':
      return {
        llmPrompt: aiResponse.extraction_prompt || '',
        llmModel: aiResponse.model || undefined
      };
    case 'rule_based':
      return {
        rules: aiResponse.rules || []
      };
    case 'ner':
      return {
        nerEntityTypes: aiResponse.entityTypes || {},
        nerContextPatterns: aiResponse.contextPatterns || {}
      };
    case 'embedding':
      return {
        embeddingExamples: aiResponse.examples || { positive: [], negative: [] },
        embeddingThreshold: aiResponse.thresholds?.default || 0.7
      };
    default:
      return {};
  }
}

/**
 * Generate engine config for a single node and engine type
 * Side effect: calls API and saves to EngineService
 */
export async function generateEngineForNode(
  node: TaskTreeNode,
  engineType: EngineType,
  contract: SemanticContract,
  onProgress?: (progress: GenerationProgress) => void
): Promise<EngineConfig | null> {
  const nodeId = node.id || node.templateId;

  if (onProgress) {
    onProgress({
      currentStep: 0,
      totalSteps: 1,
      currentNodeId: nodeId,
      currentNodeLabel: node.label || nodeId,
      currentAction: `Generating ${engineType} engine...`,
      percentage: 0
    });
  }

  try {
    // Build AI prompt for this engine
    const prompt = buildAIPrompt({
      contract,
      currentText: '', // Empty for initial generation
      testerFeedback: [],
      engine: engineType
    });

    // Call AI to generate engine config
    const response = await fetch('/api/nlp/generate-regex', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: prompt,
        treeStructure: contract,
        testerFeedback: [],
        engine: engineType,
        kind: node.type,
        provider: localStorage.getItem('omnia.aiProvider') || 'openai',
        model: localStorage.getItem('omnia.aiModel') || undefined
      })
    });

    if (!response.ok) {
      throw new Error(`AI generation failed: ${response.statusText}`);
    }

    const data = await response.json();

    // Build engine config from AI response
    const engineConfig: EngineConfig = {
      type: engineType,
      config: buildEngineConfigFromAIResponse(engineType, data),
      version: 1,
      generatedAt: new Date(),
      generatedBy: 'ai'
    };

    // Save engine config
    await EngineService.save(nodeId, engineConfig);

    if (onProgress) {
      onProgress({
        currentStep: 1,
        totalSteps: 1,
        currentNodeId: nodeId,
        currentNodeLabel: node.label || nodeId,
        currentAction: `${engineType} engine generated and saved`,
        percentage: 100
      });
    }

    return engineConfig;
  } catch (error) {
    console.error(`[Wizard] Failed to generate ${engineType} engine for node ${nodeId}:`, error);
    return null;
  }
}
