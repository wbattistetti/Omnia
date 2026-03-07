// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Parsers Generation Actions
 *
 * Pure functions for generating parsers in parallel for all engines.
 * Extracted from wizardActions.ts to improve modularity and maintainability.
 */

import type { WizardStore } from '../store/wizardStore';
import type { WizardTaskTreeNode } from '../types';
import { buildContractFromNode } from '../api/wizardApi';
import type { EngineType } from '@types/semanticContract';

export interface ParsersCounter {
  completed: number;
  total: number;
}

export interface ParsersProgressCallback {
  (phase: 'parser', taskId: string): void;
}

export interface EnginePlan {
  nodeId: string;
  nodeLabel: string;
  engines: string[];
}

/**
 * Plans engines for all tasks by calling the plan-engines API
 *
 * @param allTasks - All tasks to plan engines for
 * @param locale - Locale for planning
 * @returns Engine plans for each node
 */
export async function planEngines(
  allTasks: WizardTaskTreeNode[],
  locale: string
): Promise<{ enginePlans: EnginePlan[]; parsersPayload: string }> {
  const fullContract = {
    nodes: allTasks.map(task => ({
      nodeId: task.id,
      nodeLabel: task.label,
      contract: buildContractFromNode(task)
    }))
  };

  const provider = localStorage.getItem('omnia.aiProvider') || 'openai';
  const model = localStorage.getItem('omnia.aiModel') || undefined;

  try {
    const planResponse = await fetch('/api/nlp/plan-engines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contract: fullContract,
        locale,
        provider,
        model
      })
    });

    if (!planResponse.ok) {
      const errorText = await planResponse.text();
      throw new Error(`plan-engines API failed: ${planResponse.status} ${planResponse.statusText} - ${errorText}`);
    }

    const planData = await planResponse.json();

    if (!planData.success || !planData.parsersPlan) {
      throw new Error(`plan-engines API returned invalid response: ${planData.error || 'missing parsersPlan'}`);
    }

    // ✅ Expected format: [{ nodeId: "A", engines: ["regex", "llm"] }, ...]
    const enginePlans: EnginePlan[] = planData.parsersPlan.map((plan: any) => ({
      nodeId: plan.nodeId,
      nodeLabel: allTasks.find(t => t.id === plan.nodeId)?.label || plan.nodeId,
      engines: plan.engines || []
    }));

    if (enginePlans.length === 0) {
      throw new Error('plan-engines API returned empty plan');
    }

    // Build parsers payload from engine plan
    const allEngineTypes = enginePlans.flatMap(p => p.engines);
    const parsersPayload = `Sto generando tutti i parser necessari per estrarre i dati, nell'ordine di escalation appropriato: ${[...new Set(allEngineTypes)].join(', ')}…`;

    console.log('[parsers] Engine plan received', {
      totalNodes: allTasks.length,
      totalEngines: enginePlans.reduce((sum, p) => sum + p.engines.length, 0),
      enginePlans: enginePlans.map(p => ({
        nodeId: p.nodeId,
        nodeLabel: p.nodeLabel,
        enginesCount: p.engines.length,
        engines: p.engines
      }))
    });

    return { enginePlans, parsersPayload };
  } catch (error) {
    // ✅ NO FALLBACK: Fail clearly if plan-engines fails
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[parsers] ❌ plan-engines API failed (NO FALLBACK):', {
      errorMessage,
      errorStack: error instanceof Error ? error.stack : undefined
    });

    throw new Error(`Failed to get engine plan from /api/nlp/plan-engines: ${errorMessage}. The wizard cannot continue without a valid engine plan.`);
  }
}

/**
 * Generates parsers for all engines in parallel
 *
 * @param store - Wizard store instance
 * @param allTasks - All tasks to generate parsers for
 * @param enginePlans - Engine plans from planEngines
 * @param locale - Locale for generation
 * @param counter - Counter object to track progress
 * @param onPhaseComplete - Callback when phase completes or progress updates
 * @param allPhasesCompleteCheck - Function to check if all phases are complete
 */
