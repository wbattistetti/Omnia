// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Wizard Orchestrator
 *
 * SINGLE SOURCE OF TRUTH for all wizard operations.
 *
 * Rules:
 * - ONLY this file can call setWizardMode
 * - ONLY this file can call updatePipelineStep
 * - ONLY this file can start/stop generation
 * - ONLY this file can open/close TaskTree
 * - NO side effects outside this file
 * - NO direct store access from components
 */

import { useWizardStore } from '../store/wizardStore';
import { runStructureGeneration, runParallelGeneration, checkCompletion } from '../actions/wizardActions';
import { WizardMode } from '../types/WizardMode';
import {
  createTemplateAndInstanceForProposed,
  createTemplateAndInstanceForCompleted,
  buildTaskTreeWithContractsAndEngines
} from '../services/WizardCompletionService';
import { flattenTaskTree } from '../utils/wizardHelpers';
import type { WizardTaskTreeNode } from '../types';

export interface WizardOrchestratorConfig {
  taskLabel: string;
  rowId?: string;
  projectId?: string;
  locale?: string;
  onTaskBuilderComplete?: (taskTree: any) => void;
  addTranslation?: (guid: string, text: string) => void;
}

/**
 * Wizard Orchestrator Class
 *
 * Controls ALL wizard operations. No other code should modify wizard state.
 */
export class WizardOrchestrator {
  private config: WizardOrchestratorConfig;
  private hasStarted = false;

  constructor(config: WizardOrchestratorConfig) {
    this.config = config;
  }

  /**
   * Get current store state (read-only)
   */
  private getStore() {
    return useWizardStore.getState();
  }

  /**
   * Start wizard generation
   * ONLY entry point for starting the wizard
   */
  async start(): Promise<void> {
    if (this.hasStarted) {
      console.warn('[WizardOrchestrator] ⚠️ start() called multiple times - ignored');
      return;
    }

    if (!this.config.taskLabel?.trim()) {
      throw new Error('[WizardOrchestrator] taskLabel is required');
    }

    this.hasStarted = true;
    const store = this.getStore();

    // ✅ ORCHESTRATOR controls ALL pipeline updates
    store.reset();
    store.setCurrentStep('generazione_struttura');
    store.updatePipelineStep('structure', 'running', 'sto pensando a qual è la migliore struttura dati per questo task...');

    // ✅ runStructureGeneration ONLY generates structure (NO pipeline updates)
    try {
      await runStructureGeneration(
        store,
        this.config.taskLabel.trim(),
        this.config.rowId,
        this.config.locale || 'it'
      );
    } catch (error) {
      console.error('[WizardOrchestrator] ❌ Error in structure generation:', error);
      this.hasStarted = false;
      throw error;
    }

    // ✅ ORCHESTRATOR updates pipeline AFTER generation
    store.updatePipelineStep('structure', 'running', 'Confermami la struttura che vedi sulla sinistra...');
    store.setWizardMode(WizardMode.DATA_STRUCTURE_PROPOSED);
  }

