// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Wizard Orchestrator
 *
 * SINGLE SOURCE OF TRUTH for all wizard operations.
 *
 * Rules:
 * - ONLY this file can call setWizardState
 * - ONLY this file can call updatePipelineStep
 * - ONLY this file can start/stop generation
 * - ONLY this file can open/close TaskTree
 * - NO side effects outside this file
 * - NO direct store access from components
 */

import React from 'react';
import { useWizardStore, type WizardRunMode } from '../store/wizardStore';
import { runStructureGeneration, runParallelGeneration, checkCompletion } from '../actions/wizardActions';
import { WizardMode } from '../types/WizardMode';
import {
  createTemplateAndInstanceForProposed,
  createTemplateAndInstanceForCompleted,
  buildTaskTreeWithContractsAndEngines,
  collectNodeData
} from '../services/WizardCompletionService';
import type { SemanticContract } from '@types/semanticContract';
import { flattenTaskTree } from '../utils/wizardHelpers';
import type { WizardTaskTreeNode } from '../types';
import { cloneTemplateToInstance } from '../services/TemplateCloningService';

export interface WizardOrchestratorConfig {
  taskLabel: string;
  rowId?: string;
  projectId?: string;
  locale?: string;
  onTaskBuilderComplete?: (taskTree: any) => void;
  addTranslation?: (guid: string, text: string) => void;
  /**
   * @deprecated Use store.runMode instead. This property is ignored.
   * The run mode is now managed by the store via setRunMode().
   */
  mode?: 'full' | 'adaptation';
  templateId?: string; // ✅ Template ID for adaptation mode
}

/**
 * Wizard Orchestrator Class
 *
 * Controls ALL wizard operations. No other code should modify wizard state.
 */
export class WizardOrchestrator {
  private config: WizardOrchestratorConfig;
  private hasStarted = false;
  /**
   * Instance-level run mode flag.
   * Set by startFull() or startAdaptation() and used by confirmStructure().
   * This is the reliable source of truth — independent of global store state
   * which can be reset by concurrent operations or re-renders.
   */
  private instanceRunMode: 'none' | 'full' | 'adaptation' = 'none';
  private taskInstance: any = null; // ✅ Store task instance for adaptation phase

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
   * Get current run mode from store
   */
  private getRunMode(): WizardRunMode {
    return this.getStore().runMode;
  }

  /**
   * Start wizard in FULL mode (complete construction)
   * Replaces old start() method
   */
  async startFull(): Promise<void> {
    if (this.hasStarted) {
      console.warn('[WizardOrchestrator] ⚠️ startFull() called multiple times - ignored');
      return;
    }

    if (!this.config.taskLabel?.trim()) {
      throw new Error('[WizardOrchestrator] taskLabel is required for full mode');
    }

    this.hasStarted = true;
    this.instanceRunMode = 'full'; // ✅ Set instance-level flag BEFORE reset
    const store = this.getStore();

    // ✅ FIX: reset() FIRST, then setRunMode() — otherwise reset() overwrites runMode to 'none'
    store.reset();
    store.setRunMode('full');

    // ✅ ORCHESTRATOR controls ALL pipeline updates
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
    store.setWizardState(WizardMode.DATA_STRUCTURE_PROPOSED);
  }

  /**
   * Start wizard in ADAPTATION mode (template exists, only adaptation needed)
   */
  async startAdaptation(templateId: string): Promise<void> {
    if (this.hasStarted) {
      console.warn('[WizardOrchestrator] ⚠️ startAdaptation() called multiple times - ignored');
      return;
    }

    this.hasStarted = true;
    this.instanceRunMode = 'adaptation'; // ✅ Set instance-level flag (reliable source of truth)
    const store = this.getStore();

    // ✅ Set run mode in store (single source of truth)
    store.setRunMode('adaptation');

    // ✅ Load template structure
    const { DialogueTaskService } = await import('@services/DialogueTaskService');
    const template = DialogueTaskService.getTemplate(templateId);

    if (!template) {
      throw new Error(`[WizardOrchestrator] Template not found: ${templateId}`);
    }

    // ✅ Convert template to dataSchema format
    const { buildDataSchemaFromTemplate } = await import('../utils/templateToDataSchema');
    const dataSchema = buildDataSchemaFromTemplate(template);

    // ✅ Set dataSchema in store (read-only, for display)
    store.setDataSchema(dataSchema);

    // ✅ Mark structure as "proposed" (user must confirm)
    store.updatePipelineStep('structure', 'running', 'Struttura dati del template caricata. Conferma per procedere con l\'adattamento...');
    store.setWizardState(WizardMode.DATA_STRUCTURE_PROPOSED);

    // ✅ Mark other steps as skipped (not needed in adaptation mode)
    store.updatePipelineStep('constraints', 'completed', 'Non necessario (template esistente)');
    store.updatePipelineStep('parsers', 'completed', 'Non necessario (template esistente)');
    store.updatePipelineStep('messages', 'completed', 'Non necessario (template esistente)');
    store.updatePipelineStep('adaptation', 'pending', 'In attesa di conferma struttura...');

    // ✅ Store templateId for later use
    this.config.templateId = templateId;
  }

