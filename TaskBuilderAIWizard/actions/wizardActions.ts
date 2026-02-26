// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Wizard Actions (Pure Functions)
 *
 * All generation logic as pure functions that update the store directly.
 * No hooks, no closures, no race conditions.
 */

import type { WizardStore } from '../store/wizardStore';
import { useWizardStore } from '../store/wizardStore';
import type { WizardTaskTreeNode, WizardStepMessages } from '../types';
import { generateStructure, generateConstraints, generateMessages } from '../api/wizardApi';
import { buildContractFromNode } from '../api/wizardApi';
import { WizardMode } from '../types/WizardMode';
import { flattenTaskTree } from '../utils/wizardHelpers';

/**
 * Phase 1: Generate structure
 */
export async function runStructureGeneration(
  store: WizardStore,
  taskLabel: string,
  rowId: string | undefined,
  locale: string
): Promise<void> {
  // ✅ POINT OF NO RETURN: If structure is already confirmed, don't regenerate
  const state = useWizardStore.getState();
  const isConfirmed = (state as any as { structureConfirmed: boolean }).structureConfirmed === true;

  if (isConfirmed) {
    console.warn('[wizardActions] ⚠️ runStructureGeneration called after structure confirmation - blocked');
    return;
  }

  // ❌ REMOVED: store.updatePipelineStep() - orchestrator controls this
  // ❌ REMOVED: store.setWizardMode() - orchestrator controls this
  // ✅ ONLY: Generate structure and update dataSchema

  store.setCurrentStep('generazione_struttura');

  const { schema, shouldBeGeneral, generalizedLabel, generalizationReason, generalizedMessages } =
    await generateStructure(taskLabel, rowId, locale);

  // ✅ ONLY update dataSchema
  store.setDataSchema(schema);
  store.setShouldBeGeneral(shouldBeGeneral);

  if (shouldBeGeneral && schema.length > 0) {
    store.setDataSchema(prev => {
      const updated = [...prev];
      if (updated[0]) {
        updated[0] = {
          ...updated[0],
          generalizedLabel: generalizedLabel || null,
          generalizationReason: generalizationReason || null,
          generalizedMessages: generalizedMessages || null
        };
      }
      return updated;
    });
  }

  // ❌ REMOVED: store.updatePipelineStep() - orchestrator controls this
  // ❌ REMOVED: store.setWizardMode() - orchestrator controls this
  // ✅ Function returns - orchestrator handles all pipeline updates
}

/**
 * Phase 2: Generate constraints, parsers, and messages in parallel
 */
