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
    // ✅ FIX: Add 0% to initial payloads so progress bar shows immediately
    store.updatePipelineStep('constraints', 'running', `${constraintsPayload.replace(/…$/, '')} 0%`);
    store.updatePipelineStep('parsers', 'running', `${parsersPayload.replace(/…$/, '')} 0%`); // Will be updated when promise resolves
    store.updatePipelineStep('messages', 'running', `${messagesPayload.replace(/…$/, '')} 0%`);

    // ✅ FIX 1: Update parsers payload when promise resolves (preserve percentage)
    parsersPayloadPromise.then(updatedParsersPayload => {
      // ✅ FIX 1: Preserve existing percentage if new payload doesn't have one
      const currentStep = store.pipelineSteps.find(s => s.id === 'parsers');
      const existingPercentage = currentStep?.payload?.match(/(\d+)%/)?.[0];

      const payloadWithProgress = updatedParsersPayload.includes('%')
        ? updatedParsersPayload
        : existingPercentage
        ? `${updatedParsersPayload.replace(/…$/, '')} ${existingPercentage}`
        : `${updatedParsersPayload.replace(/…$/, '')} 0%`;

      store.updatePipelineStep('parsers', 'running', payloadWithProgress);
    }).catch(() => {
      // Keep default payload on error (already has 0%)
    });

    // ✅ NUOVA PIPELINE DETERMINISTICA
    // FASE 1: Crea struttura deterministica per tutti i nodi
    const { createTemplateStructure } = await import('../services/TemplateCreationService');
    const nodeStructures = new Map<string, any>();
    allTasks.forEach(task => {
      const structure = createTemplateStructure(task);
      nodeStructures.set(task.id, structure);
    });
    console.log('[WizardOrchestrator] ✅ FASE 1: Template structures created', { structuresCount: nodeStructures.size });

    // FASE 2: Crea scheletro template (solo struttura, senza constraints/contracts/messaggi)
    const { createTemplatesFromStructures } = await import('../services/TemplateCreationService');
    const { DialogueTaskService } = await import('@services/DialogueTaskService');
    const templates = await createTemplatesFromStructures(
      store.dataSchema,
      nodeStructures,
      store.shouldBeGeneral
    );

    // Registra template nella cache
    templates.forEach(template => {
      DialogueTaskService.addTemplate(template);
    });
    console.log('[WizardOrchestrator] ✅ FASE 2: Template skeletons created and registered', { templatesCount: templates.size });

    // FASI 3-5: Parallelo (constraints, contracts, template messages)
    const { AIGenerateConstraints, AIGenerateContracts, AIGenerateTemplateMessages } = await import('../services/TemplateGenerationServices');

    // Store payloads for progress updates
    let finalConstraintsPayload = constraintsPayload;
    let finalParsersPayload = parsersPayload;
    let finalMessagesPayload = messagesPayload;

    // ✅ Start parallel generation (constraints, contracts, messages)
    const parallelGenerationPromise = Promise.all([
      AIGenerateConstraints(store.dataSchema, this.config.locale || 'it').then(() => {
        console.log('[WizardOrchestrator] ✅ FASE 3: Constraints generated');
      }),
      AIGenerateContracts(templates, store.dataSchema).then(() => {
        console.log('[WizardOrchestrator] ✅ FASE 4: Contracts generated');
      }),
      AIGenerateTemplateMessages(nodeStructures, store.dataSchema, this.config.locale || 'it').then(() => {
        console.log('[WizardOrchestrator] ✅ FASE 5: Template messages generated');
      })
    ]).then(() => {
      console.log('[WizardOrchestrator] ✅ FASI 3-5: All parallel generation completed');
    });

    // ✅ Start legacy runParallelGeneration ONLY for parsers (no template creation)
    // Note: Constraints and messages are already generated in parallelGenerationPromise
    const legacyParallelGenerationPromise = runParallelGeneration(store, this.config.locale || 'it', async (phase, taskId, payloads?) => {
        // ✅ Orchestrator receives payloads from runParallelGeneration (taskId === 'init')
        if (taskId === 'init' && payloads) {
          finalParsersPayload = payloads.parsers || finalParsersPayload;

          // ✅ ORCHESTRATOR updates pipeline with payloads
          if (payloads.parsers && payloads.parsers !== finalParsersPayload) {
            store.updatePipelineStep('parsers', 'running', payloads.parsers);
            finalParsersPayload = payloads.parsers;
          }
          return; // Early return for init
        }

        // ✅ REMOVED: all-complete handler - templates are already created in FASE 2
        // The new flow handles completion in FASI 6-7

        // Progress update (e.g., "33%")
        if (typeof taskId === 'string' && taskId.includes('%')) {
          const progress = parseInt(taskId);
          const phaseId = phase === 'parser' ? 'parsers' : phase;
          const basePayload = phase === 'parser' ? finalParsersPayload : '';
          const baseMessage = basePayload.replace(/…$/, '');
          const newPayload = `${baseMessage} ${progress}%`;

          console.log(`[WizardOrchestrator] 📊 Updating pipeline step progress`, {
            phase,
            phaseId,
            progress,
            baseMessage,
            newPayload,
            taskId
          });

          if (phase === 'parser') {
            store.updatePipelineStep(phaseId, 'running', newPayload);
          }
        } else if (typeof taskId === 'string' && taskId.startsWith('phase-complete-')) {
          // Phase completed (all tasks in this phase are done)
          const phaseId = taskId.replace('phase-complete-', '');
          // ✅ FIX: Handle all phases, not just parsers
          if (phaseId === 'parsers' || phaseId === 'constraints' || phaseId === 'messages') {
            store.updatePipelineStep(phaseId, 'completed', 'Generati!');
          }
        }
      });

    // ✅ Wait for parallel generation to complete
    try {
      await Promise.all([parallelGenerationPromise, legacyParallelGenerationPromise]);

      // FASI 6-7: Sequenziale (dopo che tutto il parallelo è finito)
      if (this.config.rowId && this.config.projectId) {
        console.log('[WizardOrchestrator] 🚀 Starting sequential phases 6-7');

        // FASE 6: Clona tutti gli step di tutti i nodi e li aggiunge all'istanza
        const { cloneTemplateSteps } = await import('@utils/taskUtils');
        const { buildNodesFromTemplates } = await import('../services/TemplateCreationService');
        const rootNode = store.dataSchema[0];
        const rootTemplate = templates.get(rootNode.id);

        if (rootTemplate) {
          // Build nodes from templates (per cloneTemplateSteps)
          const nodes = buildNodesFromTemplates(rootTemplate, templates);
          const { steps: clonedSteps, guidMapping } = cloneTemplateSteps(rootTemplate, nodes);

          // Crea istanza con step clonati
          const taskInstance: any = {
            id: this.config.rowId,
            type: rootTemplate.type || 3,
            templateId: rootTemplate.id,
            label: this.config.taskLabel || 'Task',
            steps: clonedSteps,
          };

          console.log('[WizardOrchestrator] ✅ FASE 6: Steps cloned', { guidMappingSize: guidMapping.size });

          // FASE 7: Clona e contestualizza traduzioni (nuovo flusso deterministico)
          try {
            const { cloneAndContextualizeTranslations } = await import('@utils/cloneAndContextualizeTranslations');
            await cloneAndContextualizeTranslations(
              clonedSteps,
              guidMapping,
              rootTemplate.id,
              this.config.taskLabel || 'Task',
              this.config.locale || 'it'
            );
            console.log('[WizardOrchestrator] ✅ FASE 7: Translations cloned and contextualized', {
              guidMappingSize: guidMapping.size
            });
          } catch (contextError) {
            console.error('[WizardOrchestrator] ❌ Error in FASE 7 (non-blocking):', contextError);
            // Continue even if contextualization fails - translations are already cloned
          }

          // ✅ NOTA: Le traduzioni sono già in memoria (ProjectTranslationsContext)
          // Il salvataggio nel database avviene SOLO quando l'utente clicca su "Salva"
          // Non salviamo qui per mantenere il wizard completamente in memoria

          // Build TaskTree finale
          const { buildTaskTree } = await import('@utils/taskUtils');
          const finalTaskTree = await buildTaskTree(taskInstance, this.config.projectId);

          if (finalTaskTree && this.config.onTaskBuilderComplete) {
            this.config.onTaskBuilderComplete(finalTaskTree);
          }

          // ✅ NOTA: Il task è già nel repository in memoria (taskRepository)
          // Il salvataggio nel database avviene SOLO quando l'utente clicca su "Salva"
          // Non salviamo qui per mantenere il wizard completamente in memoria

          // Chiudi wizard
          store.setWizardMode(WizardMode.COMPLETED);

          console.log('[WizardOrchestrator] ✅ All phases completed successfully (all in memory)');
        }
      }
    } catch (error) {
      console.error('[WizardOrchestrator] ❌ Error in pipeline:', error);
      // Try to close wizard even on error
      try {
        const store = this.getStore();
        store.setWizardMode(WizardMode.COMPLETED);
      } catch (closeError) {
        console.error('[WizardOrchestrator] ❌ Error closing wizard:', closeError);
      }
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
    // ✅ NEW: Phase counters (source of truth for progress)
    phaseCounters: store.phaseCounters,

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
