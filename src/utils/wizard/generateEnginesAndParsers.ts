// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { TaskTreeNode } from '../../types/taskTypes';
import type { SemanticContract, EngineType } from '../../types/semanticContract';
import type { DataContract, DataContractItem } from '../../components/DialogueDataEngine/contracts/contractLoader';
import { EngineEscalationService } from '../../services/EngineEscalationService';
import { DialogueTaskService } from '../../services/DialogueTaskService';
import { SemanticContractService } from '../../services/SemanticContractService';
import { buildAIPrompt } from '../aiPromptTemplates';
import { buildEngineConfigFromAIResponse } from './generateEngines';
import type { GenerationProgress } from './types';

/**
 * SEZIONE 2: Decide which engines to use for a node based on SemanticContract
 * Uses deterministic rules (getDefaultEscalation) based on entity type
 */
export function decideEnginesForNode(
  node: TaskTreeNode,
  contract: SemanticContract
): EngineType[] {
  const nodeId = node.id || node.templateId;
  const entityType = contract.entity?.type || node.type || 'generic';

  // Get default escalation based on entity type
  const escalation = EngineEscalationService.getDefaultEscalation(nodeId, entityType);

  // Return only enabled engines, sorted by priority
  const enabledEngines = escalation.engines
    .filter(e => e.enabled)
    .sort((a, b) => a.priority - b.priority)
    .map(e => e.type);

  console.log(`[decideEnginesForNode] Engines decided for node ${nodeId}`, {
    nodeLabel: node.label,
    entityType,
    engines: enabledEngines,
    totalEngines: enabledEngines.length
  });

  return enabledEngines;
}

/**
 * Convert EngineConfig to DataContractItem
 */
function convertEngineConfigToDataContractItem(
  engineType: EngineType,
  config: any
): DataContractItem | null {
  switch (engineType) {
    case 'regex':
      return {
        type: 'regex',
        enabled: true,
        patterns: config.regex ? [config.regex] : [],
        examples: [],
        testCases: []
      };

    case 'llm':
      return {
        type: 'llm',
        enabled: true,
        systemPrompt: config.llmPrompt || '',
        userPromptTemplate: config.llmPrompt || '',
        responseSchema: {}
      };

    case 'rule_based':
      return {
        type: 'rules',
        enabled: true,
        extractorCode: JSON.stringify(config.rules || []),
        validators: [],
        testCases: []
      };

    case 'ner':
      return {
        type: 'ner',
        enabled: true,
        entityTypes: Object.keys(config.nerEntityTypes || {}),
        confidence: 0.7
      };

    case 'embedding':
      return {
        type: 'embeddings',
        enabled: true,
        threshold: config.embeddingThreshold || 0.7
      };

    default:
      console.warn(`[convertEngineConfigToDataContractItem] Unknown engine type: ${engineType}`);
      return null;
  }
}

/**
 * SEZIONE 3: Generate parser for a single engine and save to DataContract
 */
