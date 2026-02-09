// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useState, useCallback, useEffect } from 'react';
import { useWizardState } from '../../../../../TaskBuilderAIWizard/hooks/useWizardState';
import { useSimulation } from '../../../../../TaskBuilderAIWizard/hooks/useSimulation';
// MOCK_MODULES removed - use real API endpoint when available
const EMPTY_MODULES: any[] = [];
import { WizardMode } from '../../../../../TaskBuilderAIWizard/types/WizardMode';
import type { WizardTaskTreeNode } from '../../../../../TaskBuilderAIWizard/types';
import type { PipelineStep } from '../../../../../TaskBuilderAIWizard/hooks/useWizardState';
import { generateVariableNames, applyVariableNamesToStructure } from '../../../../../TaskBuilderAIWizard/services/VariableNameGeneratorService';
import { syncTranslationsWithStructure } from '../../../../../TaskBuilderAIWizard/services/TranslationSyncService';
import { syncVariablesWithStructure } from '../../../../../TaskBuilderAIWizard/services/VariableSyncService';
import { flowchartVariablesService } from '@services/FlowchartVariablesService';
import { convertWizardTaskTreeToTaskTree } from '../../../TaskTreeBuilder/TaskBuilderAIWizardAdapter';
import { taskRepository } from '@services/TaskRepository';
import { TaskType } from '@types/taskTypes';
import { createTemplatesFromWizardData, createContextualizedInstance } from '../../../../../TaskBuilderAIWizard/services/TemplateCreationService';
import { DialogueTaskService } from '@services/DialogueTaskService';
import type { WizardConstraint, WizardNLPContract } from '../../../../../TaskBuilderAIWizard/types';
import { buildTaskTree } from '@utils/taskUtils';
import type { TaskTree } from '@types/taskTypes';

/**
 * Hook che integra lo stato del Wizard nel ResponseEditor.
 * Gestisce wizardMode, pipelineSteps, dataSchema, ecc.
 * ✅ NEW: Accetta taskLabel, taskId, rowId, projectId, locale e avvia automaticamente la generazione.
 */
