// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useCallback, useRef, useMemo } from 'react';
import type { WizardTaskTreeNode } from '../types';
import { WizardMode } from '../types/WizardMode';
import { useProjectTranslations } from '@context/ProjectTranslationsContext';
import { flattenTaskTree } from '../utils/wizardHelpers';
import {
  createTemplateAndInstanceForProposed as createTemplateAndInstanceForProposedService,
  createTemplateAndInstanceForCompleted as createTemplateAndInstanceForCompletedService,
  buildTaskTreeWithContractsAndEngines
} from '../services/WizardCompletionService';

type UseWizardCompletionProps = {
  wizardMode: WizardMode;
  dataSchema: WizardTaskTreeNode[];
  messages: Map<string, any>;
  messagesGeneralized: Map<string, any>;
  messagesContextualized: Map<string, any>;
  shouldBeGeneral: boolean;
  taskLabel?: string;
  rowId?: string; // ✅ ALWAYS equals row.id (which equals task.id when task exists)
  projectId?: string;
  transitionToCompleted: () => void;
  onTaskBuilderComplete?: (taskTree: any) => void;
  adaptAllNormalSteps?: boolean; // ✅ NEW: If true, contextualize all nodes; if false, only root node (default: false)
  // ✅ NEW: Callback to signal that template + instance are ready (for DATA_STRUCTURE_PROPOSED)
  onFirstStepComplete?: () => void;
};

/**
 * Hook che gestisce SOLO il completamento (creazione template/istanza).
 * Nessuna pipeline, nessuna generazione struttura, nessuna sincronizzazione variabili.
 */