  /**
   * @deprecated Use startFull() or startAdaptation() instead
   * Start wizard generation (legacy method - kept for backward compatibility)
   */
  async start(): Promise<void> {
    // ✅ Legacy method delegates to startFull()
    return this.startFull();
  }

  /**
   * Confirm structure (point of no return)
   * Unified entry point for structure confirmation in both FULL and ADAPTATION modes
   */
  async confirmStructure(): Promise<void> {
    const store = this.getStore();

    // ✅ FIX: Use instanceRunMode (per-instance, set by startFull/startAdaptation) as
    // primary source of truth. store.runMode is unreliable because store.reset() (called
    // inside startFull) overwrites it, and concurrent re-renders can create new orchestrators.
    const runMode = this.instanceRunMode !== 'none'
      ? this.instanceRunMode
      : this.getRunMode(); // fallback: read from store if instance flag not set

    console.log('[WizardOrchestrator] 🔍 confirmStructure', {
      instanceRunMode: this.instanceRunMode,
      storeRunMode: this.getRunMode(),
      effectiveRunMode: runMode,
    });

    // ✅ POINT OF NO RETURN: Set flag FIRST
    store.setStructureConfirmed(true);

    // ✅ Update UI IMMEDIATELY (before async operations)
    store.updatePipelineStep('structure', 'completed', 'Confermata!');
    store.setWizardState(WizardMode.GENERATING);

    if (runMode === 'adaptation') {
      // ✅ ADAPTATION MODE: Direct cloning and adaptation (no parallel generation)
      try {
        await this.executeAdaptationFlow(store);
      } catch (error) {
        console.error('[WizardOrchestrator] ❌ executeAdaptationFlow failed:', error);
        store.updatePipelineStep('adaptation', 'failed',
          error instanceof Error ? error.message : 'Errore sconosciuto nell\'adattamento');
        throw error;
      }
    } else {
      // ✅ FULL MODE: Parallel generation → sequential → adaptation
      // ✅ Reset completed phases tracker (fresh start)
      store.resetCompletedPhases();

      // ✅ REFACTOR: Extract phase setup
      const { payloads } = await this.setupPhasePayloads(store);

      // ✅ REFACTOR: Extract template creation phases
      const { templates, nodeStructures } = await this.executeTemplateCreationPhases(store);

      // ✅ REFACTOR: Extract parallel generation
      // Note: Sequential phases and adaptation are triggered by 'all-complete' callback
      await this.executeParallelGeneration(store, templates, nodeStructures, payloads);
    }
  }

  /**
   * Execute adaptation flow (cloning + adaptation)
   * Used by ADAPTATION mode after structure confirmation
   */
  private async executeAdaptationFlow(
    store: ReturnType<typeof useWizardStore.getState>
  ): Promise<void> {
    // ✅ Debug: log config before guard check so we can see what's missing
    console.log('[WizardOrchestrator] 🔍 executeAdaptationFlow config', {
      hasRowId: !!this.config.rowId,
      hasProjectId: !!this.config.projectId,
      hasTemplateId: !!this.config.templateId,
      rowId: this.config.rowId,
      projectId: this.config.projectId,
      templateId: this.config.templateId,
      instanceRunMode: this.instanceRunMode,
    });

    if (!this.config.rowId || !this.config.projectId || !this.config.templateId) {
      throw new Error(
        `[WizardOrchestrator] rowId, projectId and templateId required for adaptation. ` +
        `rowId=${this.config.rowId}, projectId=${this.config.projectId}, templateId=${this.config.templateId}`
      );
    }

    console.log('[WizardOrchestrator] 🚀 Starting adaptation flow: cloning steps and translations');

    // ✅ Use shared cloning function
    const { taskInstance, guidMapping } = await cloneTemplateToInstance({
      templateId: this.config.templateId!,
      rowId: this.config.rowId,
      projectId: this.config.projectId,
      taskLabel: this.config.taskLabel || 'Task',
      locale: this.config.locale || 'it',
      dataSchema: store.dataSchema
    });

    // ✅ Store taskInstance for adaptation phase
    this.taskInstance = taskInstance;

    // ✅ Execute adaptation phase
    await this.executeAdaptationPhase(store);

    // ✅ Mark as completed
    store.updatePipelineStep('adaptation', 'completed', 'Prompt adattati al contesto');
    store.setWizardState(WizardMode.COMPLETED);

    if (this.config.onTaskBuilderComplete) {
      const { buildTaskTreeFromRepository } = await import('@utils/taskUtils');
      // buildTaskTreeFromRepository returns { taskTree, instance } — unpack before passing
      const result = await buildTaskTreeFromRepository(this.config.rowId, this.config.projectId);
      if (result?.taskTree) {
        this.config.onTaskBuilderComplete(result.taskTree);
      }
    }
  }