export async function runParallelGeneration(
  store: WizardStore,
  locale: string,
  onPhaseComplete?: (phase: 'constraints' | 'parser' | 'messages', taskId: string, payloads?: { constraints: string; parsers: string; messages: string }) => void
): Promise<void> {
  const taskTree = store.dataSchema;
  const allTasks = flattenTaskTree(taskTree);

  // Validate invariants
  const nodesWithMismatch = allTasks.filter(t => t.id !== t.templateId);
  if (nodesWithMismatch.length > 0) {
    throw new Error(
      `[wizardActions] CRITICAL: Found ${nodesWithMismatch.length} nodes with id !== templateId. ` +
      `Mismatched nodes: ${nodesWithMismatch.map(n => `"${n.label}" (id: ${n.id}, templateId: ${n.templateId})`).join(', ')}.`
    );
  }

  const nodeIds = allTasks.map(t => t.id);
  const duplicateIds = nodeIds.filter((id, index) => nodeIds.indexOf(id) !== index);
  if (duplicateIds.length > 0) {
    throw new Error(
      `[wizardActions] CRITICAL: Found duplicate node IDs: ${[...new Set(duplicateIds)].join(', ')}.`
    );
  }

  // Initialize all tasks to pending
  allTasks.forEach(task => {
    store.updateTaskPipelineStatus(task.id, 'constraints', 'pending');
    store.updateTaskPipelineStatus(task.id, 'parser', 'pending');
    store.updateTaskPipelineStatus(task.id, 'messages', 'pending');
  });

  // Initialize counters
  const numeroNodi = allTasks.length;
  const constraintsCounter = { completed: 0, total: numeroNodi };
  const parserCounter = { completed: 0, total: numeroNodi }; // Will be updated after plan-engines
  const messagesCounter = { completed: 0, total: numeroNodi };

  // ✅ FIX 2: Initialize counters in store (source of truth)
  store.updatePhaseCounter('constraints', 0, numeroNodi);
  store.updatePhaseCounter('parsers', 0, numeroNodi); // Will be updated after plan-engines
  store.updatePhaseCounter('messages', 0, numeroNodi);

  // ✅ STEP 1: Call plan-engines FIRST to get engine plan and build correct payload
  const fullContract = {
    nodes: allTasks.map(task => ({
      nodeId: task.id,
      nodeLabel: task.label,
      contract: buildContractFromNode(task)
    }))
  };

  const provider = localStorage.getItem('omnia.aiProvider') || 'openai';
  const model = localStorage.getItem('omnia.aiModel') || undefined;

  let enginePlans: Array<{ nodeId: string; nodeLabel: string; engines: string[] }> = [];
  let parsersPayload = 'Sto generando tutti i parser necessari per estrarre i dati, nell\'ordine di escalation appropriato: …';

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
    enginePlans = planData.parsersPlan.map((plan: any) => ({
      nodeId: plan.nodeId,
      nodeLabel: allTasks.find(t => t.id === plan.nodeId)?.label || plan.nodeId,
      engines: plan.engines || []
    }));

    if (enginePlans.length === 0) {
      throw new Error('plan-engines API returned empty plan');
    }

    // Build flat list to calculate totalEngines
    const flatEngineList: Array<{ nodeId: string; engineType: string }> = [];
    enginePlans.forEach(plan => {
      plan.engines.forEach((engineType: string) => {
        flatEngineList.push({ nodeId: plan.nodeId, engineType });
      });
    });

    const totalEngines = flatEngineList.length;

    // ✅ Update parser counter with correct denominator
    parserCounter.total = totalEngines;
    store.updatePhaseCounter('parsers', 0, totalEngines);

    // Build parsers payload from engine plan
    const allEngineTypes = enginePlans.flatMap(p => p.engines);
    parsersPayload = `Sto generando tutti i parser necessari per estrarre i dati, nell'ordine di escalation appropriato: ${[...new Set(allEngineTypes)].join(', ')}…`;

    console.log('[wizardActions] Engine plan received', {
      totalNodes: allTasks.length,
      totalEngines,
      enginePlans: enginePlans.map(p => ({
        nodeId: p.nodeId,
        nodeLabel: p.nodeLabel,
        enginesCount: p.engines.length,
        engines: p.engines
      }))
    });

  } catch (error) {
    // ✅ NO FALLBACK: Fail clearly if plan-engines fails
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[wizardActions] ❌ plan-engines API failed (NO FALLBACK):', {
      errorMessage,
      errorStack: error instanceof Error ? error.stack : undefined
    });

    // Mark all tasks as failed
    allTasks.forEach(task => {
      store.updateTaskPipelineStatus(task.id, 'parser', 'failed');
    });

    // Throw to stop wizard execution
    throw new Error(`Failed to get engine plan from /api/nlp/plan-engines: ${errorMessage}. The wizard cannot continue without a valid engine plan.`);
  }

  // Build dynamic payloads
  const constraintsPayload = `Sto generando i constraints per: ${allTasks.map(n => n.label).join(', ')}…`;

  const MESSAGE_STEP_LABELS = [
    'Chiedo il dato',
    'Non sento',
    'Non capisco',
    'Devo confermare',
    'Non Confermato',
    'Ho capito!'
  ];
  const messagesPayload = `Sto generando tutti i messaggi che il bot deve utilizzare in tutte le possibili situazioni: ${MESSAGE_STEP_LABELS.map(s => `"${s}"`).join(', ')}…`;

  // ❌ REMOVED: store.updatePipelineStep() - orchestrator controls this
  // ❌ REMOVED: store.setWizardMode() - orchestrator controls this
  // ✅ Pass payloads to orchestrator via callback
  onPhaseComplete?.('constraints', 'init', {
    constraints: constraintsPayload,
    parsers: parsersPayload,
    messages: messagesPayload
  });

  // Update progress function (NO pipeline updates, only counters)
  // ✅ FIX 3: Parser phase handles its own progress (atomic, engine-based)
  // Don't call this for 'parser' phase - it's handled in enginePromises
  const updatePhaseProgress = (phase: 'constraints' | 'parser' | 'messages') => {
    // ✅ FIX 3: Parser phase is handled separately in enginePromises
    if (phase === 'parser') {
      console.warn('[wizardActions] updatePhaseProgress called for parser phase - this should not happen');
      return;
    }

    const counter = phase === 'constraints' ? constraintsCounter
                  : messagesCounter;

    counter.completed++;
    const progress = Math.round((counter.completed / counter.total) * 100);

    const phaseId = phase === 'constraints' ? 'constraints' : 'messages';

    // ✅ FIX 2: Update store counters (source of truth for UI)
    store.updatePhaseCounter(phaseId, counter.completed, counter.total);

    const initialPayload = phase === 'constraints' ? constraintsPayload : messagesPayload;

    if (counter.completed === counter.total) {
      // Phase completed
      onPhaseComplete?.(phase, `phase-complete-${phaseId}`);

      // Check if ALL phases are complete
      const allPhasesComplete =
        constraintsCounter.completed === constraintsCounter.total &&
        parserCounter.completed === parserCounter.total &&
        messagesCounter.completed === messagesCounter.total;

      if (allPhasesComplete) {
        onPhaseComplete?.('messages', 'all-complete');
      }
    } else {
      // Phase in progress
      onPhaseComplete?.(phase, `${progress}%`);
    }
  };

  // Launch all phases in parallel
  const allPromises: Promise<void>[] = [];

  // Constraints
  allTasks.forEach(task => {
    allPromises.push(
      generateConstraints([task], undefined, locale)
        .then(constraints => {
          // Update task with constraints in dataSchema
          store.setDataSchema(prev => {
            const updateNode = (nodes: WizardTaskTreeNode[]): WizardTaskTreeNode[] => {
              return nodes.map(node => {
                if (node.id === task.id) {
                  const updated = { ...node, constraints };
                  console.log(`[wizardActions] Saved constraints for "${task.label}" (${task.id}):`, constraints.length, 'constraints');
                  console.log(`[wizardActions] Verifying update - node after update:`, {
                    nodeId: updated.id,
                    hasConstraints: !!updated.constraints,
                    constraintsLength: updated.constraints?.length || 0
                  });
                  return updated;
                }
                if (node.subNodes && node.subNodes.length > 0) {
                  return { ...node, subNodes: updateNode(node.subNodes) };
                }
                return node;
              });
            };
            const result = updateNode(prev);

            // ✅ DEBUG: Verify the updated node is in the result (constraints)
            const updatedNode = flattenTaskTree(result).find(n => n.id === task.id);
            console.log(`[wizardActions] After setDataSchema (constraints) - node in result:`, {
              nodeId: updatedNode?.id,
              hasConstraints: !!updatedNode?.constraints,
              constraintsLength: updatedNode?.constraints?.length || 0
            });

            return result;
          });

          // Also update global constraints array in store
          store.setConstraints(prev => [...prev, ...constraints]);

          store.updateTaskPipelineStatus(task.id, 'constraints', 'completed');
          // ✅ updatePhaseProgress already calls onPhaseComplete
          updatePhaseProgress('constraints');
        })
        .catch((error) => {
          // ✅ IMPROVED: Better error logging with full details
          const errorMessage = error instanceof Error
            ? error.message
            : typeof error === 'string'
              ? error
              : JSON.stringify(error, null, 2);

          console.error(`[wizardActions] Error generating constraints for "${task.label}" (${task.id}):`, {
            errorMessage,
            errorStack: error instanceof Error ? error.stack : undefined,
            errorType: error?.constructor?.name || typeof error,
            taskId: task.id,
            taskLabel: task.label
          });

          console.error(`[wizardActions] Error details: ${errorMessage}`);

          store.updateTaskPipelineStatus(task.id, 'constraints', 'failed');
          // Don't increment counter on error
        })
    );
  });

  // Parsers
  // ✅ REFACTORED: Engine-based generation (not node-based)
  // ✅ plan-engines already called above, enginePlans and totalEngines already calculated

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

  const totalEngines = flatEngineList.length;

  // ✅ FIX 3: Atomic flag to prevent double closure
  let parserPhaseCompleted = false;

  // 5. Generate parser for each engine in parallel
  const { generateParserForEngine } = await import('@utils/wizard/generateEnginesAndParsers');
  const { SemanticContractService } = await import('@services/SemanticContractService');

  const enginePromises = flatEngineList.map(async ({ nodeId, nodeLabel, engineType }) => {
    try {
      const task = allTasks.find(t => t.id === nodeId);
      if (!task) {
        console.warn(`[wizardActions] Task not found for nodeId: ${nodeId}`);
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
        engineType as any,
        contract,
        undefined
      );

      if (!parser) {
        throw new Error(`Failed to generate ${engineType} parser for node ${nodeId}`);
      }

      // Save parser to node's dataContract
      store.setDataSchema(prev => {
        const updateNode = (nodes: WizardTaskTreeNode[]): WizardTaskTreeNode[] => {
          return nodes.map(node => {
            if (node.id === nodeId) {
              if (!node.dataContract) {
                // ✅ CRITICAL: Build subDataMapping from subNodes (structural mapping only)
                const subDataMapping: Record<string, { groupName: string }> = {};
                if (node.subNodes && node.subNodes.length > 0) {
                  node.subNodes.forEach((subNode, index) => {
                    const groupName = `s${index + 1}`; // Deterministic: s1, s2, s3...
                    subDataMapping[subNode.id] = {
                      groupName // ✅ Only groupName needed (structural mapping)
                    };
                  });
                }

                node.dataContract = {
                  templateName: node.label || nodeId,
                  templateId: nodeId,
                  subDataMapping, // ✅ Populated from subNodes
                  contracts: []
                };
              }

              const existingContracts = node.dataContract.contracts || [];
              const existingTypes = new Set(existingContracts.map((c: any) => c.type));
              const contractType = engineType === 'rule_based' ? 'rules' : engineType;

              if (!existingTypes.has(contractType)) {
                node.dataContract.contracts = [...existingContracts, parser];
              }

              return { ...node };
            }
            if (node.subNodes && node.subNodes.length > 0) {
              return { ...node, subNodes: updateNode(node.subNodes) };
            }
            return node;
          });
        };
        return updateNode(prev);
      });

      // ✅ FIX 3: Update counter for each ENGINE completed (atomic increment)
      parserCounter.completed++;
      const currentCompleted = parserCounter.completed;
      const currentTotal = parserCounter.total;

      store.updatePhaseCounter('parsers', currentCompleted, currentTotal);

      console.log(`[wizardActions] ✅ Engine completed: ${engineType} for node "${nodeLabel}" (${nodeId})`, {
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
        const allPhasesComplete =
          constraintsCounter.completed === constraintsCounter.total &&
          parserCounter.completed === parserCounter.total &&
          messagesCounter.completed === messagesCounter.total;

        if (allPhasesComplete) {
          onPhaseComplete?.('messages', 'all-complete');
        }
      } else {
        // Phase in progress - notify orchestrator of progress
        const progress = Math.round((currentCompleted / currentTotal) * 100);
        onPhaseComplete?.('parser', `${progress}%`);
      }

      return { nodeId, engineType, success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[wizardActions] ❌ Error generating ${engineType} parser for node "${nodeLabel}" (${nodeId}):`, {
        errorMessage,
        errorStack: error instanceof Error ? error.stack : undefined
      });

      // Don't increment counter on error
      return { nodeId, engineType, success: false, error: errorMessage };
    }
  });

  // Add all engine promises to allPromises
  allPromises.push(...enginePromises);

  // ✅ FASE 1: Crea strutture deterministiche per tutti i nodi (senza testi)
  const { createNodeStructure, associateTextsToStructure } = await import('../services/TemplateCreationService');
  const nodeStructures = new Map<string, any>();
  allTasks.forEach(task => {
    const structure = createNodeStructure(task);
    nodeStructures.set(task.id, structure);
  });

  // ✅ FASE 2: Genera messaggi (1 chiamata AI per nodo)
  const { generateAllMessagesForNode } = await import('../api/wizardApi');

  allTasks.forEach(task => {
    const structure = nodeStructures.get(task.id);
    if (!structure) {
      console.error(`[wizardActions] No structure found for task ${task.id}`);
      return;
    }

    allPromises.push(
      generateAllMessagesForNode(task, structure, locale)
        .then(async (messages) => {
          // Save messages BEFORE incrementing counter
          const messagesToUse = store.shouldBeGeneral && store.messagesGeneralized.size > 0
            ? store.messagesGeneralized
            : store.messages;

          // Use appropriate setter based on shouldBeGeneral
          if (store.shouldBeGeneral) {
            store.setMessagesGeneralized(task.id, messages);
          } else {
            store.setMessages(task.id, messages);
          }

          // ✅ Associa testi ai GUID esistenti nella struttura
          // Recupera addTranslation dal window context se disponibile
          const addTranslation = typeof window !== 'undefined' && (window as any).__projectTranslationsContext
            ? (window as any).__projectTranslationsContext.addTranslation
            : undefined;
          associateTextsToStructure(structure, messages, task.id, addTranslation);

          store.updateTaskPipelineStatus(task.id, 'messages', 'completed');
          // ✅ updatePhaseProgress already calls onPhaseComplete
          updatePhaseProgress('messages');
        })
        .catch((error) => {
          // ✅ IMPROVED: Better error logging with full details
          const errorMessage = error instanceof Error
            ? error.message
            : typeof error === 'string'
              ? error
              : JSON.stringify(error, null, 2);

          console.error(`[wizardActions] Error generating messages for "${task.label}" (${task.id}):`, {
            errorMessage,
            errorStack: error instanceof Error ? error.stack : undefined,
            errorType: error?.constructor?.name || typeof error,
            taskId: task.id,
            taskLabel: task.label
          });

          console.error(`[wizardActions] Error details: ${errorMessage}`);

          store.updateTaskPipelineStatus(task.id, 'messages', 'failed');
          // Don't increment counter on error
        })
    );
  });

  // Wait for all promises
  await Promise.allSettled(allPromises);
}

/**
 * Check if all phases are complete and ready for completion
 * ✅ FIX: Read from useWizardStore.getState() to ensure we always read the latest state
 * This makes checkCompletion deterministic and independent of closure variables
 */
export function checkCompletion(): {
  isComplete: boolean;
  allNodesHaveMessages: boolean;
  allNodesHaveConstraints: boolean;
  allNodesHaveParser: boolean;
  allTasksCompletedAllPhases: boolean;
  hasFailedNodes: boolean;
} {
  // ✅ FIX: Get fresh state from store using getState() static method
  const currentState = useWizardStore.getState();
  const allNodes = flattenTaskTree(currentState.dataSchema);
  const messagesToUse = currentState.getMessagesToUse();

  const nodesWithMessages = allNodes.filter(node => messagesToUse.has(node.id));
  const allNodesHaveMessages = nodesWithMessages.length === allNodes.length;

  const allNodesHaveConstraints = allNodes.every(node => {
    const hasConstraints = node.constraints && node.constraints.length > 0;
    if (!hasConstraints) {
      console.log(`[checkCompletion] Node "${node.label}" (${node.id}) missing constraints`, {
        nodeId: node.id,
        nodeLabel: node.label,
        hasConstraints: !!node.constraints,
        constraintsLength: node.constraints?.length || 0,
        allNodesCount: allNodes.length,
        nodeIndex: allNodes.findIndex(n => n.id === node.id)
      });
    }
    return hasConstraints;
  });

  const allNodesHaveParser = allNodes.every(node => {
    const hasParser = node.dataContract !== undefined;
    if (!hasParser) {
      console.log(`[checkCompletion] Node "${node.label}" (${node.id}) missing parser (dataContract)`, {
        nodeId: node.id,
        nodeLabel: node.label,
        hasDataContract: !!node.dataContract,
        dataContractType: typeof node.dataContract,
        allNodesCount: allNodes.length,
        nodeIndex: allNodes.findIndex(n => n.id === node.id)
      });
    }
    return hasParser;
  });

  const hasFailedNodes = allNodes.some(node =>
    node.pipelineStatus?.constraints === 'failed' ||
    node.pipelineStatus?.parser === 'failed' ||
    node.pipelineStatus?.messages === 'failed'
  );

  const allTasksCompletedAllPhases = allNodes.every(node => {
    const constraintsState = node.pipelineStatus?.constraints || 'pending';
    const parserState = node.pipelineStatus?.parser || 'pending';
    const messagesState = node.pipelineStatus?.messages || 'pending';
    return constraintsState === 'completed' &&
           parserState === 'completed' &&
           messagesState === 'completed';
  });

  const isComplete = allNodesHaveMessages &&
                    allNodesHaveConstraints &&
                    allNodesHaveParser &&
                    allTasksCompletedAllPhases &&
                    !hasFailedNodes &&
                    currentState.wizardMode === WizardMode.GENERATING;

  return {
    isComplete,
    allNodesHaveMessages,
    allNodesHaveConstraints,
    allNodesHaveParser,
    allTasksCompletedAllPhases,
    hasFailedNodes
  };
}