export async function generateParserForEngine(
  node: TaskTreeNode,
  engineType: EngineType,
  contract: SemanticContract,
  onProgress?: (progress: GenerationProgress) => void
): Promise<DataContractItem | null> {
  const nodeId = node.id || node.templateId;

  if (onProgress) {
    onProgress({
      currentStep: 0,
      totalSteps: 1,
      currentNodeId: nodeId,
      currentNodeLabel: node.label || nodeId,
      currentAction: `Generating ${engineType} parser...`,
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

    // Call AI to generate parser
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
    const engineConfig = buildEngineConfigFromAIResponse(engineType, data);

    // Convert to DataContractItem
    const contractItem = convertEngineConfigToDataContractItem(engineType, engineConfig);

    if (!contractItem) {
      throw new Error(`Failed to convert engine config to DataContractItem for ${engineType}`);
    }

    if (onProgress) {
      onProgress({
        currentStep: 1,
        totalSteps: 1,
        currentNodeId: nodeId,
        currentNodeLabel: node.label || nodeId,
        currentAction: `${engineType} parser generated`,
        percentage: 100
      });
    }

    console.log(`[generateParserForEngine] ✅ Parser generated for ${engineType}`, {
      nodeId,
      nodeLabel: node.label,
      engineType,
      hasPatterns: engineType === 'regex' ? (contractItem as any).patterns?.length > 0 : true
    });

    return contractItem;
  } catch (error) {
    console.error(`[generateParserForEngine] ❌ Failed to generate ${engineType} parser for node ${nodeId}:`, error);
    return null;
  }
}

/**
 * Generate engines and parsers for all nodes in TaskTree
 *
 * ARCHITECTURAL RULES:
 * - SEZIONE 2: AI decides which engines to use (deterministic based on entity type)
 * - SEZIONE 3: Wizard generates parser for each engine
 * - Parsers are saved in DataContract.contracts[]
 * - This function is IDEMPOTENT: skips nodes that already have parsers
 */
export async function generateEnginesAndParsersForAllNodes(
  taskTree: { nodes: TaskTreeNode[] },
  contracts: Map<string, SemanticContract>,
  onProgress?: (progress: GenerationProgress) => void
): Promise<void> {
  if (!taskTree || !taskTree.nodes || taskTree.nodes.length === 0) {
    console.log('[generateEnginesAndParsersForAllNodes] TaskTree is empty, skipping engine generation');
    return;
  }

  // Collect all nodes recursively
  const collectAllNodes = (nodes: TaskTreeNode[]): TaskTreeNode[] => {
    const all: TaskTreeNode[] = [];
    const traverse = (nodeList: TaskTreeNode[]) => {
      for (const node of nodeList) {
        all.push(node);
        if (node.subNodes && Array.isArray(node.subNodes) && node.subNodes.length > 0) {
          traverse(node.subNodes);
        }
      }
    };
    traverse(nodes);
    return all;
  };

  const allNodes = collectAllNodes(taskTree.nodes);
  console.log('[generateEnginesAndParsersForAllNodes] Collected nodes', {
    totalNodes: allNodes.length,
    mainNodes: taskTree.nodes.length
  });

  // Load all contracts (both newly generated and existing ones)
  const allContracts = new Map<string, SemanticContract>();

  // Add newly generated contracts
  for (const [nodeId, contract] of contracts.entries()) {
    allContracts.set(nodeId, contract);
  }

  // Load existing contracts for nodes that don't have newly generated ones
  const existingContractPromises = allNodes
    .filter(node => {
      const nodeId = node.id || node.templateId;
      return !allContracts.has(nodeId);
    })
    .map(async (node) => {
      const nodeId = node.id || node.templateId;
      const existingContract = await SemanticContractService.load(nodeId);
      return { nodeId, contract: existingContract };
    });

  const existingContractResults = await Promise.all(existingContractPromises);
  for (const { nodeId, contract } of existingContractResults) {
    if (contract) {
      allContracts.set(nodeId, contract);
    }
  }

  // Filter nodes that have contracts and templates
  const nodesToProcess = allNodes.filter(node => {
    const nodeId = node.id || node.templateId;
    const contract = allContracts.get(nodeId);
    const template = DialogueTaskService.getTemplate(nodeId);
    return contract && template;
  });

  console.log('[generateEnginesAndParsersForAllNodes] Nodes to process', {
    totalNodes: allNodes.length,
    nodesToProcess: nodesToProcess.length,
    nodeIds: nodesToProcess.map(n => n.id || n.templateId)
  });

  // Process each node
  let processedCount = 0;
  for (const node of nodesToProcess) {
    const nodeId = node.id || node.templateId;
    const contract = allContracts.get(nodeId);
    const template = DialogueTaskService.getTemplate(nodeId);

    if (!contract || !template) {
      console.warn(`[generateEnginesAndParsersForAllNodes] ⚠️ Skipping node ${nodeId} - missing contract or template`);
      continue;
    }

    // Ensure DataContract exists
    if (!template.dataContract) {
      template.dataContract = {
        templateName: template.label || nodeId,
        templateId: nodeId,
        subDataMapping: {},
        contracts: []
      };
    }

    // SEZIONE 2: Decide which engines to use (must run before idempotency check)
    const engines = decideEnginesForNode(node, contract);

    if (engines.length === 0) {
      console.warn(`[generateEnginesAndParsersForAllNodes] ⚠️ No engines decided for node ${nodeId}`);
      continue;
    }

    // Idempotency check: skip only if ALL required engines are already present.
    // 'rule_based' engine maps to contract type 'rules'.
    const engineTypeToContractType = (e: string): string => e === 'rule_based' ? 'rules' : e;
    const existingTypes = new Set((template.dataContract.contracts || []).map(c => c.type));
    const missingEngines = engines.filter(e => !existingTypes.has(engineTypeToContractType(e)));

    if (missingEngines.length === 0) {
      console.log(`[generateEnginesAndParsersForAllNodes] ⚠️ Node ${nodeId} already has all required parsers, skipping`, {
        existingTypes: [...existingTypes],
        requiredEngines: engines
      });
      continue;
    }

    console.log(`[generateEnginesAndParsersForAllNodes] 🔧 Node ${nodeId} — generating missing engines`, {
      missing: missingEngines,
      alreadyPresent: [...existingTypes]
    });

    // SEZIONE 3: Generate parser for each MISSING engine
    const parserResults = await Promise.allSettled(
      missingEngines.map(async (engineType) => {
        const parser = await generateParserForEngine(node, engineType, contract, (progress) => {
          if (onProgress) {
            onProgress({
              ...progress,
              currentStep: processedCount * missingEngines.length + missingEngines.indexOf(engineType) + 1,
              totalSteps: nodesToProcess.length * missingEngines.length,
              percentage: Math.round(((processedCount * missingEngines.length + missingEngines.indexOf(engineType) + 1) / (nodesToProcess.length * missingEngines.length)) * 100)
            });
          }
        });
        return { engineType, parser };
      })
    );

    // Collect successful parsers
    const generatedParsers: DataContractItem[] = [];
    for (const result of parserResults) {
      if (result.status === 'fulfilled' && result.value.parser) {
        generatedParsers.push(result.value.parser);
      } else {
        console.warn(`[generateEnginesAndParsersForAllNodes] ⚠️ Failed to generate parser for engine ${result.status === 'fulfilled' ? result.value.engineType : 'unknown'}`);
      }
    }

    // Save parsers to DataContract — append to any contracts already present (e.g. LLM from wizard)
    if (generatedParsers.length > 0) {
      const existingContracts = template.dataContract.contracts || [];
      // Merge: keep existing contracts, add newly generated ones (avoid duplicates by type)
      const generatedTypes = new Set(generatedParsers.map(p => p.type));
      const kept = existingContracts.filter(c => !generatedTypes.has(c.type));
      template.dataContract.contracts = [...kept, ...generatedParsers];
      DialogueTaskService.markTemplateAsModified(nodeId);

      console.log(`[generateEnginesAndParsersForAllNodes] ✅ Saved ${generatedParsers.length} parsers for node ${nodeId}`, {
        nodeLabel: node.label,
        engines: generatedParsers.map(p => p.type),
        contractsCount: template.dataContract.contracts.length
      });
    } else {
      console.warn(`[generateEnginesAndParsersForAllNodes] ⚠️ No parsers generated for node ${nodeId}`);
    }

    processedCount++;
  }

  console.log('[generateEnginesAndParsersForAllNodes] ✅ Engine and parser generation complete', {
    totalNodes: allNodes.length,
    nodesProcessed: processedCount,
    nodesSkipped: nodesToProcess.length - processedCount
  });
}
