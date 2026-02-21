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
import { generateStructure, generateConstraints, generateParsers, generateMessages } from '../api/wizardApi';
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
  const parserCounter = { completed: 0, total: numeroNodi };
  const messagesCounter = { completed: 0, total: numeroNodi };

  // Build dynamic payloads
  const constraintsPayload = `Sto generando i constraints per: ${allTasks.map(n => n.label).join(', ')}…`;

  let parsersPayload = 'Sto generando tutti i parser necessari per estrarre i dati, nell\'ordine di escalation appropriato: …';
  try {
    const rootNode = taskTree[0];
    if (rootNode) {
      const contract = buildContractFromNode(rootNode);
      const provider = localStorage.getItem('omnia.aiProvider') || 'openai';
      const model = localStorage.getItem('omnia.aiModel') || undefined;

      const planResponse = await fetch('/api/nlp/plan-engines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contract, nodeLabel: rootNode.label, locale, provider, model })
      });

      if (planResponse.ok) {
        const planData = await planResponse.json();
        if (planData.success && planData.parsersPlan) {
          const enabledParsers = planData.parsersPlan
            .filter((p: any) => p.enabled)
            .map((p: any) => p.type)
            .join(', ');
          parsersPayload = `Sto generando tutti i parser necessari per estrarre i dati, nell'ordine di escalation appropriato: ${enabledParsers}…`;
        }
      }
    }
  } catch (error) {
    console.warn('[wizardActions] Failed to get parsers plan, using default payload:', error);
  }

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
  const updatePhaseProgress = (phase: 'constraints' | 'parser' | 'messages') => {
    const counter = phase === 'constraints' ? constraintsCounter
                  : phase === 'parser' ? parserCounter
                  : messagesCounter;

    counter.completed++;
    const progress = Math.round((counter.completed / counter.total) * 100);

    const phaseId = phase === 'constraints' ? 'constraints'
                  : phase === 'parser' ? 'parsers'
                  : 'messages';

    const initialPayload = phase === 'constraints' ? constraintsPayload
                         : phase === 'parser' ? parsersPayload
                         : messagesPayload;

    if (counter.completed === counter.total) {
      // Phase completed (all tasks in this phase are done)
      // ❌ REMOVED: store.updatePipelineStep() - orchestrator controls this
      // ✅ Notify orchestrator that phase is complete
      onPhaseComplete?.(phase, `phase-complete-${phaseId}`);

      // Check if ALL phases are complete
      const allPhasesComplete =
        constraintsCounter.completed === constraintsCounter.total &&
        parserCounter.completed === parserCounter.total &&
        messagesCounter.completed === messagesCounter.total;

      if (allPhasesComplete) {
        // Call onPhaseComplete with special flag to indicate all phases are done
        onPhaseComplete?.('messages', 'all-complete');
      }
    } else {
      // Phase in progress
      // ❌ REMOVED: store.updatePipelineStep() - orchestrator controls this
      // ✅ Notify orchestrator of progress via callback
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
                  console.log(`[wizardActions] ✅ Saved constraints for "${task.label}" (${task.id}):`, constraints.length, 'constraints');
                  console.log(`[wizardActions] 🔍 Verifying update - node after update:`, {
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
            console.log(`[wizardActions] 🔍 After setDataSchema (constraints) - node in result:`, {
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
          console.error(`[wizardActions] Error generating constraints for ${task.id}:`, error);
          store.updateTaskPipelineStatus(task.id, 'constraints', 'failed');
          // Don't increment counter on error
        })
    );
  });

  // Parsers
  allTasks.forEach(task => {
    allPromises.push(
      generateParsers([task], undefined, locale)
        .then(nlpContract => {
          // Update task with parser
          store.setDataSchema(prev => {
            const updateNode = (nodes: WizardTaskTreeNode[]): WizardTaskTreeNode[] => {
              return nodes.map(node => {
                if (node.id === task.id) {
                  const updated = { ...node, dataContract: nlpContract };
                  console.log(`[wizardActions] ✅ Saved parser for "${task.label}" (${task.id}):`, nlpContract ? 'has contract' : 'no contract');
                  console.log(`[wizardActions] 🔍 Verifying parser update - node after update:`, {
                    nodeId: updated.id,
                    hasDataContract: !!updated.dataContract,
                    dataContractType: typeof updated.dataContract
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

            // ✅ DEBUG: Verify the updated node is in the result
            const updatedNode = flattenTaskTree(result).find(n => n.id === task.id);
            if (!updatedNode) {
              console.warn(`[wizardActions] ⚠️ Node not found after parser update:`, {
                taskId: task.id,
                taskLabel: task.label,
                allNodeIds: flattenTaskTree(result).map(n => n.id)
              });
            }

            return result;
          });
          store.updateTaskPipelineStatus(task.id, 'parser', 'completed');
          // ✅ updatePhaseProgress already calls onPhaseComplete
          updatePhaseProgress('parser');
        })
        .catch((error) => {
          console.error(`[wizardActions] Error generating parsers for ${task.id}:`, error);
          store.updateTaskPipelineStatus(task.id, 'parser', 'failed');
          // Don't increment counter on error
        })
    );
  });

  // Messages
  allTasks.forEach(task => {
    allPromises.push(
      generateMessages([task], locale)
        .then(messages => {
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

          store.updateTaskPipelineStatus(task.id, 'messages', 'completed');
          // ✅ updatePhaseProgress already calls onPhaseComplete
          updatePhaseProgress('messages');
        })
        .catch((error) => {
          console.error(`[wizardActions] Error generating messages for ${task.id}:`, error);
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
