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

type UseWizardCompletionProps = {
  wizardMode: WizardMode;
  dataSchema: WizardTaskTreeNode[];
  messages: Map<string, any>;
  messagesGeneralized: Map<string, any>;
  messagesContextualized: Map<string, any>;
  shouldBeGeneral: boolean;
  taskLabel?: string;
  taskId?: string;
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
    taskId,
    projectId,
    transitionToCompleted,
    onTaskBuilderComplete,
  } = props;

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

      // 2. Usa messaggi generalizzati se disponibili, altrimenti usa messaggi normali
      const messagesToUse = messagesGeneralized.size > 0 ? messagesGeneralized : messages;

      // 3. Usa messaggi contestualizzati se disponibili, altrimenti usa messaggi normali
      const messagesContextualizedToUse = messagesContextualized.size > 0 ? messagesContextualized : messages;

      // 4. Crea template generalizzati (un template per ogni nodo)
      const templates = createTemplatesFromWizardData(
        dataSchema,
        messagesToUse,
        constraintsMap,
        nlpContractsMap,
        shouldBeGeneral
      );

      // 5. Registra template in memoria (DialogueTaskService)
      templates.forEach(template => {
        DialogueTaskService.addTemplate(template);
      });

      // 6. Crea istanza contestualizzata
      const rootNodeTemplateId = dataSchema[0].templateId || dataSchema[0].id;
      const rootTemplate = templates.get(rootNodeTemplateId);
      if (!rootTemplate) {
        throw new Error(`Root template not found for templateId: ${rootNodeTemplateId}`);
      }

      // Verifica: rootTemplate.id deve essere un GUID valido
      if (!rootTemplate.id || rootTemplate.id === 'root' || rootTemplate.id === 'UNDEFINED') {
        console.error('[useWizardCompletion] ❌ CRITICAL: rootTemplate.id is invalid', {
          rootTemplateId: rootTemplate.id,
          rootNodeTemplateId,
          rootNodeId: dataSchema[0].id,
          rootTemplateLabel: rootTemplate.label,
          allTemplateIds: Array.from(templates.keys()),
        });
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

      const instance = createContextualizedInstance(
        rootTemplate,
        templates,
        rootContextualizedMessages,
        taskLabel || 'Task',
        taskId || 'temp-task-id'
      );

      // 7. Salva istanza nel TaskRepository
      if (taskId && projectId) {
        const key = taskId;

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

        // 8. Build TaskTree from instance and call onTaskBuilderComplete
        try {
          const taskTree = await buildTaskTree(taskInstance, projectId);
          if (taskTree && onTaskBuilderComplete) {
            onTaskBuilderComplete(taskTree);
          }
        } catch (error) {
          console.error('[useWizardCompletion] ❌ Errore nel buildTaskTree:', error);
        }
      } else {
        console.warn('[useWizardCompletion] ⚠️ taskId o projectId mancanti, istanza non salvata', {
          taskId,
          projectId,
        });
      }
    } catch (error) {
      console.error('[useWizardCompletion] ❌ Errore nella creazione template/istanza:', {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        dataSchemaLength: dataSchema.length,
        dataSchemaStructure: dataSchema.map(n => ({
          id: n.id,
          templateId: n.templateId,
          label: n.label,
        })),
        hasMessagesGeneralized: messagesGeneralized.size > 0,
        hasMessagesContextualized: messagesContextualized.size > 0,
      });
    }
  }, [
    wizardMode,
    dataSchema,
    messages,
    messagesGeneralized,
    messagesContextualized,
    shouldBeGeneral,
    taskLabel,
    taskId,
    projectId,
    onTaskBuilderComplete,
  ]);

  /**
   * Verifica se tutti gli step sono completati e transiziona a COMPLETED
   */
  const checkAndComplete = useCallback((
    pipelineSteps: Array<{ status: string }>,
    currentWizardMode: WizardMode
  ) => {
    const allStepsCompleted = pipelineSteps.every(step => step.status === 'completed');

    if (allStepsCompleted && currentWizardMode === WizardMode.GENERATING) {
      transitionToCompleted();
    }
  }, [transitionToCompleted]);

  return {
    createTemplateAndInstance,
    checkAndComplete,
  };
}