  /**
   * ✅ REFACTOR: Setup phase payloads and update UI
   */
  private async setupPhasePayloads(store: ReturnType<typeof useWizardStore.getState>): Promise<{
    payloads: { constraints: string; parsers: string; messages: string };
    parsersPayloadPromise: Promise<string>;
  }> {
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

    return {
      payloads: {
        constraints: constraintsPayload,
        parsers: parsersPayload,
        messages: messagesPayload
      },
      parsersPayloadPromise
    };
  }

  /**
   * ✅ REFACTOR: Execute template creation phases (FASE 1, 2, 2.5)
   */
  private async executeTemplateCreationPhases(store: ReturnType<typeof useWizardStore.getState>): Promise<{
    templates: Map<string, any>;
    nodeStructures: Map<string, any>;
  }> {
    const allTasks = store.dataSchema ? flattenTaskTree(store.dataSchema) : [];

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

    // ✅ FASE 2.5: Build dataContract base with subDataMapping (deterministic)
    // This must happen BEFORE AI generation to ensure subDataMapping is always present
    const { constraintsMap, dataContractsMap } = collectNodeData(store.dataSchema);

    // Assign dataContract to templates (with subDataMapping)
    templates.forEach((template, nodeId) => {
      const dataContract = dataContractsMap.get(nodeId);
      if (dataContract) {
        template.dataContract = dataContract;
        console.log(`[WizardOrchestrator] ✅ FASE 2.5: Assigned dataContract to template ${nodeId}`, {
          hasSubDataMapping: Object.keys(dataContract.subDataMapping || {}).length > 0,
          subDataMappingKeys: Object.keys(dataContract.subDataMapping || {})
        });
      }
    });

    // Registra template nella cache
    templates.forEach(template => {
      DialogueTaskService.addTemplate(template);
    });
    console.log('[WizardOrchestrator] ✅ FASE 2: Template skeletons created and registered', { templatesCount: templates.size });

    return { templates, nodeStructures };
  }

