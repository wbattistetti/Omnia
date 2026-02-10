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

      // ✅ LOGGING PLAN D: Log during completion phase
      console.log('[useWizardCompletion][createTemplateAndInstance] 📊 LOGGING PLAN D: Starting completion phase', {
        wizardMode,
        dataSchemaLength: dataSchema.length,
        dataSchemaNodes: dataSchema.map(n => ({
          id: n.id,
          templateId: n.templateId,
          label: n.label,
          type: n.type,
          hasSubNodes: !!n.subNodes,
          subNodesCount: n.subNodes?.length || 0,
          idMatchesTemplateId: n.id === n.templateId,
        })),
        messagesSize: messages.size,
        messagesGeneralizedSize: messagesGeneralized.size,
        messagesContextualizedSize: messagesContextualized.size,
        messagesKeys: Array.from(messages.keys()),
        messagesGeneralizedKeys: Array.from(messagesGeneralized.keys()),
        messagesContextualizedKeys: Array.from(messagesContextualized.keys()),
        shouldBeGeneral,
      });

      // 2. Usa messaggi generalizzati se disponibili, altrimenti usa messaggi normali
      const messagesToUse = messagesGeneralized.size > 0 ? messagesGeneralized : messages;

      // ✅ D2: Verifica PRE-CONDIZIONE: Tutti i nodi devono avere messaggi
      const allNodes = flattenTaskTree(dataSchema);
      const nodesWithoutMessages = allNodes.filter(node => !messagesToUse.has(node.id));

      if (nodesWithoutMessages.length > 0) {
        const errorMessage = `Cannot create templates: ${nodesWithoutMessages.length} nodes are missing messages. ` +
          `Nodes: ${nodesWithoutMessages.map(n => n.label).join(', ')}. ` +
          `This should never happen if checkAndComplete is working correctly.`;

        console.error('[useWizardCompletion][createTemplateAndInstance] ❌ CRITICAL: Nodes missing messages', {
          nodesWithoutMessages: nodesWithoutMessages.map(n => ({
            id: n.id,
            label: n.label,
            templateId: n.templateId,
          })),
          totalNodes: allNodes.length,
          nodesWithMessages: allNodes.length - nodesWithoutMessages.length,
        });

        // ✅ D2: NON chiamare TemplateCreationService se ci sono nodi incompleti
        throw new Error(errorMessage);
      }

      // ✅ LOGGING PLAN D: Log which messages will be used (all nodes have messages now)
      const allNodeIds = new Set<string>();
      allNodes.forEach(node => allNodeIds.add(node.id));
      const nodesWithMessages = new Set(messagesToUse.keys());

      console.log('[useWizardCompletion][createTemplateAndInstance] 📊 LOGGING PLAN D: Message availability analysis', {
        messagesGeneralizedSize: messagesGeneralized.size,
        messagesSize: messages.size,
        messagesToUseSize: messagesToUse.size,
        totalNodes: allNodeIds.size,
        nodesWithMessages: nodesWithMessages.size,
        nodesWithoutMessages: 0, // ✅ All nodes have messages now
        messagesGeneralizedKeys: Array.from(messagesGeneralized.keys()),
        messagesKeys: Array.from(messages.keys()),
        messagesToUseKeys: Array.from(messagesToUse.keys()),
        dataSchemaNodeIds: Array.from(allNodeIds),
      });

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
        shouldBeGeneral
      );

      // ✅ LOGGING PLAN D: Log template creation results
      console.log('[useWizardCompletion][createTemplateAndInstance] 📊 LOGGING PLAN D: Template creation completed', {
        templatesCreated: templates.size,
        templateIds: Array.from(templates.keys()),
        templatesStructure: Array.from(templates.entries()).map(([id, t]) => ({
          id,
          label: t.label,
          stepsKeys: t.steps ? Object.keys(t.steps) : [],
          hasSubTasks: !!t.subTasksIds && t.subTasksIds.length > 0,
          subTasksIds: t.subTasksIds || [],
        })),
        nodesWithoutTemplates: Array.from(allNodeIds).filter(id => !templates.has(id)).map(id => {
          const node = findNodeById(dataSchema, id);
          return {
            id,
            label: node?.label || 'UNKNOWN',
            templateId: node?.templateId,
          };
        }),
      });

      // 5. Registra template in memoria (DialogueTaskService)
      templates.forEach(template => {
        DialogueTaskService.addTemplate(template);
      });

      // 6. Crea istanza contestualizzata
      // ✅ INVARIANT CHECK: rootNode.id MUST equal rootNode.templateId
      const rootNode = dataSchema[0];
      if (rootNode.id !== rootNode.templateId) {
        console.error('[useWizardCompletion][createTemplateAndInstance] ❌ CRITICAL: rootNode.id !== rootNode.templateId', {
          rootNodeId: rootNode.id,
          rootNodeTemplateId: rootNode.templateId,
          rootNodeLabel: rootNode.label,
        });
        throw new Error(
          `[useWizardCompletion] CRITICAL: rootNode.id (${rootNode.id}) !== rootNode.templateId (${rootNode.templateId}) for rootNode "${rootNode.label}". ` +
          `This should never happen. The ID must be consistent throughout the wizard lifecycle.`
        );
      }

      // ✅ ALWAYS use rootNode.id (no fallback)
      const rootNodeTemplateId = rootNode.id;
      const rootTemplate = templates.get(rootNodeTemplateId);
      if (!rootTemplate) {
        console.error('[useWizardCompletion][createTemplateAndInstance] ❌ CRITICAL: Root template not found', {
          rootNodeTemplateId,
          rootNodeId: rootNode.id,
          rootNodeLabel: rootNode.label,
          availableTemplateIds: Array.from(templates.keys()),
        });
        throw new Error(
          `[useWizardCompletion] CRITICAL: Root template not found for id: ${rootNodeTemplateId}. ` +
          `Available template IDs: ${Array.from(templates.keys()).join(', ')}. ` +
          `This means the root node template was not created in createTemplatesFromWizardData.`
        );
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

        // ✅ LOGGING PLAN G: Final pipeline summary log (before building TaskTree)
        const allNodesFinal = flattenTaskTree(dataSchema);
        const allNodeIdsFinal = new Set<string>();
        allNodesFinal.forEach(node => allNodeIdsFinal.add(node.id));
        const finalNodesWithTemplates = Array.from(templates.keys());
        const finalNodesWithoutTemplates = Array.from(allNodeIdsFinal).filter(id => !templates.has(id));
        const finalNodesWithMessages = Array.from(messagesToUse.keys());
        const finalNodesWithoutMessages = Array.from(allNodeIdsFinal).filter(id => !finalNodesWithMessages.includes(id));

        console.log('[useWizardCompletion][createTemplateAndInstance] 📊 LOGGING PLAN G: Final pipeline summary', {
          totalNodes: allNodeIdsFinal.size,
          totalTemplatesCreated: templates.size,
          totalNodesWithMessages: finalNodesWithMessages.length,
          totalNodesWithoutMessages: finalNodesWithoutMessages.length,
          totalNodesWithoutTemplates: finalNodesWithoutTemplates.length,
          nodesWithoutTemplates: finalNodesWithoutTemplates.map(id => {
            const node = findNodeById(dataSchema, id);
            return {
              id,
              label: node?.label || 'UNKNOWN',
              templateId: node?.templateId,
            };
          }),
          nodesWithoutMessages: finalNodesWithoutMessages.map(id => {
            const node = findNodeById(dataSchema, id);
            return {
              id,
              label: node?.label || 'UNKNOWN',
              templateId: node?.templateId,
            };
          }),
          idMismatches: dataSchema.flatMap(n => {
            const mismatches: Array<{ id: string; templateId: string; label: string }> = [];
            if (n.id !== n.templateId) {
              mismatches.push({ id: n.id, templateId: n.templateId, label: n.label });
            }
            if (n.subNodes) {
              n.subNodes.forEach(sub => {
                if (sub.id !== sub.templateId) {
                  mismatches.push({ id: sub.id, templateId: sub.templateId, label: sub.label });
                }
              });
            }
            return mismatches;
          }),
          wizardCompleted: true,
          taskLabel,
          taskId,
          projectId,
        });

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
      console.warn('[useWizardCompletion][checkAndComplete] ⚠️ Pipeline blocked: some nodes failed', {
        failedNodes: allNodes.filter(node =>
          node.pipelineStatus?.constraints === 'failed' ||
          node.pipelineStatus?.parser === 'failed' ||
          node.pipelineStatus?.messages === 'failed'
        ).map(n => ({ id: n.id, label: n.label }))
      });
    } else if (!allNodesHaveMessages) {
      // ✅ D1: Log se mancano messaggi
      const nodesWithoutMessages = allNodes.filter(node => !messagesToCheck.has(node.id));
      console.warn('[useWizardCompletion][checkAndComplete] ⚠️ Pipeline blocked: some nodes missing messages', {
        nodesWithoutMessages: nodesWithoutMessages.map(n => ({ id: n.id, label: n.label }))
      });
    }
  }, [transitionToCompleted]);

  return {
    createTemplateAndInstance,
    checkAndComplete,
  };
}
