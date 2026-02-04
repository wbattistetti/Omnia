// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * ORCHESTRATOR LAYER - executeGenerationPlan.ts
 *
 * This is the ONLY layer with side effects in the generation pipeline.
 * All other layers (Contract, Engine, Test, etc.) are pure functions.
 *
 * Responsibilities:
 * - Coordinates all generation steps in the correct order
 * - Manages progress reporting to UI
 * - Handles errors and retries
 * - Persists generated artifacts (contracts, engines, tests)
 * - Maintains generation state
 *
 * Architecture:
 * - Follows 7-Layer Architecture pattern
 * - Orchestrator is the single point of coordination
 * - Delegates to specialized layers (Contract, Engine, Test)
 * - No business logic - only coordination
 *
 * Side Effects:
 * - API calls to AI services
 * - Database persistence (SemanticContractService, EngineEscalationService)
 * - Progress callbacks to UI
 *
 * @see ARCHITECTURE.md for complete architecture documentation
 */

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
 *
 * Contains all artifacts generated for a single node:
 * - Contract: Semantic contract definition
 * - Engines: Recognition engines (regex, NER, LLM, heuristic)
 * - Escalation: Fallback strategy when no engine matches
 * - TestExamples: Validation test cases
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
 *
 * Pure function: input → output, no side effects
 * Recursively searches through tree structure
 *
 * @param nodeId - ID to search for (can be node.id or node.templateId)
 * @param nodes - Array of nodes to search
 * @returns Found node or null
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
 *
 * ORCHESTRATOR FUNCTION - This is the main entry point for generation.
 * Coordinates all layers in the correct order:
 *
 * 1. Contract Layer: Generate semantic contract
 * 2. Engine Layer: Generate recognition engines
 * 3. Test Layer: Generate test examples
 * 4. Persistence: Save all artifacts
 *
 * Execution Flow:
 * - For each node in plan:
 *   - Generate contract (Contract Layer)
 *   - Generate engines (Engine Layer)
 *   - Generate tests (Test Layer)
 *   - Save to database (Persistence)
 *   - Report progress (UI callback)
 *
 * Error Handling:
 * - Continues on individual node failures
 * - Collects errors per node
 * - Returns partial results
 *
 * Progress Reporting:
 * - Calls progressCallback for each step
 * - Reports current node, action, percentage
 *
 * @param plan - Generation plan with nodes to process
 * @param taskTree - Complete TaskTree structure
 * @param onProgress - Optional callback for progress updates
 * @returns Map of generation results, keyed by node ID
 *
 * @example
 * ```typescript
 * const plan = buildGenerationPlan(analysis);
 * const results = await executeGenerationPlan(plan, taskTree, (progress) => {
 *   console.log(`Progress: ${progress.percentage}%`);
 * });
 * ```
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