  /**
   * ✅ REFACTOR: Execute parallel generation phases (FASI 3-5)
   */
  private async executeParallelGeneration(
    store: ReturnType<typeof useWizardStore.getState>,
    templates: Map<string, any>,
    nodeStructures: Map<string, any>,
    payloads: { constraints: string; parsers: string; messages: string }
  ): Promise<void> {
    // FASI 3-5: Parallelo (constraints, contracts, template messages)
    const { AIGenerateConstraints, AIGenerateContracts, AIGenerateTemplateMessages } = await import('../services/TemplateGenerationServices');

    // ✅ Store semanticContracts for Assembler
    let semanticContractsMap = new Map<string, SemanticContract>();

    // ✅ Start parallel generation (constraints, contracts, messages)
    // ✅ NEW: AIGenerateContracts now returns Map<string, SemanticContract> instead of void
    const parallelGenerationPromise = Promise.all([
      AIGenerateConstraints(store.dataSchema, this.config.locale || 'it').then(() => {
        console.log('[WizardOrchestrator] ✅ FASE 3: Constraints generated');
      }),
      AIGenerateContracts(templates, store.dataSchema).then((semanticContracts) => {
        semanticContractsMap = semanticContracts; // ✅ Save for Assembler
        console.log('[WizardOrchestrator] ✅ FASE 4: Semantic contracts generated', {
          contractsCount: semanticContracts.size
        });
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
          // ✅ ORCHESTRATOR updates pipeline with payloads
          if (payloads.parsers) {
            store.updatePipelineStep('parsers', 'running', payloads.parsers);
          }
          return; // Early return for init
        }

        // Progress update (e.g., "33%")
        if (typeof taskId === 'string' && taskId.includes('%')) {
          const progress = parseInt(taskId);
          const phaseId = phase === 'parser' ? 'parsers' : phase;
          // ✅ FIX: Check if payloads exists before accessing payloads.parsers
          const basePayload = phase === 'parser' ? (payloads?.parsers || '') : '';
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
            // ✅ NEW: Mark phase as completed in global tracker, but DON'T mark pipeline as "completed" yet
            // The pipeline will be marked as "completed" only when ALL phases (including sequential) are done
            store.markPhaseCompleted(phaseId as 'constraints' | 'parsers' | 'messages');
            // Keep pipeline step as "running" with 100% progress (card will show filled)
            const currentStep = store.pipelineSteps.find(s => s.id === phaseId);
            if (currentStep?.status === 'running') {
              store.updatePipelineStep(phaseId, 'running', 'Finalizzazione in corso...');
            }
          }
        } else if (taskId === 'all-complete') {
          // ✅ DETERMINISTIC POINT: All parallel phases are complete (allPhasesCompleteCheck() is true)
          // This is the ONLY safe point to execute sequential phases and adaptation
          console.log('[WizardOrchestrator] ✅ All parallel phases completed, starting sequential phases and adaptation');

          // Execute sequential phases (FASE 6-7)
          await this.executeSequentialPhases(store, templates);

          // Execute adaptation phase (FASE 9) - only if in FULL mode
          const runMode = this.getRunMode();
          if (runMode === 'full') {
            await this.executeAdaptationPhase(store);
          }

          // Mark all pipeline steps as completed and close wizard
          store.updatePipelineStep('constraints', 'completed', 'Generati!');
          store.updatePipelineStep('parsers', 'completed', 'Generati!');
          store.updatePipelineStep('messages', 'completed', 'Generati!');

          // Build final TaskTree and trigger completion callback
          if (this.taskInstance && this.config.projectId) {
            const finalTaskTree = await buildTaskTreeWithContractsAndEngines(
              this.taskInstance,
              this.config.projectId,
              store.dataSchema
            );

            store.setWizardState(WizardMode.COMPLETED);

            if (finalTaskTree && this.config.onTaskBuilderComplete) {
              this.config.onTaskBuilderComplete(finalTaskTree);
            }
          } else {
            store.setWizardState(WizardMode.COMPLETED);
          }
        }
      });

    // ✅ Wait for parallel generation to complete
    await Promise.all([parallelGenerationPromise, legacyParallelGenerationPromise]);
  }

  /**
   * ✅ REFACTOR: Execute sequential phases (FASI 6-7) and completion (FASE 8)
   * Uses shared cloneTemplateToInstance function
   */
  private async executeSequentialPhases(
    store: ReturnType<typeof useWizardStore.getState>,
    templates: Map<string, any>
  ): Promise<void> {
    // FASI 6-7: Sequenziale (dopo che tutto il parallelo è finito)
    if (!this.config.rowId || !this.config.projectId) {
      return;
    }

    console.log('[WizardOrchestrator] 🚀 Starting sequential phases 6-7');

    // Get root template ID from dataSchema
    const rootNode = store.dataSchema[0];
    if (!rootNode) {
      console.error('[WizardOrchestrator] ❌ Root node not found in dataSchema');
      return;
    }

    const rootTemplate = templates.get(rootNode.id);
    if (!rootTemplate) {
      console.error('[WizardOrchestrator] ❌ Root template not found');
      return;
    }

    // ✅ Use shared cloning function
    const { taskInstance } = await cloneTemplateToInstance({
      templateId: rootTemplate.id,
      rowId: this.config.rowId,
      projectId: this.config.projectId,
      taskLabel: this.config.taskLabel || 'Task',
      locale: this.config.locale || 'it',
      dataSchema: store.dataSchema
    });

    // ✅ Store taskInstance for adaptation phase
    this.taskInstance = taskInstance;

    // ✅ Mark sequential phases as completed
    store.markPhaseCompleted('sequential');

    console.log('[WizardOrchestrator] ✅ Sequential phases completed (FASE 6-7)');
  }