export function useWizardCompletion(props: UseWizardCompletionProps) {
  const {
    wizardMode,
    dataSchema,
    messages,
    messagesGeneralized,
    messagesContextualized,
    shouldBeGeneral,
    taskLabel,
    rowId, // ✅ ALWAYS equals row.id (which equals task.id when task exists)
    projectId,
    transitionToCompleted,
    onTaskBuilderComplete,
    adaptAllNormalSteps = false, // ✅ NEW: Default false for backward compatibility
    onFirstStepComplete, // ✅ NEW: Callback to signal first step is complete
  } = props;

  // ✅ FASE 1.2: Get addTranslation from context (must be at top level, not in callback)
  let addTranslation: ((guid: string, text: string) => void) | undefined;
  try {
    const { addTranslation: addTranslationFromContext } = useProjectTranslations();
    addTranslation = addTranslationFromContext;
  } catch {
    // Context not available, will use fallback in TemplateCreationService
    addTranslation = undefined;
  }

  // ✅ CRITICAL: Separate refs for two distinct phases
  // - hasCreatedTemplateForProposedRef: for DATA_STRUCTURE_PROPOSED (first step)
  // - hasCreatedTemplateForCompletedRef: for completion (when all steps are done)
  const hasCreatedTemplateForProposedRef = useRef(false);
  const hasCreatedTemplateForCompletedRef = useRef(false);

  // ✅ MODELLO DETERMINISTICO: Ref per esporre checkAndComplete a useWizardGeneration
  const checkAndCompleteRef = useRef<((dataSchema: WizardTaskTreeNode[]) => Promise<void>) | null>(null);

  /**
   * ✅ NEW: Crea template e istanza per il PRIMO STEP (quando dataSchema è pronto)
   * Questa funzione viene chiamata PRIMA di emettere DATA_STRUCTURE_PROPOSED
   * Dopo aver creato template + istanza, chiama buildTaskTree e onTaskBuilderComplete
   * Solo dopo questi passaggi, chiama onFirstStepComplete per segnalare che è pronto
   */
  const createTemplateAndInstanceForProposed = useCallback(async () => {
    // ✅ Solo quando dataSchema è disponibile e non è già stato creato
    if (dataSchema.length === 0 || hasCreatedTemplateForProposedRef.current) {
      // ✅ Se dataSchema è vuoto, chiama comunque onFirstStepComplete() per emettere DATA_STRUCTURE_PROPOSED
      if (dataSchema.length === 0 && onFirstStepComplete) {
        onFirstStepComplete();
      }
      return;
    }

    // ✅ Verifica che rowId sia disponibile (necessario per creare l'istanza)
    if (!rowId || !projectId) {
      console.warn('[useWizardCompletion] ⚠️ Cannot create template+instance for proposed: rowId and projectId are required');
      // ✅ CRITICAL: Chiama comunque onFirstStepComplete() per emettere DATA_STRUCTURE_PROPOSED
      if (onFirstStepComplete) {
        onFirstStepComplete();
      }
      return;
    }

    hasCreatedTemplateForProposedRef.current = true;

    try {
      console.log('[useWizardCompletion] 🚀 FIRST STEP: Creating template + instance for proposed structure', {
        dataSchemaLength: dataSchema.length,
        rowId,
        projectId
      });

      // ✅ Use service function
      const { taskInstance, taskTree } = await createTemplateAndInstanceForProposedService(
        dataSchema,
        messages,
        messagesGeneralized,
        messagesContextualized,
        shouldBeGeneral,
        taskLabel || 'Task',
        rowId,
        projectId,
        addTranslation,
        adaptAllNormalSteps
      );

      console.log('[useWizardCompletion] ✅ FIRST STEP: Template + instance created', {
        taskId: taskInstance?.id,
        hasTaskTree: !!taskTree
      });

      // Call onTaskBuilderComplete if taskTree was built
      if (taskTree && onTaskBuilderComplete) {
        console.log('[useWizardCompletion] ✅ FIRST STEP: TaskTree built, calling onTaskBuilderComplete', {
          taskTreeNodesCount: taskTree.nodes?.length || 0,
          taskTreeId: taskTree.id
        });
        onTaskBuilderComplete(taskTree);
      }

      // Signal that first step is complete
      if (onFirstStepComplete) {
        console.log('[useWizardCompletion] ✅ FIRST STEP: Complete - signaling onFirstStepComplete');
        onFirstStepComplete();
      }
    } catch (error) {
      // ✅ Tollerante: logga errore ma non blocca il flusso
      console.error('[useWizardCompletion] ❌ FIRST STEP: Error (non-blocking)', {
        error: error instanceof Error ? error.message : String(error)
      });
      // ✅ CRITICAL: Chiama comunque onFirstStepComplete() per emettere DATA_STRUCTURE_PROPOSED
      if (onFirstStepComplete) {
        onFirstStepComplete();
      }
      // ✅ Reset ref per permettere retry
      hasCreatedTemplateForProposedRef.current = false;
    }
  }, [
    dataSchema,
    messages,
    messagesGeneralized,
    messagesContextualized,
    shouldBeGeneral,
    taskLabel,
    rowId,
    projectId,
    addTranslation,
    adaptAllNormalSteps,
    onTaskBuilderComplete,
    onFirstStepComplete
  ]);

  /**
   * Crea template e istanza quando il wizard è completato
   * ✅ CRITICAL: Called from checkAndComplete BEFORE transitionToCompleted
   * Uses separate guard (hasCreatedTemplateForCompletedRef) to avoid conflict with first step
   */
  const createTemplateAndInstanceForCompleted = useCallback(async () => {
    // ✅ Guard: check wizardMode, dataSchema, and separate completion ref
    if (wizardMode !== WizardMode.GENERATING || dataSchema.length === 0 || hasCreatedTemplateForCompletedRef.current) {
      console.log('[useWizardCompletion] ⚠️ createTemplateAndInstanceForCompleted - Guard failed', {
        wizardMode,
        wizardModeEqualsGenerating: wizardMode === WizardMode.GENERATING,
        dataSchemaLength: dataSchema.length,
        hasCreatedTemplateForCompleted: hasCreatedTemplateForCompletedRef.current
      });
      return;
    }

    if (!rowId || !projectId) {
      console.error('[useWizardCompletion] ❌ rowId and projectId are required');
      hasCreatedTemplateForCompletedRef.current = false;
      return;
    }

    hasCreatedTemplateForCompletedRef.current = true;
    console.log('[useWizardCompletion] ✅ createTemplateAndInstanceForCompleted - Guard passed, proceeding');

    try {
      // ✅ Use service function
      const taskInstance = await createTemplateAndInstanceForCompletedService(
        dataSchema,
        messages,
        messagesGeneralized,
        messagesContextualized,
        shouldBeGeneral,
        taskLabel || 'Task',
        rowId,
        projectId,
        addTranslation,
        adaptAllNormalSteps
      );

      console.log('[useWizardCompletion] ✅ Template + instance created for completed wizard', {
        taskId: taskInstance?.id,
        templateId: taskInstance?.templateId
      });

      // Build TaskTree and generate parsers/engines
      try {
        const taskTree = await buildTaskTreeWithContractsAndEngines(taskInstance, projectId, dataSchema);

        if (taskTree && onTaskBuilderComplete) {
          console.log('[useWizardCompletion] ✅ TaskTree built successfully, calling onTaskBuilderComplete', {
            taskTreeNodesCount: taskTree.nodes?.length || 0,
            taskTreeStepsCount: taskTree.steps ? Object.keys(taskTree.steps).length : 0
          });
          onTaskBuilderComplete(taskTree);
        }
      } catch (error) {
        // Non-blocking: log error but don't block wizard flow
        console.warn('[useWizardCompletion] ⚠️ Error building TaskTree (non-blocking)', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    } catch (error) {
      // ✅ CRITICAL: Log error to diagnose why buildTaskTree is not called
      console.error('[useWizardCompletion] ❌ Error in createTemplateAndInstanceForCompleted', {
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        wizardMode,
        dataSchemaLength: dataSchema.length,
        hasRowId: !!rowId,
        hasProjectId: !!projectId
      });
      // ✅ Reset ref to allow retry
      hasCreatedTemplateForCompletedRef.current = false;
    }
  }, [
    wizardMode,
    dataSchema,
    messages,
    messagesGeneralized,
    messagesContextualized,
    shouldBeGeneral,
    taskLabel,
    rowId,
    projectId,
    addTranslation,
    onTaskBuilderComplete,
    adaptAllNormalSteps,
  ]);

  /**
   * Verifica se tutti gli step sono completati e transiziona a COMPLETED
   * ✅ D1: Verifica che tutti i nodi abbiano messaggi e non ci siano nodi falliti
   *
   * ✅ CRITICAL: createTemplateAndInstanceForCompleted must be called BEFORE transitionToCompleted
   * This ensures taskTree is in store before wizardMode becomes COMPLETED
   */
  /**
   * ✅ MODELLO DETERMINISTICO: checkAndComplete chiamato SOLO quando i contatori sono completi
   * Non dipende più da pipelineSteps o wizardMode (i contatori sono la fonte di verità)
   * Chiamato direttamente da updatePhaseProgress in useWizardGeneration
   * Legge direttamente da messages/messagesGeneralized (props), non da parametro
   */
  const checkAndComplete = useCallback(async (
    dataSchemaToCheck: WizardTaskTreeNode[]
  ) => {
    // ✅ Legge direttamente dalle props (sempre aggiornate, non da closure)
    const messagesToUse = messagesGeneralized.size > 0 ? messagesGeneralized : messages;

    // ✅ Verifica integrità dati (non più pipelineSteps o wizardMode)
    const allNodes = flattenTaskTree(dataSchemaToCheck);
    const nodesWithMessages = allNodes.filter(node => messagesToUse.has(node.id));
    const allNodesHaveMessages = nodesWithMessages.length === allNodes.length;

    // ✅ Verifica che tutti i nodi abbiano constraints
    const allNodesHaveConstraints = allNodes.every(node =>
      node.constraints && node.constraints.length > 0
    );

    // ✅ Verifica che tutti i nodi abbiano parser
    const allNodesHaveParser = allNodes.every(node =>
      node.dataContract !== undefined
    );

    // ✅ Verifica che non ci siano nodi falliti
    const hasFailedNodes = allNodes.some(node =>
      node.pipelineStatus?.constraints === 'failed' ||
      node.pipelineStatus?.parser === 'failed' ||
      node.pipelineStatus?.messages === 'failed'
    );

    // ✅ CRITICAL: Verifica che TUTTI i task abbiano completato TUTTE le fasi
    const allTasksCompletedAllPhases = allNodes.every(node => {
      const constraintsState = node.pipelineStatus?.constraints || 'pending';
      const parserState = node.pipelineStatus?.parser || 'pending';
      const messagesState = node.pipelineStatus?.messages || 'pending';
      return constraintsState === 'completed' &&
             parserState === 'completed' &&
             messagesState === 'completed';
    });

    // ✅ Transiziona solo se TUTTE le condizioni sono soddisfatte
    // Nota: wizardMode è già GENERATING quando siamo qui (chiamato da continueAfterStructureConfirmation)
    if (
      allNodesHaveMessages &&
      allNodesHaveConstraints &&
      allNodesHaveParser &&
      allTasksCompletedAllPhases &&
      !hasFailedNodes &&
      wizardMode === WizardMode.GENERATING
    ) {
      console.log('[useWizardCompletion] 🚀 All conditions met - creating template + instance BEFORE transition to COMPLETED');
      await createTemplateAndInstanceForCompleted();

      // ✅ DEBUG: Log finale - verifica stato contratti per tutti i nodi
      const allNodesFinal = flattenTaskTree(dataSchema);
      console.log(`[useWizardCompletion] 📊 FINAL STATE - Wizard completed, checking parsers for all nodes`, {
        totalNodes: allNodesFinal.length,
        nodesWithDataContract: allNodesFinal.filter(n => !!n.dataContract).length,
        nodesWithContracts: allNodesFinal.filter(n => n.dataContract?.parsers && n.dataContract.parsers.length > 0).length,
        nodesDetails: allNodesFinal.map(n => ({
          nodeId: n.id,
          nodeLabel: n.label,
          hasDataContract: !!n.dataContract,
          parsersCount: n.dataContract?.parsers?.length || 0,
          contractTypes: n.dataContract?.parsers?.map((c: any) => c.type) || []
        }))
      });

      // ✅ DEBUG: Verifica anche nei template registrati in memoria
      const { default: DialogueTaskService } = await import('@services/DialogueTaskService');
      allNodesFinal.forEach(node => {
        const template = DialogueTaskService.getTemplate(node.id);
        if (template) {
          console.log(`[useWizardCompletion] 📋 Template in memory for node "${node.label}" (${node.id})`, {
            templateId: template.id,
            templateLabel: template.label,
            hasDataContract: !!template.dataContract,
            parsersCount: template.dataContract?.parsers?.length || 0,
            contractTypes: template.dataContract?.parsers?.map((c: any) => c.type) || []
          });
        } else {
          console.log(`[useWizardCompletion] ⚠️ Template NOT FOUND in memory for node "${node.label}" (${node.id})`);
        }
      });

      console.log('[useWizardCompletion] ✅ Template + instance created - now transitioning to COMPLETED');
      transitionToCompleted();
    } else if (hasFailedNodes) {
      console.log('[useWizardCompletion] ⚠️ Some nodes failed - user can retry manually');
    } else if (!allNodesHaveMessages) {
      console.log('[useWizardCompletion] ⏳ Waiting for all nodes to have messages', {
        totalNodes: allNodes.length,
        nodesWithMessages: nodesWithMessages.length
      });
    } else if (!allTasksCompletedAllPhases) {
      console.log('[useWizardCompletion] ⏳ Waiting for all tasks to complete all phases', {
        totalNodes: allNodes.length,
        nodesWithCompletedConstraints: allNodes.filter(n => n.pipelineStatus?.constraints === 'completed').length,
        nodesWithCompletedParser: allNodes.filter(n => n.pipelineStatus?.parser === 'completed').length,
        nodesWithCompletedMessages: allNodes.filter(n => n.pipelineStatus?.messages === 'completed').length,
      });
    }
  }, [wizardMode, transitionToCompleted, createTemplateAndInstanceForCompleted, messages, messagesGeneralized]);

  // ✅ Esponi checkAndComplete tramite ref per useWizardGeneration (modello deterministico)
  checkAndCompleteRef.current = checkAndComplete;

  return {
    createTemplateAndInstanceForCompleted, // ✅ Function for completion (when all steps are done)
    createTemplateAndInstanceForProposed, // ✅ Function for first step (DATA_STRUCTURE_PROPOSED)
    checkAndComplete, // ✅ Mantenuto per backward compatibility (non più usato)
    checkAndCompleteRef, // ✅ NUOVO: Ref stabile per useWizardGeneration
  };
}
