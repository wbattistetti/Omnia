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

  const hasCreatedTemplateRef = useRef(false);

  /**
   * Crea template e istanza quando il wizard è completato
   */
  const createTemplateAndInstance = useCallback(async () => {
    if (wizardMode !== WizardMode.COMPLETED || dataSchema.length === 0 || hasCreatedTemplateRef.current) {
      return;
    }

    hasCreatedTemplateRef.current = true;

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
      templates.forEach(template => {
        DialogueTaskService.addTemplate(template);
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

      // Get contextualized messages for root node only
      const rootNodeId = dataSchema[0].id;
      const rootContextualizedMessages = messagesContextualizedToUse.get(rootNodeId) || {
        ask: { base: [] },
        confirm: { base: [] },
        notConfirmed: { base: [] },
        violation: { base: [] },
        disambiguation: { base: [], options: [] },
        success: { base: [] }
      };

      // ✅ CRITICAL: rowId MUST be provided (it equals row.id which equals task.id)
      if (!rowId) {
        throw new Error('[useWizardCompletion] CRITICAL: rowId is required. It must equal row.id (which equals task.id when task exists).');
      }

      const instance = createContextualizedInstance(
        rootTemplate,
        templates,
        rootContextualizedMessages,
        taskLabel || 'Task',
        rowId, // ✅ ALWAYS equals row.id (which equals task.id when task exists)
        addTranslation
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
        taskRepository.updateTask(key, {
          ...instance,
          type: TaskType.UtteranceInterpretation,
          templateId: rootTemplate.id,
        }, projectId);

        // Ricarica taskInstance dopo update
        taskInstance = taskRepository.getTask(key);

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
        try {
          const taskTree = await buildTaskTree(taskInstance, projectId);
          if (taskTree && onTaskBuilderComplete) {
            onTaskBuilderComplete(taskTree);
          }
        } catch (error) {
          // Error in buildTaskTree
        }
      }
    } catch (error) {
      // Error in template/instance creation
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
    onTaskBuilderComplete,
  ]);

  /**
   * Verifica se tutti gli step sono completati e transiziona a COMPLETED
   * ✅ D1: Verifica che tutti i nodi abbiano messaggi e non ci siano nodi falliti
   */
  const checkAndComplete = useCallback((
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
      transitionToCompleted();
    } else if (hasFailedNodes) {
      // ✅ D1: Log ma NON bloccare - l'utente può fare retry manuale
    } else if (!allNodesHaveMessages) {
      // ✅ D1: Log se mancano messaggi
    }
  }, [transitionToCompleted]);

  return {
    createTemplateAndInstance,
    checkAndComplete,
  };
}