  /**
   * Confirm structure (point of no return)
   * ONLY entry point for structure confirmation
   */
  async confirmStructure(): Promise<void> {
    const store = this.getStore();

    // ✅ POINT OF NO RETURN: Set flag FIRST
    store.setStructureConfirmed(true);

    // ✅ Update UI IMMEDIATELY (before async operations)
    store.updatePipelineStep('structure', 'completed', 'Confermata!');
    store.setWizardMode(WizardMode.GENERATING);

    // ✅ CRITICAL: Calculate payloads IMMEDIATELY (before any async operations)
    // This ensures UI shows payloads right away, not after createTemplateAndInstanceForProposed
    const allTasks = store.dataSchema ? flattenTaskTree(store.dataSchema) : [];
    const constraintsPayload = `Sto generando i constraints per: ${allTasks.map(n => n.label).join(', ')}…`;

    // Get parsers payload (async, but we start it immediately)
    let parsersPayload = 'Sto generando tutti i parser necessari per estrarre i dati, nell\'ordine di escalation appropriato: …';
    const parsersPayloadPromise = (async () => {
      try {
        const rootNode = store.dataSchema[0];
        if (rootNode) {
          const { buildContractFromNode } = await import('../api/wizardApi');
          const contract = buildContractFromNode(rootNode);
          const provider = localStorage.getItem('omnia.aiProvider') || 'openai';
          const model = localStorage.getItem('omnia.aiModel') || undefined;

          const planResponse = await fetch('/api/nlp/plan-engines', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contract, nodeLabel: rootNode.label, locale: this.config.locale || 'it', provider, model })
          });

          if (planResponse.ok) {
            const planData = await planResponse.json();
            if (planData.success && planData.parsersPlan) {
              const enabledParsers = planData.parsersPlan
                .filter((p: any) => p.enabled)
                .map((p: any) => p.type)
                .join(', ');
              return `Sto generando tutti i parser necessari per estrarre i dati, nell'ordine di escalation appropriato: ${enabledParsers}…`;
            }
          }
        }
      } catch (error) {
        console.warn('[WizardOrchestrator] Failed to get parsers plan, using default payload:', error);
      }
      return parsersPayload;
    })();

    const MESSAGE_STEP_LABELS = [
      'Chiedo il dato',
      'Non sento',
      'Non capisco',
      'Devo confermare',
      'Non Confermato',
      'Ho capito!'
    ];
    const messagesPayload = `Sto generando tutti i messaggi che il bot deve utilizzare in tutte le possibili situazioni: ${MESSAGE_STEP_LABELS.map(s => `"${s}"`).join(', ')}…`;

    // ✅ ORCHESTRATOR updates pipeline IMMEDIATELY with initial payloads
    store.updatePipelineStep('constraints', 'running', constraintsPayload);
    store.updatePipelineStep('parsers', 'running', parsersPayload); // Will be updated when promise resolves
    store.updatePipelineStep('messages', 'running', messagesPayload);

    // ✅ Update parsers payload when promise resolves (non-blocking)
    parsersPayloadPromise.then(updatedParsersPayload => {
      store.updatePipelineStep('parsers', 'running', updatedParsersPayload);
    }).catch(() => {
      // Keep default payload on error
    });

    // ✅ Update parsers payload in store when promise resolves (non-blocking)
    parsersPayloadPromise.then(updatedParsersPayload => {
      store.updatePipelineStep('parsers', 'running', updatedParsersPayload);
    }).catch(() => {
      // Keep default payload on error
    });

    // ✅ Start createTemplateAndInstanceForProposed in parallel (non-blocking)
    const createTemplatePromise = this.config.rowId && this.config.projectId
      ? (async () => {
          try {
            const { taskInstance, taskTree } = await createTemplateAndInstanceForProposed(
              store.dataSchema,
              store.messages,
              store.messagesGeneralized,
              store.messagesContextualized,
              store.shouldBeGeneral,
              this.config.taskLabel || 'Task',
              this.config.rowId,
              this.config.projectId,
              this.config.addTranslation,
              false
            );

            if (taskTree && this.config.onTaskBuilderComplete) {
              this.config.onTaskBuilderComplete(taskTree);
            }
          } catch (error) {
            console.error('[WizardOrchestrator] ❌ Error creating template+instance (non-blocking):', error);
          }
        })()
      : Promise.resolve();

    // ✅ Start parallel generation IMMEDIATELY (don't wait for createTemplateAndInstanceForProposed)
    // Store payloads for progress updates
    let finalConstraintsPayload = constraintsPayload;
    let finalParsersPayload = parsersPayload;
    let finalMessagesPayload = messagesPayload;

    // ✅ Start both operations in parallel
    const parallelGenerationPromise = runParallelGeneration(store, this.config.locale || 'it', async (phase, taskId, payloads?) => {
        // ✅ Orchestrator receives payloads from runParallelGeneration (taskId === 'init')
        if (taskId === 'init' && payloads) {
          finalConstraintsPayload = payloads.constraints || finalConstraintsPayload;
          finalParsersPayload = payloads.parsers || finalParsersPayload;
          finalMessagesPayload = payloads.messages || finalMessagesPayload;

          // ✅ ORCHESTRATOR updates pipeline with payloads (already set above, but update if different)
          if (payloads.constraints && payloads.constraints !== finalConstraintsPayload) {
            store.updatePipelineStep('constraints', 'running', payloads.constraints);
            finalConstraintsPayload = payloads.constraints;
          }
          if (payloads.parsers && payloads.parsers !== finalParsersPayload) {
            store.updatePipelineStep('parsers', 'running', payloads.parsers);
            finalParsersPayload = payloads.parsers;
          }
          if (payloads.messages && payloads.messages !== finalMessagesPayload) {
            store.updatePipelineStep('messages', 'running', payloads.messages);
            finalMessagesPayload = payloads.messages;
          }
          return; // Early return for init
        }

        // ✅ Orchestrator updates pipeline based on progress callbacks
        // Check for all-complete FIRST (before other callbacks)
        if (taskId === 'all-complete') {
          await new Promise(resolve => setTimeout(resolve, 100));

          const completion = checkCompletion();
          if (completion.isComplete && this.config.rowId && this.config.projectId) {
            try {
              const currentStore = this.getStore(); // ✅ Fresh store
              const taskInstance = await createTemplateAndInstanceForCompleted(
                currentStore.dataSchema, // ✅ Direct field access
                currentStore.messages,
                currentStore.messagesGeneralized,
                currentStore.messagesContextualized,
                currentStore.shouldBeGeneral,
                this.config.taskLabel || 'Task',
                this.config.rowId,
                this.config.projectId,
                this.config.addTranslation,
                false // adaptAllNormalSteps
              );

              const taskTree = await buildTaskTreeWithContractsAndEngines(
                taskInstance,
                this.config.projectId,
                currentStore.dataSchema
              );

              if (taskTree && this.config.onTaskBuilderComplete) {
                this.config.onTaskBuilderComplete(taskTree);
              }

              // ✅ ORCHESTRATOR controls final transition
              currentStore.setWizardMode(WizardMode.COMPLETED);
            } catch (error) {
              console.error('[WizardOrchestrator] ❌ Error in completion (non-blocking):', error);
            }
          }
          return; // Early return for all-complete
        }

        // Progress update (e.g., "33%")
        if (typeof taskId === 'string' && taskId.includes('%')) {
          const progress = parseInt(taskId);
          const phaseId = phase === 'constraints' ? 'constraints'
                       : phase === 'parser' ? 'parsers'
                       : 'messages';
          const basePayload = phase === 'constraints' ? finalConstraintsPayload
                           : phase === 'parser' ? finalParsersPayload
                           : finalMessagesPayload;
          const baseMessage = basePayload.replace(/…$/, '');
          store.updatePipelineStep(phaseId, 'running', `${baseMessage} ${progress}%`);
        } else if (typeof taskId === 'string' && taskId.startsWith('phase-complete-')) {
          // Phase completed (all tasks in this phase are done)
          const phaseId = taskId.replace('phase-complete-', '');
          store.updatePipelineStep(phaseId, 'completed', 'Generati!');
        }
      });

    // ✅ Wait for both parallel generation AND template creation (both run in parallel)
    try {
      await Promise.all([parallelGenerationPromise, createTemplatePromise]);
    } catch (error) {
      console.error('[WizardOrchestrator] ❌ Error in parallel operations:', error);
      throw error;
    }
  }

  /**
   * Reject structure
   * ONLY entry point for structure rejection
   */
  rejectStructure(): void {
    const store = this.getStore();
    store.setWizardMode(WizardMode.DATA_STRUCTURE_CORRECTION);
  }

  /**
   * Reset wizard
   * ONLY entry point for reset
   */
  reset(): void {
    this.hasStarted = false;
    const store = this.getStore();
    store.reset();
  }

  /**
   * Show module list
   * ONLY entry point for module list
   */
  showModuleList(): void {
    const store = this.getStore();
    store.setWizardMode(WizardMode.LISTA_MODULI);
    store.setCurrentStep('lista_moduli');
  }

  /**
   * Select module
   * ONLY entry point for module selection
   */
  async selectModule(moduleId: string): Promise<void> {
    const store = this.getStore();
    store.setSelectedModuleId(moduleId);
    this.hasStarted = false;
    store.reset();
    store.setCurrentStep('generazione_struttura');

    if (this.config.taskLabel) {
      // ✅ ORCHESTRATOR controls pipeline updates
      store.updatePipelineStep('structure', 'running', 'sto pensando a qual è la migliore struttura dati per questo task...');

      await runStructureGeneration(
        store,
        this.config.taskLabel.trim(),
        this.config.rowId,
        this.config.locale || 'it'
      );

      // ✅ ORCHESTRATOR updates pipeline AFTER generation
      store.updatePipelineStep('structure', 'running', 'Confermami la struttura che vedi sulla sinistra...');
      store.setWizardMode(WizardMode.DATA_STRUCTURE_PROPOSED);
    }
  }

  /**
   * Proceed from euristica
   * ONLY entry point for euristica flow
   */
  async proceedFromEuristica(): Promise<void> {
    if (!this.config.taskLabel) {
      return;
    }

    this.hasStarted = false;
    const store = this.getStore();
    store.reset();
    store.setCurrentStep('generazione_struttura');

    // ✅ ORCHESTRATOR controls pipeline updates
    store.updatePipelineStep('structure', 'running', 'sto pensando a qual è la migliore struttura dati per questo task...');

    await runStructureGeneration(
      store,
      this.config.taskLabel.trim(),
      this.config.rowId,
      this.config.locale || 'it'
    );

    // ✅ ORCHESTRATOR updates pipeline AFTER generation
    store.updatePipelineStep('structure', 'running', 'Confermami la struttura che vedi sulla sinistra...');
    store.setWizardMode(WizardMode.DATA_STRUCTURE_PROPOSED);
  }
}

