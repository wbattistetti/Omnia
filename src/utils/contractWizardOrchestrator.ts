// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { TaskTreeNode, TaskTree } from '../types/taskTypes';
import type { SemanticContract, EngineConfig, EngineEscalation, EngineType } from '../types/semanticContract';
import { buildSemanticContract } from './semanticContractBuilder';
import { SemanticContractService } from '../services/SemanticContractService';
import { EngineService } from '../services/EngineService';
import { EngineEscalationService } from '../services/EngineEscalationService';
import { buildAIPrompt, getSystemMessageForEngine } from './aiPromptTemplates';
import { DialogueTaskService } from '../services/DialogueTaskService';

/**
 * Analysis result for a single node
 */
export interface NodeAnalysis {
  nodeId: string;
  nodeLabel: string;
  hasContract: boolean;
  hasEngines: boolean;
  missingEngines: EngineType[];
  contractComplete: boolean;
  isComposite: boolean;
  subNodesCount: number;
}

/**
 * Analysis result for entire tree
 */
export interface TreeAnalysis {
  totalNodes: number;
  nodesWithoutContract: NodeAnalysis[];
  nodesWithoutEngines: NodeAnalysis[];
  nodesWithIncompleteContract: NodeAnalysis[];
  allNodes: NodeAnalysis[];
}

/**
 * Engine proposal for a node
 */
export interface EngineProposal {
  nodeId: string;
  engines: Array<{
    type: EngineType;
    priority: number;
    enabled: boolean;
    reason: string;
  }>;
}

/**
 * Generation plan for wizard
 */
export interface GenerationPlan {
  nodesToGenerate: Array<{
    nodeId: string;
    nodeLabel: string;
    generateContract: boolean;
    generateEngines: EngineType[];
    generateEscalation: boolean;
    generateTests: boolean;
  }>;
  totalSteps: number;
}

/**
 * Generation progress
 */
export interface GenerationProgress {
  currentStep: number;
  totalSteps: number;
  currentNodeId: string;
  currentNodeLabel: string;
  currentAction: string;
  percentage: number;
}

/**
 * Generation result for a node
 */
export interface NodeGenerationResult {
  nodeId: string;
  success: boolean;
  contract?: SemanticContract;
  engines?: Map<EngineType, EngineConfig>;
  escalation?: EngineEscalation;
  testExamples?: string[];
  errors?: string[];
}

/**
 * Analyze entire task tree to identify missing contracts and engines
 */
export async function analyzeTree(taskTree: TaskTree | null): Promise<TreeAnalysis> {
  if (!taskTree || !taskTree.nodes || taskTree.nodes.length === 0) {
    return {
      totalNodes: 0,
      nodesWithoutContract: [],
      nodesWithoutEngines: [],
      nodesWithIncompleteContract: [],
      allNodes: []
    };
  }

  const allNodes: NodeAnalysis[] = [];
  const nodesWithoutContract: NodeAnalysis[] = [];
  const nodesWithoutEngines: NodeAnalysis[] = [];
  const nodesWithIncompleteContract: NodeAnalysis[] = [];

  // Recursively analyze all nodes
  const analyzeNode = async (node: TaskTreeNode): Promise<void> => {
    const nodeId = node.id || node.templateId;
    const hasContract = await SemanticContractService.exists(nodeId);
    const escalation = await EngineEscalationService.load(nodeId);
    const hasEngines = escalation !== null && escalation.engines.some(e => e.enabled);

    // Check which engines are missing
    const missingEngines: EngineType[] = [];
    if (escalation) {
      const enabledEngines = escalation.engines.filter(e => e.enabled).map(e => e.type);
      // Check if engines actually exist
      for (const engineType of enabledEngines) {
        // TODO: Check if engine config exists for this type
        // For now, assume missing if escalation exists but no engines saved
      }
    } else {
      // No escalation = no engines
      missingEngines.push('regex', 'llm', 'rule_based', 'ner', 'embedding');
    }

    const analysis: NodeAnalysis = {
      nodeId,
      nodeLabel: node.label || nodeId,
      hasContract,
      hasEngines,
      missingEngines,
      contractComplete: hasContract, // TODO: Check if contract is complete
      isComposite: !!(node.subNodes && node.subNodes.length > 0),
      subNodesCount: node.subNodes?.length || 0
    };

    allNodes.push(analysis);

    if (!hasContract) {
      nodesWithoutContract.push(analysis);
    }

    if (!hasEngines) {
      nodesWithoutEngines.push(analysis);
    }

    if (hasContract && !analysis.contractComplete) {
      nodesWithIncompleteContract.push(analysis);
    }

    // Recursively analyze sub-nodes
    if (node.subNodes) {
      for (const subNode of node.subNodes) {
        await analyzeNode(subNode);
      }
    }
  };

  // Analyze all root nodes
  for (const node of taskTree.nodes) {
    await analyzeNode(node);
  }

  return {
    totalNodes: allNodes.length,
    nodesWithoutContract,
    nodesWithoutEngines,
    nodesWithIncompleteContract,
    allNodes
  };
}

