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
import { refineContract } from './refineContract';
import { generateCanonicalValuesForNode } from './generateCanonicalValues';
import { generateConstraintsForNode } from './generateConstraints';
import { generateEnginesForNode } from './generateEnginesUnified';
import { generateEscalationForNode } from './generateEscalation';
import { generateTestExamplesForNode } from './generateTestExamples';
import { generateAIMessagesForNode, AIMessages } from './generateAIMessages';

/**
 * Generation result for a node
 *
 * Contains all artifacts generated for a single node (STEP 1-7):
 * - Contract: Semantic contract definition (STEP 1: refined)
 * - CanonicalValues: Canonical value sets (STEP 2)
 * - Constraints: Enhanced constraints (STEP 3)
 * - Engines: All extraction engines (STEP 4)
 * - Escalation: Engine escalation strategy (STEP 5)
 * - TestExamples: Validation test cases (STEP 6)
 * - AIMessages: Dialogue messages (STEP 7)
 */
export interface NodeGenerationResult {
  nodeId: string;
  success: boolean;
  contract?: SemanticContract; // STEP 1: Refined contract
  engines?: EngineConfig[]; // STEP 4: All engines (unified)
  escalation?: EngineEscalation; // STEP 5: Escalation strategy
  testExamples?: string[]; // STEP 6: Test examples
  aiMessages?: AIMessages; // STEP 7: AI dialogue messages
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
 * Coordinates all 7 steps of the internal pipeline in the correct order:
 *
 * STEP 1: Contract Refinement - Refine semantic contract
 * STEP 2: Canonical Values - Generate canonical value sets
 * STEP 3: Constraints - Generate enhanced constraints
 * STEP 4: Engines Unificati - Generate all extraction engines
 * STEP 5: Escalation - Generate engine escalation strategy
 * STEP 6: Test Examples - Generate test examples
 * STEP 7: Messaggi AI - Generate AI dialogue messages
 *
 * Execution Flow:
 * - For each node in plan:
 *   - STEP 1: Refine contract (if needed)
 *   - STEP 2: Generate canonical values
 *   - STEP 3: Generate constraints
 *   - STEP 4: Generate all engines (unified)
 *   - STEP 5: Generate escalation
 *   - STEP 6: Generate test examples
 *   - STEP 7: Generate AI messages
 *   - Save to database (Persistence)
 *   - Report progress (UI callback)
 *
 * Error Handling:
 * - Continues on individual step failures
 * - Collects errors per step
 * - Returns partial results
 * - Each step has safe fallback (returns original if generation fails)
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
      engines: []
    };

    const errors: string[] = [];

    // STEP 1: Generate or load contract
    let contract: SemanticContract | undefined;
    if (nodePlan.generateContract) {
      currentStep++;
      contract = await generateContractForNode(node, (progress) => {
        if (onProgress) {
          onProgress({
            ...progress,
            currentStep,
            totalSteps: plan.totalSteps
          });
        }
      });

      if (!contract) {
        errors.push('Failed to generate contract');
        nodeResult.success = false;
      }
    } else {
      // Load existing contract
      contract = await SemanticContractService.load(nodePlan.nodeId) || undefined;
    }

    if (!contract) {
      nodeResult.success = false;
      nodeResult.errors = ['Contract is required but not available'];
      results.set(nodePlan.nodeId, nodeResult);
      continue;
    }

    nodeResult.contract = contract;

    // STEP 1 (continued): Refine contract
    currentStep++;
    contract = await refineContract(contract, node.label, (progress) => {
      if (onProgress) {
        onProgress({
          ...progress,
          currentStep,
          totalSteps: plan.totalSteps
        });
      }
    });
    nodeResult.contract = contract; // Update with refined contract

    // STEP 2: Generate canonical values
    currentStep++;
    contract = await generateCanonicalValuesForNode(contract, node.label, (progress) => {
      if (onProgress) {
        onProgress({
          ...progress,
          currentStep,
          totalSteps: plan.totalSteps
        });
      }
    });
    nodeResult.contract = contract; // Update with canonical values

    // STEP 3: Generate constraints
    currentStep++;
    contract = await generateConstraintsForNode(contract, node.label, (progress) => {
      if (onProgress) {
        onProgress({
          ...progress,
          currentStep,
          totalSteps: plan.totalSteps
        });
      }
    });
    nodeResult.contract = contract; // Update with constraints

    // STEP 4: Generate all engines (unified)
    currentStep++;
    const enginesResult = await generateEnginesForNode(contract, node.label, (progress) => {
      if (onProgress) {
        onProgress({
          ...progress,
          currentStep,
          totalSteps: plan.totalSteps
        });
      }
    });
    contract = enginesResult.contract; // Update contract (metadata only)
    nodeResult.contract = contract;
    nodeResult.engines = enginesResult.engines; // Store engines separately

    // Save engines to service (if needed)
    if (enginesResult.engines.length > 0) {
      // TODO: Save engines to EngineService if needed
      // for (const engine of enginesResult.engines) {
      //   await EngineService.save(nodePlan.nodeId, engine);
      // }
    }

    // STEP 5: Generate escalation
    if (enginesResult.engines.length > 0) {
      currentStep++;
      // Load existing escalation if any
      const existingEscalation = await EngineEscalationService.load(nodePlan.nodeId) || null;
      const escalation = await generateEscalationForNode(
        contract,
        enginesResult.engines,
        nodePlan.nodeId,
        node.label,
        existingEscalation,
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

      if (escalation) {
        await EngineEscalationService.save(nodePlan.nodeId, escalation);
        nodeResult.escalation = escalation;
      } else {
        errors.push('Failed to generate escalation');
      }
    }

    // STEP 6: Generate test examples
    currentStep++;
    // Load existing test examples if any
    const existingExamples: string[] = []; // TODO: Load from node or service if needed
    const examples = await generateTestExamplesForNode(
      node,
      contract,
      existingExamples,
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

    // STEP 7: Generate AI messages
    currentStep++;
    // Load existing AI messages if any
    const existingMessages: AIMessages | null = null; // TODO: Load from node or service if needed
    const aiMessages = await generateAIMessagesForNode(
      contract,
      node.label,
      existingMessages,
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
    if (aiMessages) {
      nodeResult.aiMessages = aiMessages;
    } else {
      errors.push('Failed to generate AI messages');
    }

    // Save final contract to service
    if (nodeResult.contract) {
      await SemanticContractService.save(nodePlan.nodeId, nodeResult.contract);
    }

    if (errors.length > 0) {
      nodeResult.errors = errors;
      // Don't mark as failed if only optional steps failed
      if (errors.length > 3) { // More than 3 errors = significant failure
        nodeResult.success = false;
      }
    }

    results.set(nodePlan.nodeId, nodeResult);
  }

  return results;
}