  /**
   * ✅ NEW: Execute adaptation phase (FASE 9)
   * Pure sequential phase - does NOT depend on counters
   * Only runs in FULL mode, after sequential phases are complete
   */
  private async executeAdaptationPhase(
    store: ReturnType<typeof useWizardStore.getState>
  ): Promise<void> {
    if (!this.taskInstance || !this.config.rowId) {
      console.warn('[WizardOrchestrator] ⚠️ Cannot execute adaptation: taskInstance or rowId missing');
      return;
    }

    try {
      console.log('[WizardOrchestrator] 🚀 Starting adaptation phase (FASE 9)');
      store.updatePipelineStep('adaptation', 'running', 'Sto adattando i prompt contestuali per personalizzare i messaggi...');

      const { AdaptTaskTreePromptToContext } = await import('@utils/taskTreePromptAdapter');
      await AdaptTaskTreePromptToContext(this.taskInstance, this.config.taskLabel || 'Task', false);

      store.updatePipelineStep('adaptation', 'completed', 'Prompt adattati al contesto');
      console.log('[WizardOrchestrator] ✅ Adaptation phase completed');
    } catch (err) {
      store.updatePipelineStep('adaptation', 'error', `Errore durante adattamento: ${err instanceof Error ? err.message : String(err)}`);
      console.error('[WizardOrchestrator] ❌ Error in adaptation phase (non-blocking):', err);
    }
  }

  /**
   * @deprecated Use startAdaptation() instead
   * Start wizard in adaptation mode (legacy method - kept for backward compatibility)
   */
  async startAdaptationMode(templateId: string): Promise<void> {
    return this.startAdaptation(templateId);
  }

  /**
   * @deprecated Use confirmStructure() instead (now unified for both modes)
   * Confirm structure in adaptation mode (legacy method - kept for backward compatibility)
   */
  async confirmStructureForAdaptation(): Promise<void> {
    return this.confirmStructure();
  }

  /**
   * Reject structure
   * ONLY entry point for structure rejection
   */
  rejectStructure(): void {
    const store = this.getStore();
    store.setWizardState(WizardMode.DATA_STRUCTURE_CORRECTION);
  }

  /**
   * Reset wizard
   * ONLY entry point for reset
   */
  reset(): void {
    this.hasStarted = false;
    this.instanceRunMode = 'none'; // ✅ Reset instance flag
    const store = this.getStore();
    store.reset();
  }

  /**
   * Show module list
   * ONLY entry point for module list
   */
  showModuleList(): void {
    const store = this.getStore();
    store.setWizardState(WizardMode.LISTA_MODULI);
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
      store.setWizardState(WizardMode.DATA_STRUCTURE_PROPOSED);
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
    store.setWizardState(WizardMode.DATA_STRUCTURE_PROPOSED);
  }
}

/**
 * Hook to use Wizard Orchestrator
 */
export function useWizardOrchestrator(config: WizardOrchestratorConfig) {
  const store = useWizardStore();
  const orchestratorRef = React.useRef<WizardOrchestrator | null>(null);

  // ✅ Create orchestrator instance only once
  if (!orchestratorRef.current) {
    orchestratorRef.current = new WizardOrchestrator(config);
  }

  const orchestrator = orchestratorRef.current;

    return {
    // State (read-only)
    wizardMode: store.wizardState, // ✅ RINOMINATO: wizardMode → wizardState (per backward compatibility, esponiamo ancora come wizardMode)
    currentStep: store.currentStep,
    pipelineSteps: store.pipelineSteps,
    dataSchema: store.dataSchema,
    showStructureConfirmation: store.showStructureConfirmation(),
    structureConfirmed: useWizardStore.getState().structureConfirmed, // ✅ Direct field access
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
    availableModules: [], // NOTE: Module system not yet implemented - placeholder for future feature
    foundModuleId: store.selectedModuleId,
    // ✅ NEW: Phase counters (source of truth for progress)
    phaseCounters: store.phaseCounters,

    // Actions (only through orchestrator)
    start: orchestrator.start.bind(orchestrator), // @deprecated - use startFull
    startFull: orchestrator.startFull.bind(orchestrator),
    startAdaptation: orchestrator.startAdaptation.bind(orchestrator),
    startAdaptationMode: orchestrator.startAdaptationMode.bind(orchestrator), // @deprecated - use startAdaptation
    confirmStructure: orchestrator.confirmStructure.bind(orchestrator),
    confirmStructureForAdaptation: orchestrator.confirmStructureForAdaptation.bind(orchestrator), // @deprecated - use confirmStructure
    rejectStructure: orchestrator.rejectStructure.bind(orchestrator),
    reset: orchestrator.reset.bind(orchestrator),
    showModuleList: orchestrator.showModuleList.bind(orchestrator),
    selectModule: orchestrator.selectModule.bind(orchestrator),
    proceedFromEuristica: orchestrator.proceedFromEuristica.bind(orchestrator),
    setCorrectionInput: store.setCorrectionInput,
    setActiveNodeId: store.setActiveNodeId,

    // ✅ NEW: Expose runMode from store
    runMode: store.runMode,
  };
}