export async function runParsersGeneration(
  store: WizardStore,
  allTasks: WizardTaskTreeNode[],
  enginePlans: EnginePlan[],
  locale: string,
  counter: ParsersCounter,
  onPhaseComplete?: ParsersProgressCallback,
  allPhasesCompleteCheck?: () => boolean
): Promise<void> {
  // Build flat list of engines (for generation)
  const flatEngineList: Array<{ nodeId: string; nodeLabel: string; engineType: string }> = [];
  enginePlans.forEach(plan => {
    plan.engines.forEach((engineType: string) => {
      flatEngineList.push({
        nodeId: plan.nodeId,
        nodeLabel: plan.nodeLabel,
        engineType
      });
    });
  });

  counter.total = flatEngineList.length;
  store.updatePhaseCounter('parsers', 0, counter.total);

  // Initialize all tasks to pending
  allTasks.forEach(task => {
    store.updateTaskPipelineStatus(task.id, 'parser', 'pending');
  });

  // ✅ FIX 3: Atomic flag to prevent double closure
  let parserPhaseCompleted = false;

  // Generate parser for each engine in parallel
  const { generateParserForEngine } = await import('@utils/wizard/generateEnginesAndParsers');
  const { SemanticContractService } = await import('@services/SemanticContractService');

  const enginePromises = flatEngineList.map(async ({ nodeId, nodeLabel, engineType }) => {
    try {
      const task = allTasks.find(t => t.id === nodeId);
      if (!task) {
        console.warn(`[parsers] Task not found for nodeId: ${nodeId}`);
        return { nodeId, engineType, success: false, error: 'Task not found' };
      }

      // Load or build contract for this node
      let contract = await SemanticContractService.load(nodeId);
      if (!contract) {
        contract = buildContractFromNode(task);
      }

      // ✅ VERIFIED: generateParserForEngine calls /api/nlp/generate-regex (correct endpoint)
      const parser = await generateParserForEngine(
        task,
        engineType as EngineType,
        contract,
        undefined,
        locale // Pass locale for boolean task synonyms
      );

      if (!parser) {
        throw new Error(`Failed to generate ${engineType} parser for node ${nodeId}`);
      }

      // ✅ CRITICAL: Save parser ONLY to template in memory, NOT to store
      // The wizard is an in-memory editor; store is only updated on final save
      const { DialogueTaskService } = await import('@services/DialogueTaskService');
      const template = DialogueTaskService.getTemplate(nodeId);

      if (!template) {
        console.warn(`[parsers] ⚠️ Template not found in memory for node "${nodeLabel}" (${nodeId})`);
        return;
      }

      // Initialize dataContract if it doesn't exist
      if (!template.dataContract) {
        // ✅ CRITICAL: Build subDataMapping from subNodes (structural mapping only)
        // Get subNodes from store.dataSchema (read-only, for structure only)
        const nodeFromStore = store.dataSchema.find(n => n.id === nodeId);
        const subDataMapping: Record<string, { groupName: string }> = {};

        if (nodeFromStore?.subNodes && nodeFromStore.subNodes.length > 0) {
          nodeFromStore.subNodes.forEach((subNode, index) => {
            const groupName = `s${index + 1}`; // Deterministic: s1, s2, s3...
            subDataMapping[subNode.id] = {
              groupName // ✅ Only groupName needed (structural mapping)
            };
          });
        }

        template.dataContract = {
          templateName: nodeLabel || nodeId,
          templateId: nodeId,
          subDataMapping, // ✅ Populated from subNodes
          parsers: [],
          testCases: [] // ✅ NEW: Initialize testCases at contract level
        };
      }

      const existingContracts = template.dataContract.parsers || [];
      const existingTypes = new Set(existingContracts.map((c: any) => c.type));
      const contractType = engineType === 'rule_based' ? 'rules' : engineType;

      if (!existingTypes.has(contractType)) {
        template.dataContract.parsers = [...existingContracts, parser];

        // ✅ Sort parsers by priority to ensure correct escalation order
        // Even if parsers complete in parallel, they must be saved in escalation order
        const enginePriority: Record<string, number> = {
          regex: 1,
          rule_based: 2,
          ner: 3,
          embedding: 4,
          llm: 5
        };

        template.dataContract.parsers.sort((a: any, b: any) => {
          const typeA = a.type === 'rules' ? 'rule_based' : a.type;
          const typeB = b.type === 'rules' ? 'rule_based' : b.type;
          const priorityA = enginePriority[typeA] || 999;
          const priorityB = enginePriority[typeB] || 999;
          return priorityA - priorityB;
        });

        console.log(`[parsers] ✅ Parser saved: ${engineType} for "${nodeLabel}" (${template.dataContract.parsers.map((c: any) => c.type).join(' → ')})`);
      }

      // ✅ FIX 3: Update counter for each ENGINE completed (atomic increment)
      counter.completed++;
      const currentCompleted = counter.completed;
      const currentTotal = counter.total;

      store.updatePhaseCounter('parsers', currentCompleted, currentTotal);

      console.log(`[parsers] ✅ Engine completed: ${engineType} for node "${nodeLabel}" (${nodeId})`, {
        completed: currentCompleted,
        total: currentTotal,
        progress: Math.round((currentCompleted / currentTotal) * 100)
      });

      // ✅ FIX 3: Atomic check for phase completion (prevent double closure)
      if (currentCompleted === currentTotal && !parserPhaseCompleted) {
        parserPhaseCompleted = true; // Set flag atomically

        // Mark all tasks as completed
        allTasks.forEach(task => {
          store.updateTaskPipelineStatus(task.id, 'parser', 'completed');
        });

        // Notify orchestrator that phase is complete (only once)
        onPhaseComplete?.('parser', 'phase-complete-parsers');

        // Check if ALL phases are complete
        if (allPhasesCompleteCheck && allPhasesCompleteCheck()) {
          onPhaseComplete?.('parser', 'all-complete');
        }
      } else {
        // Phase in progress - notify orchestrator of progress
        const progress = Math.round((currentCompleted / currentTotal) * 100);
        onPhaseComplete?.('parser', `${progress}%`);
      }

      return { nodeId, engineType, success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[parsers] ❌ Error generating ${engineType} parser for node "${nodeLabel}" (${nodeId}):`, {
        errorMessage,
        errorStack: error instanceof Error ? error.stack : undefined
      });

      // Don't increment counter on error
      return { nodeId, engineType, success: false, error: errorMessage };
    }
  });

  // Wait for all engines to complete
  await Promise.all(enginePromises);
}