/**
 * Propose engines for each node based on entity type and structure
 */
export function proposeEngines(analysis: TreeAnalysis, taskTree: TaskTree | null): EngineProposal[] {
  if (!taskTree || !taskTree.nodes) {
    return [];
  }

  const proposals: EngineProposal[] = [];

  // Helper to get entity type from node
  const getEntityType = (node: TaskTreeNode): string => {
    // Try multiple sources for entity type
    if (node.type && typeof node.type === 'string') {
      return node.type;
    }
    // Fallback to 'generic' if type is not available
    return 'generic';
  };

  // Helper to find node by ID
  const findNode = (nodeId: string, nodes: TaskTreeNode[]): TaskTreeNode | null => {
    for (const node of nodes) {
      if ((node.id || node.templateId) === nodeId) {
        return node;
      }
      if (node.subNodes) {
        const found = findNode(nodeId, node.subNodes);
        if (found) return found;
      }
    }
    return null;
  };

  // Propose engines for each node that needs them
  for (const nodeAnalysis of analysis.allNodes) {
    if (nodeAnalysis.hasEngines) {
      continue; // Skip nodes that already have engines
    }

    const node = findNode(nodeAnalysis.nodeId, taskTree.nodes);
    if (!node) continue;

    const entityType = getEntityType(node);
    const defaultEscalation = EngineEscalationService.getDefaultEscalation(nodeAnalysis.nodeId, entityType);

    proposals.push({
      nodeId: nodeAnalysis.nodeId,
      engines: defaultEscalation.engines.map(e => ({
        ...e,
        reason: `Default escalation for ${entityType} entity type`
      }))
    });
  }

  return proposals;
}

/**
 * Build generation plan from analysis and proposals
 */
export function buildGenerationPlan(
  analysis: TreeAnalysis,
  proposals: EngineProposal[],
  userSelection?: { nodeIds: string[] }
): GenerationPlan {
  const nodesToGenerate: GenerationPlan['nodesToGenerate'] = [];

  // Determine which nodes to generate
  const nodesToProcess = userSelection?.nodeIds
    ? analysis.allNodes.filter(n => userSelection.nodeIds.includes(n.nodeId))
    : analysis.allNodes.filter(n => !n.hasContract || !n.hasEngines);

  for (const nodeAnalysis of nodesToProcess) {
    const proposal = proposals.find(p => p.nodeId === nodeAnalysis.nodeId);
    const generateContract = !nodeAnalysis.hasContract;
    const generateEngines = proposal?.engines.filter(e => e.enabled).map(e => e.type) || [];
    const generateEscalation = !nodeAnalysis.hasEngines;
    const generateTests = true; // Always generate tests

    nodesToGenerate.push({
      nodeId: nodeAnalysis.nodeId,
      nodeLabel: nodeAnalysis.nodeLabel,
      generateContract,
      generateEngines,
      generateEscalation,
      generateTests
    });
  }

  // Calculate total steps (contract + engines + escalation + tests for each node)
  const totalSteps = nodesToGenerate.reduce((sum, node) => {
    let steps = 0;
    if (node.generateContract) steps += 1;
    steps += node.generateEngines.length;
    if (node.generateEscalation) steps += 1;
    if (node.generateTests) steps += 1;
    return sum + steps;
  }, 0);

  return {
    nodesToGenerate,
    totalSteps
  };
}