/**
 * Hook to use Wizard Orchestrator
 */
export function useWizardOrchestrator(config: WizardOrchestratorConfig) {
  const store = useWizardStore();
  const orchestrator = new WizardOrchestrator(config);

  return {
    // State (read-only)
    wizardMode: store.wizardMode,
    currentStep: store.currentStep,
    pipelineSteps: store.pipelineSteps,
    dataSchema: store.dataSchema,
    showStructureConfirmation: store.showStructureConfirmation(),
    structureConfirmed: (useWizardStore.getState() as any as { structureConfirmed: boolean }).structureConfirmed, // ✅ Direct field access
    showCorrectionMode: store.showCorrectionMode(),
    correctionInput: store.correctionInput,
    messages: store.messages,
    messagesGeneralized: store.messagesGeneralized,
    messagesContextualized: store.messagesContextualized,
    shouldBeGeneral: store.shouldBeGeneral,
    constraints: store.constraints,
    nlpContract: store.nlpContract,
    currentParserSubstep: store.currentParserSubstep,
    currentMessageSubstep: store.currentMessageSubstep,
    activeNodeId: store.activeNodeId,
    selectedModuleId: store.selectedModuleId,
    availableModules: [], // TODO: implement
    foundModuleId: store.selectedModuleId,

    // Actions (only through orchestrator)
    start: orchestrator.start.bind(orchestrator),
    confirmStructure: orchestrator.confirmStructure.bind(orchestrator),
    rejectStructure: orchestrator.rejectStructure.bind(orchestrator),
    reset: orchestrator.reset.bind(orchestrator),
    showModuleList: orchestrator.showModuleList.bind(orchestrator),
    selectModule: orchestrator.selectModule.bind(orchestrator),
    proceedFromEuristica: orchestrator.proceedFromEuristica.bind(orchestrator),
    setCorrectionInput: store.setCorrectionInput,
    setActiveNodeId: store.setActiveNodeId,
  };
}
