// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Wizard Actions (Pure Functions)
 *
 * All generation logic as pure functions that update the store directly.
 * No hooks, no closures, no race conditions.
 */

import type { WizardStore } from '../store/wizardStore';
import type { WizardTaskTreeNode, WizardStepMessages } from '../types';
import { generateStructure, generateConstraints, generateParsers, generateMessages } from '../api/wizardApi';
import { buildContractFromNode } from '../api/wizardApi';
import { WizardMode } from '../types/WizardMode';

/**
 * Flattens task tree to get all nodes (root + subNodes)
 */
function flattenTaskTree(nodes: WizardTaskTreeNode[]): WizardTaskTreeNode[] {
  const result: WizardTaskTreeNode[] = [];
  nodes.forEach(node => {
    result.push(node);
    if (node.subNodes && node.subNodes.length > 0) {
      result.push(...flattenTaskTree(node.subNodes));
    }
  });
  return result;
}

/**
 * Phase 1: Generate structure
 */
export async function runStructureGeneration(
  store: WizardStore,
  taskLabel: string,
  rowId: string | undefined,
  locale: string
): Promise<void> {
  store.updatePipelineStep('structure', 'running', 'sto pensando a qual è la migliore struttura dati per questo task...');
  store.setCurrentStep('generazione_struttura');

  const { schema, shouldBeGeneral, generalizedLabel, generalizationReason, generalizedMessages } =
    await generateStructure(taskLabel, rowId, locale);

  // Update store with structure
  store.setDataSchema(schema);
  store.setShouldBeGeneral(shouldBeGeneral);

  // Update root node with generalization data if needed
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

  store.updatePipelineStep('structure', 'running', 'Confermami la struttura che vedi sulla sinistra...');
  store.setWizardMode(WizardMode.DATA_STRUCTURE_PROPOSED);
}

/**
 * Phase 2: Generate constraints, parsers, and messages in parallel
 */
export async function runParallelGeneration(
  store: WizardStore,
  locale: string,
  onPhaseComplete?: (phase: 'constraints' | 'parser' | 'messages', taskId: string) => void
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

  // Update pipeline steps to running
  store.updatePipelineStep('constraints', 'running', constraintsPayload);
  store.updatePipelineStep('parsers', 'running', parsersPayload);
  store.updatePipelineStep('messages', 'running', messagesPayload);
  store.setWizardMode(WizardMode.GENERATING);

  // Update progress function
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
      // Phase completed
      store.updatePipelineStep(phaseId, 'completed', 'Generati!');

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
      const baseMessage = initialPayload.replace(/…$/, '');
      store.updatePipelineStep(phaseId, 'running', `${baseMessage} ${progress}%`);
    }
  };

  // Launch all phases in parallel
  const allPromises: Promise<void>[] = [];

  // Constraints
  allTasks.forEach(task => {
    allPromises.push(
      generateConstraints([task], undefined, locale)
        .then(constraints => {
          // Update task with constraints
          store.setDataSchema(prev => {
            const updateNode = (nodes: WizardTaskTreeNode[]): WizardTaskTreeNode[] => {
              return nodes.map(node => {
                if (node.id === task.id) {
                  return { ...node, constraints };
                }
                if (node.subNodes && node.subNodes.length > 0) {
                  return { ...node, subNodes: updateNode(node.subNodes) };
                }
                return node;
              });
            };
            return updateNode(prev);
          });
          store.updateTaskPipelineStatus(task.id, 'constraints', 'completed');
          updatePhaseProgress('constraints');
          onPhaseComplete?.('constraints', task.id);
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
                  return { ...node, dataContract: nlpContract };
                }
                if (node.subNodes && node.subNodes.length > 0) {
                  return { ...node, subNodes: updateNode(node.subNodes) };
                }
                return node;
              });
            };
            return updateNode(prev);
          });
          store.updateTaskPipelineStatus(task.id, 'parser', 'completed');
          updatePhaseProgress('parser');
          onPhaseComplete?.('parser', task.id);
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
          updatePhaseProgress('messages');
          onPhaseComplete?.('messages', task.id);
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
 */
export function checkCompletion(store: WizardStore): {
  isComplete: boolean;
  allNodesHaveMessages: boolean;
  allNodesHaveConstraints: boolean;
  allNodesHaveParser: boolean;
  allTasksCompletedAllPhases: boolean;
  hasFailedNodes: boolean;
} {
  const allNodes = flattenTaskTree(store.dataSchema);
  const messagesToUse = store.getMessagesToUse();

  const nodesWithMessages = allNodes.filter(node => messagesToUse.has(node.id));
  const allNodesHaveMessages = nodesWithMessages.length === allNodes.length;

  const allNodesHaveConstraints = allNodes.every(node =>
    node.constraints && node.constraints.length > 0
  );

  const allNodesHaveParser = allNodes.every(node =>
    node.dataContract !== undefined
  );

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
                    store.wizardMode === WizardMode.GENERATING;

  return {
    isComplete,
    allNodesHaveMessages,
    allNodesHaveConstraints,
    allNodesHaveParser,
    allTasksCompletedAllPhases,
    hasFailedNodes
  };
}