/**
 * Generate contract for a single node
 */
async function generateContractForNode(
  node: TaskTreeNode,
  onProgress?: (progress: GenerationProgress) => void
): Promise<SemanticContract | null> {
  const nodeId = node.id || node.templateId;

  if (onProgress) {
    onProgress({
      currentStep: 0,
      totalSteps: 1,
      currentNodeId: nodeId,
      currentNodeLabel: node.label || nodeId,
      currentAction: 'Generating semantic contract...',
      percentage: 0
    });
  }

  // Build contract deterministically from node
  const contract = buildSemanticContract(node);

  if (!contract) {
    console.error(`[Wizard] Failed to build contract for node ${nodeId}`);
    return null;
  }

  // Save contract
  await SemanticContractService.save(nodeId, contract);

  if (onProgress) {
    onProgress({
      currentStep: 1,
      totalSteps: 1,
      currentNodeId: nodeId,
      currentNodeLabel: node.label || nodeId,
      currentAction: 'Contract generated and saved',
      percentage: 100
    });
  }

  return contract;
}

/**
 * Generate engine config for a single node and engine type
 */
async function generateEngineForNode(
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

/**
 * Build engine config from AI response
 */
function buildEngineConfigFromAIResponse(engineType: EngineType, aiResponse: any): EngineConfig['config'] {
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
 * Generate test examples for a node
 */
async function generateTestExamplesForNode(
  node: TaskTreeNode,
  contract: SemanticContract,
  onProgress?: (progress: GenerationProgress) => void
): Promise<string[]> {
  const nodeId = node.id || node.templateId;

  if (onProgress) {
    onProgress({
      currentStep: 0,
      totalSteps: 1,
      currentNodeId: nodeId,
      currentNodeLabel: node.label || nodeId,
      currentAction: 'Generating test examples...',
      percentage: 0
    });
  }

  // Generate examples based on contract
  const examples: string[] = [];
  const subentities = contract.subentities || contract.subgroups || [];

  // Generate simple examples
  if (subentities.length === 0) {
    // Simple node - generate based on type
    const type = contract.entity?.type || contract.mainGroup?.kind || 'text';
    if (type === 'email') {
      examples.push('mario.rossi@example.com', 'test@domain.it');
    } else if (type === 'phone') {
      examples.push('+39 333 1234567', '06 12345678');
    } else {
      examples.push('example value', 'test input');
    }
  } else {
    // Composite node - generate examples with all subentities
    const example1 = subentities.map(sg => {
      if (sg.subTaskKey.includes('day')) return '15';
      if (sg.subTaskKey.includes('month')) return 'aprile';
      if (sg.subTaskKey.includes('year')) return '1980';
      return 'value';
    }).join(' ');
    examples.push(example1);

    // Generate partial example (missing some fields)
    if (subentities.length > 1) {
      const partialExample = subentities.slice(0, Math.floor(subentities.length / 2))
        .map(sg => {
          if (sg.subTaskKey.includes('month')) return 'marzo';
          if (sg.subTaskKey.includes('year')) return '1990';
          return 'value';
        }).join(' ');
      examples.push(partialExample);
    }
  }

  if (onProgress) {
    onProgress({
      currentStep: 1,
      totalSteps: 1,
      currentNodeId: nodeId,
      currentNodeLabel: node.label || nodeId,
      currentAction: `Generated ${examples.length} test examples`,
      percentage: 100
    });
  }

  return examples;
}

/**
 * Execute generation plan
 */
export async function executeGenerationPlan(
  plan: GenerationPlan,
  taskTree: TaskTree | null,
  onProgress?: (progress: GenerationProgress) => void
): Promise<Map<string, NodeGenerationResult>> {
  if (!taskTree || !taskTree.nodes) {
    return new Map();
  }

  const results = new Map<string, NodeGenerationResult>();
  let currentStep = 0;

  // Helper to find node by ID
  const findNode = (nodeId: string, nodes: TaskTreeNode[]): TaskTreeNode | null => {
    for (const node of nodes) {
      if ((node.id || node.templateId) === nodeId) {
        return node;
      }
      if (node.subNodes) {
        const found = findNode(nodeId, node.subNodes);
        if (found) return found;
      }
    }
    return null;
  };

  // Process each node
  for (const nodePlan of plan.nodesToGenerate) {
    const node = findNode(nodePlan.nodeId, taskTree.nodes);
    if (!node) {
      results.set(nodePlan.nodeId, {
        nodeId: nodePlan.nodeId,
        success: false,
        errors: ['Node not found in tree']
      });
      continue;
    }

    const nodeResult: NodeGenerationResult = {
      nodeId: nodePlan.nodeId,
      success: true,
      engines: new Map()
    };

    const errors: string[] = [];

    // Generate contract
    if (nodePlan.generateContract) {
      currentStep++;
      const contract = await generateContractForNode(node, (progress) => {
        if (onProgress) {
          onProgress({
            ...progress,
            currentStep,
            totalSteps: plan.totalSteps
          });
        }
      });

      if (contract) {
        nodeResult.contract = contract;
      } else {
        errors.push('Failed to generate contract');
        nodeResult.success = false;
      }
    } else {
      // Load existing contract
      nodeResult.contract = await SemanticContractService.load(nodePlan.nodeId) || undefined;
    }

    if (!nodeResult.contract) {
      nodeResult.success = false;
      nodeResult.errors = ['Contract is required but not available'];
      results.set(nodePlan.nodeId, nodeResult);
      continue;
    }

    // Generate engines
    for (const engineType of nodePlan.generateEngines) {
      currentStep++;
      const engine = await generateEngineForNode(
        node,
        engineType,
        nodeResult.contract,
        (progress) => {
          if (onProgress) {
            onProgress({
              ...progress,
              currentStep,
              totalSteps: plan.totalSteps
            });
          }
        }
      );

      if (engine) {
        nodeResult.engines!.set(engineType, engine);
      } else {
        errors.push(`Failed to generate ${engineType} engine`);
      }
    }

    // Generate escalation
    if (nodePlan.generateEscalation) {
      currentStep++;
      const proposal = plan.nodesToGenerate.find(p => p.nodeId === nodePlan.nodeId);
      if (proposal) {
        const escalation: EngineEscalation = {
          nodeId: nodePlan.nodeId,
          engines: proposal.generateEngines.map((type, idx) => ({
            type,
            priority: idx + 1,
            enabled: true
          })),
          defaultEngine: proposal.generateEngines[0]
        };

        await EngineEscalationService.save(nodePlan.nodeId, escalation);
        nodeResult.escalation = escalation;
      }
    }

    // Generate test examples
    if (nodePlan.generateTests && nodeResult.contract) {
      currentStep++;
      const examples = await generateTestExamplesForNode(
        node,
        nodeResult.contract,
        (progress) => {
          if (onProgress) {
            onProgress({
              ...progress,
              currentStep,
              totalSteps: plan.totalSteps
            });
          }
        }
      );
      nodeResult.testExamples = examples;
    }

    if (errors.length > 0) {
      nodeResult.errors = errors;
      if (errors.length === nodePlan.generateEngines.length) {
        nodeResult.success = false;
      }
    }

    results.set(nodePlan.nodeId, nodeResult);
  }

  return results;
}
