// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { TaskTree, TaskTreeNode } from '../../types/taskTypes';
import type { SemanticContract, EngineConfig, EngineEscalation, EngineType } from '../../types/semanticContract';
import { SemanticContractService } from '../../services/SemanticContractService';
import { EngineEscalationService } from '../../services/EngineEscalationService';
import type { GenerationPlan } from './buildGenerationPlan';
import type { GenerationProgress } from './types';
import { generateContractForNode } from './generateContract';
import { generateEngineForNode } from './generateEngines';
import { generateTestExamplesForNode } from './generateTestExamples';

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
 * Find node by ID in tree
 * Pure function: input → output
 */
function findNode(nodeId: string, nodes: TaskTreeNode[]): TaskTreeNode | null {
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
}

/**
 * Execute generation plan
 * Orchestrator: coordinates all generation steps, handles side effects
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
