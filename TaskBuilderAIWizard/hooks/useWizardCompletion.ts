// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useCallback, useRef } from 'react';
import type { WizardTaskTreeNode } from '../types';
import type { WizardConstraint, WizardNLPContract } from '../types';
import { createTemplatesFromWizardData, createContextualizedInstance } from '../services/TemplateCreationService';
import { DialogueTaskService } from '@services/DialogueTaskService';
import { taskRepository } from '@services/TaskRepository';
import { TaskType } from '@types/taskTypes';
import { buildTaskTree } from '@utils/taskUtils';
import { WizardMode } from '../types/WizardMode';
import { useProjectTranslations } from '@context/ProjectTranslationsContext';

// ✅ Helper function for logging plan D
function findNodeById(nodes: WizardTaskTreeNode[], id: string): WizardTaskTreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.subNodes) {
      const found = findNodeById(node.subNodes, id);
      if (found) return found;
    }
  }
  return null;
}

// ✅ D1: Helper function to flatten task tree for verification
function flattenTaskTree(nodes: WizardTaskTreeNode[]): WizardTaskTreeNode[] {
  const result: WizardTaskTreeNode[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.subNodes && node.subNodes.length > 0) {
      result.push(...flattenTaskTree(node.subNodes));
    }
  }
  return result;
}

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
    if (!rowId) {
      console.warn('[useWizardCompletion] ⚠️ Cannot create template+instance for proposed: rowId is required');
      // ✅ CRITICAL: Chiama comunque onFirstStepComplete() per emettere DATA_STRUCTURE_PROPOSED
      // I pulsanti "Sì"/"No" devono apparire anche se non possiamo creare template+istanza
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
      collectNodeData(dataSchema);

      // 2. Usa messaggi generalizzati se disponibili, altrimenti usa messaggi normali
      // ✅ Per il primo step, potrebbero non esserci ancora messaggi - usiamo messaggi vuoti come fallback
      const messagesToUse = messagesGeneralized.size > 0 ? messagesGeneralized : messages;

      // ✅ Se non ci sono messaggi, crea messaggi vuoti per ogni nodo (saranno generati dopo)
      const allNodes = flattenTaskTree(dataSchema);
      allNodes.forEach(node => {
        if (!messagesToUse.has(node.id)) {
          messagesToUse.set(node.id, {
            ask: { base: [] },
            confirm: { base: [] },
            notConfirmed: { base: [] },
            violation: { base: [] },
            disambiguation: { base: [], options: [] },
            success: { base: [] }
          });
        }
      });

      // 3. Usa messaggi contestualizzati se disponibili, altrimenti usa messaggi normali
      const messagesContextualizedToUse = messagesContextualized.size > 0 ? messagesContextualized : messages;

      // 4. Crea template generalizzati (un template per ogni nodo)
      const templates = createTemplatesFromWizardData(
        dataSchema,
        messagesToUse,
        constraintsMap,
        nlpContractsMap,
        shouldBeGeneral,
        addTranslation
      );

      // 5. Registra template in memoria (DialogueTaskService)
      console.log('[useWizardCompletion] 📝 FIRST STEP: Adding templates to memory cache', {
        templatesCount: templates.size,
        templateIds: Array.from(templates.keys())
      });

      templates.forEach(template => {
        DialogueTaskService.addTemplate(template);
      });

      // 6. Crea istanza contestualizzata
      const rootNode = dataSchema[0];
      const rootNodeTemplateId = rootNode.id;
      const rootTemplate = templates.get(rootNodeTemplateId);

      if (!rootTemplate) {
        console.error('[useWizardCompletion] ❌ FIRST STEP: Root template not found', {
          rootNodeTemplateId,
          availableTemplateIds: Array.from(templates.keys())
        });
        // ✅ CRITICAL: Chiama comunque onFirstStepComplete() per emettere DATA_STRUCTURE_PROPOSED
        if (onFirstStepComplete) {
          onFirstStepComplete();
        }
        return; // ✅ NON throw - permettere al wizard di continuare
      }

      const instance = await createContextualizedInstance(
        rootTemplate,
        templates,
        messagesContextualizedToUse,
        taskLabel || 'Task',
        rowId,
        addTranslation,
        adaptAllNormalSteps
      );

      // 7. Salva istanza nel TaskRepository
      if (rowId && projectId) {
        const key = rowId;
        let taskInstance = taskRepository.getTask(key);
        if (!taskInstance) {
          taskInstance = taskRepository.createTask(
            TaskType.UtteranceInterpretation,
            rootTemplate.id,
            undefined,
            key,
            projectId
          );
        }

        taskRepository.updateTask(key, {
          ...instance,
          type: TaskType.UtteranceInterpretation,
          templateId: rootTemplate.id,
        }, projectId);

        taskInstance = taskRepository.getTask(key);

        console.log('[useWizardCompletion] ✅ FIRST STEP: Template + instance created', {
          taskId: taskInstance?.id,
          templateId: rootTemplate.id,
          templateInCache: !!DialogueTaskService.getTemplate(rootTemplate.id)
        });

        // 8. Build TaskTree from instance (tollerante - non blocca se fallisce)
        console.log('[useWizardCompletion] 🔍 FIRST STEP: About to build TaskTree', {
          taskInstanceId: taskInstance?.id,
          taskInstanceTemplateId: taskInstance?.templateId,
          rootTemplateId: rootTemplate.id,
          templateInCache: !!DialogueTaskService.getTemplate(rootTemplate.id),
          projectId
        });
        try {
          const taskTree = await buildTaskTree(taskInstance, projectId);
          console.log('[useWizardCompletion] 🔍 FIRST STEP: buildTaskTree result', {
            hasTaskTree: !!taskTree,
            taskTreeNodesCount: taskTree?.nodes?.length || 0,
            taskTreeId: taskTree?.id,
            hasOnTaskBuilderComplete: !!onTaskBuilderComplete
          });
          if (taskTree && onTaskBuilderComplete) {
            console.log('[useWizardCompletion] ✅ FIRST STEP: TaskTree built, calling onTaskBuilderComplete', {
              taskTreeNodesCount: taskTree.nodes?.length || 0,
              taskTreeId: taskTree.id
            });
            onTaskBuilderComplete(taskTree);
          } else {
            console.warn('[useWizardCompletion] ⚠️ FIRST STEP: TaskTree not built or onTaskBuilderComplete not provided', {
              hasTaskTree: !!taskTree,
              hasOnTaskBuilderComplete: !!onTaskBuilderComplete
            });
          }
        } catch (error) {
          // ✅ Tollerante: logga warning ma non blocca il flusso
          console.error('[useWizardCompletion] ❌ FIRST STEP: Error building TaskTree (non-blocking)', {
            error: error instanceof Error ? error.message : String(error),
            errorStack: error instanceof Error ? error.stack : undefined,
            rootTemplateId: rootTemplate.id,
            taskInstanceId: taskInstance?.id,
            templateInCache: !!DialogueTaskService.getTemplate(rootTemplate.id)
          });
        }

        // 9. Segnala che il primo step è completato
        if (onFirstStepComplete) {
          console.log('[useWizardCompletion] ✅ FIRST STEP: Complete - signaling onFirstStepComplete');
          onFirstStepComplete();
        }
      }
    } catch (error) {
      // ✅ Tollerante: logga errore ma non blocca il flusso
      console.error('[useWizardCompletion] ❌ FIRST STEP: Error (non-blocking)', {
        error: error instanceof Error ? error.message : String(error)
      });
      // ✅ CRITICAL: Chiama comunque onFirstStepComplete() per emettere DATA_STRUCTURE_PROPOSED
      // I pulsanti "Sì"/"No" devono apparire anche se c'è un errore
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
        wizardModeString: wizardMode ? String(wizardMode) : 'undefined',
        wizardModeEqualsGenerating: wizardMode === WizardMode.GENERATING,
        dataSchemaLength: dataSchema.length,
        hasCreatedTemplateForCompleted: hasCreatedTemplateForCompletedRef.current
      });
      return;
    }

    hasCreatedTemplateForCompletedRef.current = true;
    console.log('[useWizardCompletion] ✅ createTemplateAndInstanceForCompleted - Guard passed, proceeding');

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
      collectNodeData(dataSchema);

      // ✅ LOGGING PLAN D: Log during completion phase

      // 2. Usa messaggi generalizzati se disponibili, altrimenti usa messaggi normali
      const messagesToUse = messagesGeneralized.size > 0 ? messagesGeneralized : messages;

      // ✅ D2: Verifica PRE-CONDIZIONE: Tutti i nodi devono avere messaggi
      const allNodes = flattenTaskTree(dataSchema);
      const nodesWithoutMessages = allNodes.filter(node => !messagesToUse.has(node.id));

      if (nodesWithoutMessages.length > 0) {
        const errorMessage = `Cannot create templates: ${nodesWithoutMessages.length} nodes are missing messages. ` +
          `Nodes: ${nodesWithoutMessages.map(n => n.label).join(', ')}. ` +
          `This should never happen if checkAndComplete is working correctly.`;


        // ✅ D2: NON chiamare TemplateCreationService se ci sono nodi incompleti
        throw new Error(errorMessage);
      }

      // ✅ LOGGING PLAN D: Log which messages will be used (all nodes have messages now)
      const allNodeIds = new Set<string>();
      allNodes.forEach(node => allNodeIds.add(node.id));
      const nodesWithMessages = new Set(messagesToUse.keys());


      // 3. Usa messaggi contestualizzati se disponibili, altrimenti usa messaggi normali
      const messagesContextualizedToUse = messagesContextualized.size > 0 ? messagesContextualized : messages;

      // ✅ D2: Se arriviamo qui, TUTTI i nodi hanno messaggi
      // TemplateCreationService può assumere nodi completi
      // 4. Crea template generalizzati (un template per ogni nodo)
      const templates = createTemplatesFromWizardData(
        dataSchema,
        messagesToUse,
        constraintsMap,
        nlpContractsMap,
        shouldBeGeneral,
        addTranslation
      );


      // 5. Registra template in memoria (DialogueTaskService)
      console.log('[useWizardCompletion] 📝 Adding templates to memory cache', {
        templatesCount: templates.size,
        templateIds: Array.from(templates.keys()),
        templateDetails: Array.from(templates.entries()).map(([id, template]) => ({
          id: template.id,
          _id: template._id,
          label: template.label,
          name: template.name
        }))
      });

      templates.forEach(template => {
        DialogueTaskService.addTemplate(template);
        console.log('[useWizardCompletion] ✅ Template added to cache', {
          templateId: template.id || template._id,
          templateLabel: template.label,
          cacheSize: DialogueTaskService.getTemplateCount()
        });
      });

      // 6. Crea istanza contestualizzata
      // ✅ INVARIANT CHECK: rootNode.id MUST equal rootNode.templateId
      const rootNode = dataSchema[0];
      if (rootNode.id !== rootNode.templateId) {
        throw new Error(
          `[useWizardCompletion] CRITICAL: rootNode.id (${rootNode.id}) !== rootNode.templateId (${rootNode.templateId}) for rootNode "${rootNode.label}". ` +
          `This should never happen. The ID must be consistent throughout the wizard lifecycle.`
        );
      }

      // ✅ ALWAYS use rootNode.id (no fallback)
      const rootNodeTemplateId = rootNode.id;
      const rootTemplate = templates.get(rootNodeTemplateId);

      console.log('[useWizardCompletion] ✅ All templates added to cache', {
        totalTemplates: templates.size,
        cacheSize: DialogueTaskService.getTemplateCount(),
        rootTemplateId: rootTemplate?.id || rootNodeTemplateId
      });
      if (!rootTemplate) {
        throw new Error(
          `[useWizardCompletion] CRITICAL: Root template not found for id: ${rootNodeTemplateId}. ` +
          `Available template IDs: ${Array.from(templates.keys()).join(', ')}. ` +
          `This means the root node template was not created in createTemplatesFromWizardData.`
        );
      }

      // Verifica: rootTemplate.id deve essere un GUID valido
      if (!rootTemplate.id || rootTemplate.id === 'root' || rootTemplate.id === 'UNDEFINED') {
        throw new Error(`Invalid rootTemplate.id: ${rootTemplate.id}. Expected a valid GUID.`);
      }

      // ✅ CRITICAL: rowId MUST be provided (it equals row.id which equals task.id)
      if (!rowId) {
        throw new Error('[useWizardCompletion] CRITICAL: rowId is required. It must equal row.id (which equals task.id when task exists).');
      }

      // ✅ NEW: Pass entire messagesContextualizedToUse Map instead of only root messages
      // If adaptAllNormalSteps = true, contextualize all nodes; if false, only root node
      const instance = await createContextualizedInstance(
        rootTemplate,
        templates,
        messagesContextualizedToUse, // ✅ Pass entire Map instead of only root messages
        taskLabel || 'Task',
        rowId, // ✅ ALWAYS equals row.id (which equals task.id when task exists)
        addTranslation,
        adaptAllNormalSteps // ✅ Pass flag to control contextualization scope
      );

      // 7. Salva istanza nel TaskRepository
      if (rowId && projectId) {
        const key = rowId; // ✅ ALWAYS equals row.id (which equals task.id when task exists)

        // Get or create task instance
        let taskInstance = taskRepository.getTask(key);
        if (!taskInstance) {
          taskInstance = taskRepository.createTask(
            TaskType.UtteranceInterpretation,
            rootTemplate.id,
            undefined,
            key,
            projectId
          );
        }

        // Update task with instance data
        console.log('[useWizardCompletion] 💾 Saving task instance', {
          taskId: key,
          templateId: rootTemplate.id,
          templateIdType: typeof rootTemplate.id,
          instanceTemplateId: instance.templateId,
          instanceTemplateIdType: typeof instance.templateId,
          templatesMatch: rootTemplate.id === instance.templateId
        });

        // ✅ FLOW TRACE: Creating instance
        console.log('[useWizardCompletion] 🚀 FLOW TRACE - Creating instance', {
          taskId: key,
          templateId: rootTemplate.id,
          rootTemplateLabel: rootTemplate.label,
          instanceTemplateId: instance.templateId,
          cacheSize: DialogueTaskService.getTemplateCount(),
          templateInCache: !!DialogueTaskService.getTemplate(rootTemplate.id),
        });

        taskRepository.updateTask(key, {
          ...instance,
          type: TaskType.UtteranceInterpretation,
          templateId: rootTemplate.id, // ✅ CRITICAL: Use rootTemplate.id (must match template in cache)
        }, projectId);

        // Ricarica taskInstance dopo update
        taskInstance = taskRepository.getTask(key);

        // ✅ FLOW TRACE: Instance created
        console.log('[useWizardCompletion] ✅ FLOW TRACE - Instance created', {
          taskId: key,
          savedTemplateId: taskInstance?.templateId,
          isInstance: !!taskInstance?.templateId,
          rootTemplateId: rootTemplate.id,
          idsMatch: taskInstance?.templateId === rootTemplate.id,
          templateInCache: !!DialogueTaskService.getTemplate(rootTemplate.id),
        });

        // ✅ LOGGING PLAN G: Final pipeline summary log (before building TaskTree)
        const allNodesFinal = flattenTaskTree(dataSchema);
        const allNodeIdsFinal = new Set<string>();
        allNodesFinal.forEach(node => allNodeIdsFinal.add(node.id));
        const finalNodesWithTemplates = Array.from(templates.keys());
        const finalNodesWithoutTemplates = Array.from(allNodeIdsFinal).filter(id => !templates.has(id));
        const finalNodesWithMessages = Array.from(messagesToUse.keys());
        const finalNodesWithoutMessages = Array.from(allNodeIdsFinal).filter(id => !finalNodesWithMessages.includes(id));

        // ✅ LOG: WIZARD CREATION TRACE - Template e Istanza
        console.log('[useWizardCompletion] 🔍 WIZARD CREATION TRACE', {
          // Template creati
          totalTemplates: templates.size,
          templateIds: Array.from(templates.keys()),
          templateDetails: Array.from(templates.entries()).map(([id, template]) => ({
            id,
            label: template.label,
            subTasksIds: template.subTasksIds || [],
          })),
          rootTemplateId: rootTemplate.id,
          rootTemplateLabel: rootTemplate.label,

          // Istanza creata
          instanceId: key,
          rowId: rowId, // ✅ ALWAYS equals row.id (which equals task.id when task exists)
          instanceIdEqualsRowId: key === rowId, // Should always be true
          instanceIdComparison: {
            instanceId: key,
            rowId: rowId,
            areEqual: key === rowId,
            instanceIdLength: key?.length || 0,
            rowIdLength: rowId?.length || 0,
          },

          // Task instance
          taskInstanceId: taskInstance?.id,
          taskInstanceTemplateId: taskInstance?.templateId,
          taskInstanceType: taskInstance?.type,
          taskInstanceHasSteps: taskInstance?.steps ? Object.keys(taskInstance.steps).length > 0 : false,
          taskInstanceStepsKeys: taskInstance?.steps ? Object.keys(taskInstance.steps) : [],

          projectId,
          timestamp: new Date().toISOString(),
        });

        // 8. Build TaskTree from instance and call onTaskBuilderComplete
        // ✅ Tollerante: verifica template in cache, ma non blocca se non trovato
        const templateInCache = DialogueTaskService.getTemplate(rootTemplate.id);
        if (!templateInCache) {
          console.warn('[useWizardCompletion] ⚠️ Template not in cache before buildTaskTree (non-blocking)', {
            rootTemplateId: rootTemplate.id,
            cacheSize: DialogueTaskService.getTemplateCount(),
            allTemplateIds: DialogueTaskService.getAllTemplates().map(t => t.id || t._id)
          });
          // ✅ NON throw - permettere al wizard di continuare
        }

        console.log('[useWizardCompletion] ✅ Template verified in cache, building TaskTree', {
          rootTemplateId: rootTemplate.id,
          taskInstanceId: taskInstance?.id,
          taskInstanceTemplateId: taskInstance?.templateId,
          templateInCache: !!templateInCache
        });

        try {
          const taskTree = await buildTaskTree(taskInstance, projectId);
          if (taskTree && onTaskBuilderComplete) {
            console.log('[useWizardCompletion] ✅ TaskTree built successfully, calling onTaskBuilderComplete', {
              taskTreeNodesCount: taskTree.nodes?.length || 0,
              taskTreeStepsCount: taskTree.steps ? Object.keys(taskTree.steps).length : 0
            });
            onTaskBuilderComplete(taskTree);
          } else {
            console.warn('[useWizardCompletion] ⚠️ TaskTree not built or onTaskBuilderComplete not provided', {
              hasTaskTree: !!taskTree,
              hasOnTaskBuilderComplete: !!onTaskBuilderComplete
            });
          }
        } catch (error) {
          // ✅ Tollerante: logga errore ma non blocca il flusso
          console.warn('[useWizardCompletion] ⚠️ Error building TaskTree (non-blocking)', {
            error: error instanceof Error ? error.message : String(error),
            rootTemplateId: rootTemplate.id,
            taskInstanceId: taskInstance?.id,
            taskInstanceTemplateId: taskInstance?.templateId,
            templateInCache: !!DialogueTaskService.getTemplate(rootTemplate.id)
          });
          // ✅ NON throw - permettere al wizard di completarsi anche se buildTaskTree fallisce
        }
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
    rowId, // ✅ ALWAYS equals row.id (which equals task.id when task exists)
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
  const checkAndComplete = useCallback(async (
    pipelineSteps: Array<{ status: string }>,
    currentWizardMode: WizardMode,
    messagesToCheck: Map<string, any>,
    dataSchemaToCheck: WizardTaskTreeNode[]
  ) => {
    const allStepsCompleted = pipelineSteps.every(step => step.status === 'completed');

    // ✅ D1: Verifica che tutti i nodi abbiano messaggi
    const allNodes = flattenTaskTree(dataSchemaToCheck);
    const nodesWithMessages = allNodes.filter(node => messagesToCheck.has(node.id));
    const allNodesHaveMessages = nodesWithMessages.length === allNodes.length;

    // ✅ Verifica che tutti i nodi abbiano constraints
    const allNodesHaveConstraints = allNodes.every(node =>
      node.constraints && node.constraints.length > 0
    );

    // ✅ Verifica che tutti i nodi abbiano parser
    const allNodesHaveParser = allNodes.every(node =>
      node.dataContract !== undefined
    );

    // ✅ D1: Verifica che non ci siano nodi falliti (stato 'failed' sarà aggiunto in Fase C)
    const hasFailedNodes = allNodes.some(node =>
      node.pipelineStatus?.constraints === 'failed' ||
      node.pipelineStatus?.parser === 'failed' ||
      node.pipelineStatus?.messages === 'failed'
    );

    // ✅ D1: Transiziona solo se TUTTE le condizioni sono soddisfatte
    if (
      allStepsCompleted &&
      allNodesHaveMessages &&
      allNodesHaveConstraints &&
      allNodesHaveParser &&
      !hasFailedNodes &&
      currentWizardMode === WizardMode.GENERATING
    ) {
      // ✅ CRITICAL: Create template + instance BEFORE transitioning to COMPLETED
      // This ensures taskTree is in store before wizardMode becomes COMPLETED
      // ✅ Use createTemplateAndInstanceForCompleted (separate from first step)
      console.log('[useWizardCompletion] 🚀 All conditions met - creating template + instance BEFORE transition to COMPLETED');
      await createTemplateAndInstanceForCompleted();
      console.log('[useWizardCompletion] ✅ Template + instance created - now transitioning to COMPLETED');
      // ✅ Only after createTemplateAndInstanceForCompleted has finished (and called onTaskBuilderComplete)
      transitionToCompleted();
    } else if (hasFailedNodes) {
      // ✅ D1: Log ma NON bloccare - l'utente può fare retry manuale
    } else if (!allNodesHaveMessages) {
      // ✅ D1: Log se mancano messaggi
    }
  }, [transitionToCompleted, createTemplateAndInstanceForCompleted]);

  return {
    createTemplateAndInstanceForCompleted, // ✅ Function for completion (when all steps are done)
    createTemplateAndInstanceForProposed, // ✅ Function for first step (DATA_STRUCTURE_PROPOSED)
    checkAndComplete,
  };
}
