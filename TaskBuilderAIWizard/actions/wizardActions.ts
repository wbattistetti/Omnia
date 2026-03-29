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
import type { TaskTree } from '@types/taskTypes';
import {
  commitWizardStructureToEditor,
  getWizardStructureSnapshot,
} from '@utils/wizard/wizardStructureFromTaskTree';
import { generateStructure } from '../api/wizardApi';
import { WizardMode } from '../types/WizardMode';
import { flattenTaskTree } from '../utils/wizardHelpers';
import { runConstraintsGeneration, type ConstraintsCounter, type ConstraintsProgressCallback } from './constraints';
import { planEngines, runParsersGeneration, type ParsersCounter, type ParsersProgressCallback } from './parsers';
import { runMessagesGeneration, type MessagesCounter, type MessagesProgressCallback } from './messages';

/**
 * Phase 1: Generate structure
 */
export async function runStructureGeneration(
  store: WizardStore,
  taskLabel: string,
  rowId: string | undefined,
  locale: string,
  structureCommit?: {
    replaceSelectedTaskTree?: (taskTree: TaskTree) => void;
    taskLabelForTree?: string;
  }
): Promise<void> {
  // ✅ POINT OF NO RETURN: If structure is already confirmed, don't regenerate
  const state = useWizardStore.getState();
  const isConfirmed = state.structureConfirmed === true;

  if (isConfirmed) {
    console.warn('[wizardActions] ⚠️ runStructureGeneration called after structure confirmation - blocked');
    return;
  }

  store.setCurrentStep('generazione_struttura');

  const { schema, shouldBeGeneral, generalizedLabel, generalizationReason, generalizedMessages } =
    await generateStructure(taskLabel, rowId, locale);

  let roots: WizardTaskTreeNode[] = [...schema];
  store.setShouldBeGeneral(shouldBeGeneral);

  if (shouldBeGeneral && roots.length > 0 && roots[0]) {
    roots = roots.map((n, i) =>
      i === 0
        ? {
            ...n,
            generalizedLabel: generalizedLabel || null,
            generalizationReason: generalizationReason || null,
            generalizedMessages: generalizedMessages || null,
          }
        : n
    );
  }

  commitWizardStructureToEditor(roots, {
    taskLabel: structureCommit?.taskLabelForTree ?? taskLabel,
    replaceSelectedTaskTree: structureCommit?.replaceSelectedTaskTree,
  });

  console.log(`[wizardActions] ✅ Structure generated: ${roots.length} nodes (TaskTree Zustand)`);
}

/**
 * Phase 2: Generate constraints, parsers, and messages in parallel
 */
export async function runParallelGeneration(
  store: WizardStore,
  locale: string,
  onPhaseComplete?: (phase: 'constraints' | 'parser' | 'messages', taskId: string, payloads?: { constraints: string; parsers: string; messages: string }) => void
): Promise<void> {
  const structureRoots = getWizardStructureSnapshot();
  const allTasks = flattenTaskTree(structureRoots);

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

  // ✅ REFACTOR: Use centralized parsers module for engine planning
  const { enginePlans, parsersPayload } = await planEngines(allTasks, locale);

  // Update parser counter with correct denominator (from engine plans)
  const totalEngines = enginePlans.reduce((sum, p) => sum + p.engines.length, 0);
  parserCounter.total = totalEngines;
  store.updatePhaseCounter('parsers', 0, totalEngines);

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

  // ✅ Pass payloads to orchestrator via callback
  onPhaseComplete?.('constraints', 'init', {
    constraints: constraintsPayload,
    parsers: parsersPayload,
    messages: messagesPayload
  });

  // ✅ REFACTOR: Helper function to check if all phases are complete
  // This function reads from the store to get the latest counter values
  const allPhasesCompleteCheck = (): boolean => {
    const state = useWizardStore.getState();
    const counters = state.phaseCounters;
    return counters.constraints.completed === counters.constraints.total &&
           counters.parsers.completed === counters.parsers.total &&
           counters.messages.completed === counters.messages.total;
  };

  // ✅ REFACTOR: Use centralized modules for each phase
  // Wrapper callbacks to adapt to the unified onPhaseComplete signature
  const constraintsCallback: ConstraintsProgressCallback = (phase, taskId) => {
    if (taskId === 'phase-complete-constraints') {
      onPhaseComplete?.('constraints', 'phase-complete-constraints');
      if (allPhasesCompleteCheck()) {
        onPhaseComplete?.('messages', 'all-complete');
      }
    } else {
      onPhaseComplete?.('constraints', taskId);
    }
  };

  const parsersCallback: ParsersProgressCallback = (phase, taskId) => {
    if (taskId === 'phase-complete-parsers') {
      onPhaseComplete?.('parser', 'phase-complete-parsers');
      if (allPhasesCompleteCheck()) {
        onPhaseComplete?.('messages', 'all-complete');
      }
    } else if (taskId === 'all-complete') {
      onPhaseComplete?.('messages', 'all-complete');
    } else {
      onPhaseComplete?.('parser', taskId);
    }
  };

  const messagesCallback: MessagesProgressCallback = (phase, taskId) => {
    if (taskId === 'phase-complete-messages') {
      onPhaseComplete?.('messages', 'phase-complete-messages');
      if (allPhasesCompleteCheck()) {
        onPhaseComplete?.('messages', 'all-complete');
      }
    } else if (taskId === 'all-complete') {
      onPhaseComplete?.('messages', 'all-complete');
    } else {
      onPhaseComplete?.('messages', taskId);
    }
  };

  // Launch all phases in parallel
  const allPromises: Promise<void>[] = [];

  // ✅ REFACTOR: Use centralized constraints module
  allPromises.push(
    runConstraintsGeneration(store, allTasks, locale, constraintsCounter, constraintsCallback)
  );

  // ✅ REFACTOR: Use centralized parsers module
  allPromises.push(
    runParsersGeneration(
      store,
      allTasks,
      enginePlans,
      locale,
      parserCounter,
      parsersCallback,
      allPhasesCompleteCheck
    )
  );

  // ✅ REFACTOR: Use centralized messages module
  allPromises.push(
    runMessagesGeneration(
      store,
      allTasks,
      locale,
      messagesCounter,
      messagesCallback,
      allPhasesCompleteCheck
    )
  );

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
  const allNodes = flattenTaskTree(getWizardStructureSnapshot());
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
    currentState.wizardState === WizardMode.GENERATING; // ✅ RINOMINATO: wizardMode → wizardState

  return {
    isComplete,
    allNodesHaveMessages,
    allNodesHaveConstraints,
    allNodesHaveParser,
    allTasksCompletedAllPhases,
    hasFailedNodes
  };
}