export function useWizardIntegration(
  taskLabel?: string,
  taskId?: string,
  rowId?: string,
  projectId?: string,
  locale: string = 'it',
  onTaskBuilderComplete?: (taskTree: any) => void
) {
  // ✅ Usa gli hook esistenti del Wizard
  const wizardState = useWizardState();
  const simulation = useSimulation({
    locale,
    updatePipelineStep: wizardState.updatePipelineStep,
    setDataSchema: wizardState.setDataSchema,
    setConstraints: wizardState.setConstraints,
    setNlpContract: wizardState.setNlpContract,
    setMessages: wizardState.setMessages,
    setCurrentStep: wizardState.setCurrentStep,
    setShowStructureConfirmation: (show: boolean) => {
      if (show) {
        wizardState.setWizardMode(WizardMode.DATA_STRUCTURE_PROPOSED);
      }
    },
    updateTaskPipelineStatus: wizardState.updateTaskPipelineStatus,
    updateTaskProgress: wizardState.updateTaskProgress,
    // ✅ NEW: Callback per parte variabile dinamica
    updateParserSubstep: wizardState.updateParserSubstep,
    updateMessageSubstep: wizardState.updateMessageSubstep,
    // ✅ NEW: Setter per shouldBeGeneral
    setShouldBeGeneral: wizardState.setShouldBeGeneral,
  });

  // ✅ NEW: Avvia automaticamente la generazione quando taskLabel è disponibile
  useEffect(() => {
    console.log('[useWizardIntegration] 🔍 useEffect triggered', {
      taskLabel,
      taskLabelTrimmed: taskLabel?.trim(),
      taskId,
      rowId,
      projectId,
      wizardMode: wizardState.wizardMode,
      isStart: wizardState.wizardMode === WizardMode.START,
      shouldStart: taskLabel && taskLabel.trim() && wizardState.wizardMode === WizardMode.START,
    });

    if (taskLabel && taskLabel.trim() && wizardState.wizardMode === WizardMode.START) {
      console.log('[useWizardIntegration] 🚀 Avvio automatico generazione con taskLabel:', taskLabel);
      wizardState.setCurrentStep('generazione_struttura');
      console.log('[useWizardIntegration] 📝 Chiamando runGenerationPipeline...');
      simulation.runGenerationPipeline(taskLabel.trim())
        .then(async () => {
          // ✅ Wait a bit for state to update, then get schema from wizardState
          await new Promise(resolve => setTimeout(resolve, 100));
          const schema = wizardState.dataSchema;

          console.log('[useWizardIntegration] ✅ runGenerationPipeline completato, schema ricevuto', {
            schemaLength: schema?.length,
          });

          // ✅ NEW: Genera variabili e sincronizza dopo generazione struttura
          if (schema && schema.length > 0 && taskId && rowId) {
            try {
              console.log('[useWizardIntegration] 🔧 Generando nomi variabili...');

              // 1. Genera readableName e dottedName
              const existingVariables = flowchartVariablesService.getAllReadableNames();
              const variableNames = generateVariableNames(schema, taskLabel.trim(), existingVariables);

              // 2. Applica nomi alla struttura
              applyVariableNamesToStructure(schema, variableNames, taskId);

              console.log('[useWizardIntegration] ✅ Nomi variabili generati e applicati', {
                variableNamesCount: variableNames.size,
              });

              // 3. Sincronizza con Translations (se projectId disponibile)
              if (projectId) {
                console.log('[useWizardIntegration] 🔄 Sincronizzando traduzioni...');
                await syncTranslationsWithStructure(schema, projectId, locale);
                console.log('[useWizardIntegration] ✅ Traduzioni sincronizzate');
              }

              // 4. Sincronizza con FlowchartVariablesService
              console.log('[useWizardIntegration] 🔄 Sincronizzando variabili...');
              await syncVariablesWithStructure(schema, taskId, rowId, taskLabel.trim());
              console.log('[useWizardIntegration] ✅ Variabili sincronizzate');

              // 5. Aggiorna dataSchema con nomi variabili
              wizardState.setDataSchema(schema);
            } catch (error) {
              console.error('[useWizardIntegration] ❌ Errore nella generazione variabili/sincronizzazione:', error);
              // Continua comunque: la struttura è stata generata
            }
          }

          console.log('[useWizardIntegration] ✅ Impostando wizardMode a DATA_STRUCTURE_PROPOSED');
          wizardState.setWizardMode(WizardMode.DATA_STRUCTURE_PROPOSED);
        })
        .catch((error) => {
          console.error('[useWizardIntegration] ❌ Errore in runGenerationPipeline:', error);
        });
    } else {
      console.log('[useWizardIntegration] ⏸️ Condizioni non soddisfatte per avvio automatico', {
        hasTaskLabel: !!taskLabel,
        taskLabelNotEmpty: !!taskLabel?.trim(),
        hasTaskId: !!taskId,
        hasRowId: !!rowId,
        wizardMode: wizardState.wizardMode,
        isStart: wizardState.wizardMode === WizardMode.START,
      });
    }
  }, [taskLabel, taskId, rowId, projectId, locale, wizardState.wizardMode]); // ✅ Aggiunte dipendenze

  // ✅ Handler per conferma struttura
  const handleStructureConfirm = useCallback(async () => {
    console.log('[useWizardIntegration][handleStructureConfirm] 🚀 START', {
      dataSchemaLength: wizardState.dataSchema?.length,
      dataSchema: wizardState.dataSchema?.map(t => ({ id: t.id, label: t.label }))
    });

    // ✅ NEW: Aggiorna messaggio struttura a "Confermata!"
    wizardState.updatePipelineStep('structure', 'completed', 'Confermata!');

    wizardState.setWizardMode(WizardMode.DATA_STRUCTURE_CONFIRMED);

    console.log('[useWizardIntegration][handleStructureConfirm] 📞 Calling continueAfterStructureConfirmation...');
    try {
      await simulation.continueAfterStructureConfirmation(wizardState.dataSchema);
      console.log('[useWizardIntegration][handleStructureConfirm] ✅ continueAfterStructureConfirmation completed');
    } catch (error) {
      console.error('[useWizardIntegration][handleStructureConfirm] ❌ Error in continueAfterStructureConfirmation:', error);
      throw error;
    }

    wizardState.setWizardMode(WizardMode.GENERATING);

    // ✅ NEW: Verifica completamento dopo un breve delay per permettere aggiornamenti di stato
    setTimeout(() => {
      checkAndCloseWizardIfComplete();
    }, 500);
  }, [wizardState, simulation]);

  // ✅ NEW: Verifica se tutti gli step sono completati e chiude il wizard
  const checkAndCloseWizardIfComplete = useCallback(() => {
    const allStepsCompleted = wizardState.pipelineSteps.every(step => step.status === 'completed');

    if (allStepsCompleted && wizardState.wizardMode === WizardMode.GENERATING) {
      console.log('[useWizardIntegration] ✅ Tutti gli step completati, chiudendo wizard e aprendo Behavior Editor');
      wizardState.setWizardMode(WizardMode.COMPLETED);
      // ✅ Il cambio a BEHAVIOUR viene gestito da ResponseEditorLayout quando wizardMode === COMPLETED
    }
  }, [wizardState]);

  // ✅ NEW: Monitora completamento step per auto-chiusura
  useEffect(() => {
    if (wizardState.wizardMode === WizardMode.GENERATING) {
      checkAndCloseWizardIfComplete();
    }
  }, [wizardState.pipelineSteps, wizardState.wizardMode, checkAndCloseWizardIfComplete]);

  // ✅ NEW: Quando wizard completa, crea template e istanza
  useEffect(() => {
    if (wizardState.wizardMode === WizardMode.COMPLETED && wizardState.dataSchema.length > 0) {
      console.log('[useWizardIntegration] 🔄 Wizard completato, creando template e istanza...', {
        dataSchemaLength: wizardState.dataSchema.length,
        dataSchemaStructure: wizardState.dataSchema.map(n => ({
          id: n.id,
          templateId: n.templateId,
          label: n.label,
          hasSubNodes: !!n.subNodes,
          subNodesCount: n.subNodes?.length,
        })),
        hasMessages: !!wizardState.messages,
        hasMessagesGeneralized: !!wizardState.messagesGeneralized,
        hasMessagesContextualized: !!wizardState.messagesContextualized,
        shouldBeGeneral: wizardState.shouldBeGeneral,
        hasConstraints: !!wizardState.constraints,
        hasNlpContract: !!wizardState.nlpContract,
      });

      // ✅ Async function inside useEffect
      const createTemplateAndInstance = async () => {
        try {
        // 1. Raccogli constraints e nlpContracts in mappe (per nodo)
        const constraintsMap = new Map<string, WizardConstraint[]>();
        const nlpContractsMap = new Map<string, WizardNLPContract>();

        const collectNodeData = (nodes: WizardTaskTreeNode[]) => {
          nodes.forEach(node => {
            if (node.constraints && node.constraints.length > 0) {
              constraintsMap.set(node.id, node.constraints);
            }
            if (node.dataContract) {
              nlpContractsMap.set(node.id, node.dataContract);
            }
            if (node.subNodes && node.subNodes.length > 0) {
              collectNodeData(node.subNodes);
            }
          });
        };
        collectNodeData(wizardState.dataSchema);

        // 2. Usa messaggi generalizzati se disponibili, altrimenti usa messaggi normali
        // ✅ messages è ora una mappa Map<nodeId, WizardStepMessages>
        const messagesGeneralized = wizardState.messagesGeneralized.size > 0
          ? wizardState.messagesGeneralized
          : wizardState.messages;

        // 3. Usa messaggi contestualizzati se disponibili, altrimenti usa messaggi normali
        // ✅ messages è ora una mappa Map<nodeId, WizardStepMessages>
        const messagesContextualized = wizardState.messagesContextualized.size > 0
          ? wizardState.messagesContextualized
          : wizardState.messages;

        // 4. Crea template generalizzati (un template per ogni nodo)
        console.log('[useWizardIntegration] 📝 Calling createTemplatesFromWizardData', {
          dataSchemaLength: wizardState.dataSchema.length,
          hasMessagesGeneralized: !!messagesGeneralized,
          constraintsMapSize: constraintsMap.size,
          nlpContractsMapSize: nlpContractsMap.size,
          shouldBeGeneral: wizardState.shouldBeGeneral,
        });

        const templates = createTemplatesFromWizardData(
          wizardState.dataSchema,
          messagesGeneralized,
          constraintsMap,
          nlpContractsMap,
          wizardState.shouldBeGeneral
        );

        console.log('[useWizardIntegration] ✅ Template creati', {
          templatesCount: templates.size,
          templateIds: Array.from(templates.keys()),
          templatesStructure: Array.from(templates.entries()).map(([id, t]) => ({
            id,
            label: t.label,
            stepsKeys: t.steps ? Object.keys(t.steps) : [],
            stepsStructure: t.steps?.[id] ? Object.keys(t.steps[id]) : [],
            firstStepEscalations: t.steps?.[id]?.[Object.keys(t.steps[id] || {})[0]]?.escalations?.length,
          })),
        });

        // 5. Registra template in memoria (DialogueTaskService)
        templates.forEach(template => {
          DialogueTaskService.addTemplate(template);
        });

        console.log('[useWizardIntegration] ✅ Template registrati in memoria');

        // 6. Crea istanza contestualizzata
        const rootNodeTemplateId = wizardState.dataSchema[0].templateId || wizardState.dataSchema[0].id;
        const rootTemplate = templates.get(rootNodeTemplateId);
        if (!rootTemplate) {
          throw new Error(`Root template not found for templateId: ${rootNodeTemplateId}`);
        }

        // ✅ VERIFICA: rootTemplate.id deve essere un GUID valido, non 'root'
        if (!rootTemplate.id || rootTemplate.id === 'root' || rootTemplate.id === 'UNDEFINED') {
          console.error('[useWizardIntegration] ❌ CRITICAL: rootTemplate.id is invalid', {
            rootTemplateId: rootTemplate.id,
            rootNodeTemplateId,
            rootNodeId: wizardState.dataSchema[0].id,
            rootTemplateLabel: rootTemplate.label,
            allTemplateIds: Array.from(templates.keys()),
          });
          throw new Error(`Invalid rootTemplate.id: ${rootTemplate.id}. Expected a valid GUID.`);
        }

        console.log('[useWizardIntegration] ✅ Root template trovato', {
          rootTemplateId: rootTemplate.id,
          rootTemplateLabel: rootTemplate.label,
          rootNodeTemplateId,
          rootNodeId: wizardState.dataSchema[0].id,
        });

        // ✅ Get contextualized messages for root node only
        const rootNodeId = wizardState.dataSchema[0].id;
        const rootContextualizedMessages = messagesContextualized.get(rootNodeId) || {
          ask: { base: [] },
          confirm: { base: [] },
          notConfirmed: { base: [] },
          violation: { base: [] },
          disambiguation: { base: [], options: [] },
          success: { base: [] }
        };

        const instance = createContextualizedInstance(
          rootTemplate,
          templates,
          rootContextualizedMessages,
          taskLabel || 'Task',
          taskId || 'temp-task-id'
        );

        console.log('[useWizardIntegration] ✅ Istanza contestualizzata creata', {
          instanceId: instance.id,
          instanceTemplateId: instance.templateId,
          instanceStepsKeys: instance.steps ? Object.keys(instance.steps) : [],
          instanceStepsStructure: instance.steps && typeof instance.steps === 'object' && !Array.isArray(instance.steps)
            ? Object.keys(instance.steps).map(key => ({
                templateId: key,
                stepTypes: instance.steps[key] ? Object.keys(instance.steps[key]) : [],
              }))
            : [],
        });

        // 7. Salva istanza nel TaskRepository (NON salva template nel DB ancora)
        if (taskId && projectId) {
          const key = taskId;

          // Get or create task instance
          let taskInstance = taskRepository.getTask(key);
          if (!taskInstance) {
            taskInstance = taskRepository.createTask(
              TaskType.UtteranceInterpretation,
              rootTemplate.id,  // ✅ Reference to root template (GUID valido)
              undefined,
              key,
              projectId
            );
          }

          // Update task with instance data
          taskRepository.updateTask(key, {
            ...instance,
            type: TaskType.UtteranceInterpretation,
            templateId: rootTemplate.id,  // ✅ Reference to root template (GUID valido)
          }, projectId);

          console.log('[useWizardIntegration] ✅ Istanza salvata nel TaskRepository', { taskId: key });

          // ✅ FIX: Ricarica taskInstance dopo update per avere gli step aggiornati
          taskInstance = taskRepository.getTask(key);

          console.log('[useWizardIntegration] 🔍 TaskInstance dopo update', {
            taskId: key,
            hasSteps: !!taskInstance?.steps,
            stepsKeys: taskInstance?.steps && typeof taskInstance.steps === 'object' && !Array.isArray(taskInstance.steps)
              ? Object.keys(taskInstance.steps)
              : [],
            instanceStepsKeys: instance.steps ? Object.keys(instance.steps) : [],
            stepsMatch: taskInstance?.steps && typeof taskInstance.steps === 'object' && !Array.isArray(taskInstance.steps)
              ? Object.keys(taskInstance.steps).length === Object.keys(instance.steps || {}).length
              : false,
          });

          // 8. Build TaskTree from instance and call onTaskBuilderComplete
          try {
            const taskTree = await buildTaskTree(taskInstance, projectId);
            if (taskTree && onTaskBuilderComplete) {
              console.log('[useWizardIntegration] 📞 Calling onTaskBuilderComplete with TaskTree', {
                nodesLength: taskTree.nodes?.length || 0,
                stepsKeys: taskTree.steps ? Object.keys(taskTree.steps) : [],
                // ✅ NEW: Verifica mismatch templateId prima di chiamare onTaskBuilderComplete
                templateIdMismatch: taskTree.nodes?.length > 0 && taskTree.steps && typeof taskTree.steps === 'object' && !Array.isArray(taskTree.steps)
                  ? {
                      nodeTemplateId: taskTree.nodes[0].templateId,
                      stepsTemplateIds: Object.keys(taskTree.steps),
                      match: Object.keys(taskTree.steps).includes(taskTree.nodes[0].templateId || ''),
                      nodeId: taskTree.nodes[0].id,
                      nodeLabel: taskTree.nodes[0].label,
                    }
                  : null,
                instanceTemplateId: taskInstance.templateId,
                instanceStepsKeys: taskInstance.steps && typeof taskInstance.steps === 'object' && !Array.isArray(taskInstance.steps)
                  ? Object.keys(taskInstance.steps)
                  : [],
              });
              onTaskBuilderComplete(taskTree);
            }
          } catch (error) {
            console.error('[useWizardIntegration] ❌ Errore nel buildTaskTree:', error);
          }
        } else {
          console.warn('[useWizardIntegration] ⚠️ taskId o projectId mancanti, istanza non salvata', {
            taskId,
            projectId,
          });
        }
        } catch (error) {
          console.error('[useWizardIntegration] ❌ Errore nella creazione template/istanza:', {
            error,
            errorMessage: error instanceof Error ? error.message : String(error),
            errorStack: error instanceof Error ? error.stack : undefined,
            dataSchemaLength: wizardState.dataSchema.length,
            dataSchemaStructure: wizardState.dataSchema.map(n => ({
              id: n.id,
              templateId: n.templateId,
              label: n.label,
            })),
            hasMessagesGeneralized: !!wizardState.messagesGeneralized,
            hasMessagesContextualized: !!wizardState.messagesContextualized,
          });
        }
      };

      // ✅ Call async function
      createTemplateAndInstance();
    }
  }, [wizardState.wizardMode, wizardState.dataSchema, wizardState.messages, wizardState.messagesGeneralized, wizardState.messagesContextualized, wizardState.shouldBeGeneral, taskId, projectId, taskLabel, onTaskBuilderComplete]);

  // ✅ Handler per rifiuto struttura
  const handleStructureReject = useCallback(() => {
    wizardState.setWizardMode(WizardMode.DATA_STRUCTURE_CORRECTION);
  }, [wizardState]);

  return {
    // ✅ NEW: Enum unico
    wizardMode: wizardState.wizardMode,

    // Stato pipeline
    pipelineSteps: wizardState.pipelineSteps,
    dataSchema: wizardState.dataSchema,
    currentStep: wizardState.currentStep, // DEPRECATED: mantenuto per compatibilità

    // Stato conferma struttura (derivato da wizardMode)
    showStructureConfirmation: wizardState.showStructureConfirmation,
    structureConfirmed: wizardState.structureConfirmed,
    showCorrectionMode: wizardState.showCorrectionMode,
    correctionInput: wizardState.correctionInput,
    setCorrectionInput: wizardState.setCorrectionInput,

    // Handlers
    handleStructureConfirm,
    handleStructureReject,
    runGenerationPipeline: simulation.runGenerationPipeline,

    // Altri dati wizard
    messages: wizardState.messages,
    messagesGeneralized: wizardState.messagesGeneralized,
    messagesContextualized: wizardState.messagesContextualized,
    shouldBeGeneral: wizardState.shouldBeGeneral,
    // ✅ NEW: Generalization fields from root node
    generalizedLabel: wizardState.dataSchema?.[0]?.generalizedLabel || null,
    generalizationReason: wizardState.dataSchema?.[0]?.generalizationReason || null,
    generalizedMessages: wizardState.dataSchema?.[0]?.generalizedMessages || null,
    constraints: wizardState.constraints,
    nlpContract: wizardState.nlpContract,

    // Altri metodi wizard (per estendere wizardProps)
    onProceedFromEuristica: async () => {
      if (taskLabel) {
        wizardState.setWizardMode(WizardMode.START);
        wizardState.setCurrentStep('generazione_struttura');
        await simulation.runGenerationPipeline(taskLabel.trim());
        wizardState.setWizardMode(WizardMode.DATA_STRUCTURE_PROPOSED);
      }
    },
    onShowModuleList: () => {
      wizardState.setWizardMode(WizardMode.LISTA_MODULI);
      wizardState.setCurrentStep('lista_moduli');
    },
    onSelectModule: async (moduleId: string) => {
      if (taskLabel) {
        wizardState.setSelectedModuleId(moduleId);
        wizardState.setWizardMode(WizardMode.START);
        wizardState.setCurrentStep('generazione_struttura');
        await simulation.runGenerationPipeline(taskLabel.trim());
        wizardState.setWizardMode(WizardMode.DATA_STRUCTURE_PROPOSED);
      }
    },
    onPreviewModule: wizardState.setActiveNodeId,
    availableModules: EMPTY_MODULES,
    foundModuleId: wizardState.selectedModuleId,
  };
}
