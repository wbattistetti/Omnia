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
import { generateEnginesForNode } from './generateEnginesUnified';
import { generateEscalationForNode } from './generateEscalation';
import { generateTestExamplesForNode } from './generateTestExamples';
import { generateAIMessagesForNode, AIMessages } from './generateAIMessages';

/**
 * Generation result for a node
 *
 * Contains all artifacts generated for a single node:
 * - Contract: Semantic contract definition (deterministic, from node structure)
 * - Engines: All extraction engines (STEP 2)
 * - Escalation: Engine escalation strategy (STEP 3)
 * - TestExamples: Validation test cases (STEP 4)
 * - AIMessages: Dialogue messages (STEP 5)
 *
 * Note: Contract refinement, canonical values, and constraints generation are FORBIDDEN.
 * The SemanticContract is deterministic and never modified by AI.
 */
export interface NodeGenerationResult {
  nodeId: string;
  success: boolean;
  contract?: SemanticContract; // STEP 1: Deterministic contract (from node structure)
  engines?: EngineConfig[]; // STEP 2: All engines (unified)
  escalation?: EngineEscalation; // STEP 3: Escalation strategy
  testExamples?: string[]; // STEP 4: Test examples
  aiMessages?: AIMessages; // STEP 5: AI dialogue messages
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
 * Coordinates the generation pipeline in the correct order:
 *
 * STEP 1: Generate or load Semantic Contract (deterministic, from node structure)
 * STEP 2: Generate all extraction engines (unified)
 * STEP 3: Generate engine escalation strategy
 * STEP 4: Generate test examples
 * STEP 5: Generate AI dialogue messages
 *
 * Execution Flow:
 * - For each node in plan:
 *   - STEP 1: Generate or load contract (deterministic, never modified by AI)
 *   - STEP 2: Generate all engines (unified)
 *   - STEP 3: Generate escalation
 *   - STEP 4: Generate test examples
 *   - STEP 5: Generate AI messages
 *   - Save to database (Persistence)
 *   - Report progress (UI callback)
 *
 * Note: Contract refinement, canonical values, and constraints generation are FORBIDDEN.
 * The SemanticContract is deterministic and never modified by AI.
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

    // ⚠️ ARCHITECTURAL RULE: SemanticContract is deterministic and never modified
    // The contract is built once from node structure and never changed
    // Removed: refineContract, generateCanonicalValues, generateConstraints
    // These functions violated the principle that SemanticContract must be immutable

    // STEP 2: Generate all engines (unified)
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

    // STEP 3: Generate escalation
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

    // STEP 4: Generate test examples
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

    // STEP 5: Generate AI messages
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
