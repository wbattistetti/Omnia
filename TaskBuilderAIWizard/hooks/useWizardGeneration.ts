// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useCallback } from 'react';
import { generateStructure, generateConstraints, generateParsers, generateMessages, calculateTotalParsers } from '../api/simulateEndpoints';
import type { WizardTaskTreeNode, WizardStepMessages } from '../types';
import type { PipelineStep } from './useWizardState';
import { WizardMode } from '../types/WizardMode';
import { useWizardRetry } from './useWizardRetry';

type UseWizardGenerationProps = {
  locale: string;
  dataSchema: WizardTaskTreeNode[];
  setDataSchema: (schema: WizardTaskTreeNode[] | ((prev: WizardTaskTreeNode[]) => WizardTaskTreeNode[])) => void;
  setConstraints: (constraints: any) => void;
  setNlpContract: (contract: any) => void;
  setMessages: (nodeId: string, messages: any) => void;
  setShouldBeGeneral?: (value: boolean) => void;
  updatePipelineStep: (stepId: string, status: PipelineStep['status'], payload?: string) => void;
  setPipelineSteps: (steps: PipelineStep[] | ((prev: PipelineStep[]) => PipelineStep[])) => void;
  updateTaskPipelineStatus: (taskId: string, phase: 'constraints' | 'parser' | 'messages', status: 'pending' | 'running' | 'completed') => void;
  updateTaskProgress: (taskId: string, phase: 'constraints' | 'parser' | 'messages', progress: number) => void;
  updateParserSubstep?: (substep: string | null) => void;
  updateMessageSubstep?: (substep: string | null) => void;
  transitionToProposed: () => void;
  transitionToGenerating: () => void;
};

/**
 * Hook che gestisce SOLO la generazione (struttura + parallela).
 * Nessuna transizione di wizardMode (delegata a useWizardFlow).
 * Nessuna sincronizzazione variabili.
 * Nessuna creazione template.
 */
export function useWizardGeneration(props: UseWizardGenerationProps) {
  const {
    locale,
    dataSchema,
    setDataSchema,
    setConstraints,
    setNlpContract,
    setMessages,
    setShouldBeGeneral,
    updatePipelineStep,
    setPipelineSteps,
    updateTaskPipelineStatus,
    updateTaskProgress,
    updateParserSubstep,
    updateMessageSubstep,
    transitionToProposed,
    transitionToGenerating,
  } = props;

  // ✅ C2: Use retry hook
  const wizardRetry = useWizardRetry();

  /**
   * Raccoglie tutti i nodi dell'albero (root + subtask) in una lista piatta
   */
  const flattenTaskTree = useCallback((nodes: WizardTaskTreeNode[]): WizardTaskTreeNode[] => {
    const result: WizardTaskTreeNode[] = [];
    nodes.forEach(node => {
      result.push(node);
      if (node.subNodes && node.subNodes.length > 0) {
        result.push(...flattenTaskTree(node.subNodes));
      }
    });
    return result;
  }, []);

  /**
   * Calcola lo stato aggregato della pipeline:
   * - pending: se almeno un task è pending
   * - running: se almeno un task è running
   * - completed: solo quando TUTTI i task sono completed
   */
  const calculateAggregatedPipelineStatus = useCallback((currentSchema: WizardTaskTreeNode[], setPipelineSteps: (steps: PipelineStep[] | ((prev: PipelineStep[]) => PipelineStep[])) => void) => {
    const allTasks = flattenTaskTree(currentSchema);

    if (allTasks.length === 0) return;

    const phaseToStepId: Record<string, string> = {
      constraints: 'constraints',
      parser: 'parsers',
      messages: 'messages'
    };

    const phases: Array<'constraints' | 'parser' | 'messages'> = ['constraints', 'parser', 'messages'];

    setPipelineSteps(prev => prev.map(step => {
      const phase = Object.entries(phaseToStepId).find(([_, id]) => id === step.id)?.[0] as 'constraints' | 'parser' | 'messages' | undefined;

      if (!phase) return step;

      const statuses = allTasks.map(task => task.pipelineStatus?.[phase] || 'pending');

      let aggregatedStatus: PipelineStep['status'] = 'pending';

      if (statuses.every(s => s === 'completed')) {
        aggregatedStatus = 'completed';
        if (step.id === 'constraints') {
          return { ...step, status: aggregatedStatus, payload: 'Generate!' };
        } else if (step.id === 'parsers') {
          return { ...step, status: aggregatedStatus, payload: 'Generati!' };
        } else if (step.id === 'messages') {
          return { ...step, status: aggregatedStatus, payload: 'Generati!' };
        }
      } else if (statuses.some(s => s === 'running')) {
        aggregatedStatus = 'running';
      }

      return { ...step, status: aggregatedStatus };
    }));
  }, [flattenTaskTree]);

  /**
   * FASE 1: Generazione struttura dati (PREGIUDIZIALE)
   * Questa è l'unica fase sequenziale - deve completare prima di tutto il resto
   */
  const runGenerationPipeline = useCallback(async (userInput: string, taskId?: string) => {
    updatePipelineStep('structure', 'running', 'sto pensando a qual è la migliore struttura dati per questo task...');

    const { schema, shouldBeGeneral } = await generateStructure(userInput, taskId, locale);

    setDataSchema(schema);
    if (setShouldBeGeneral) {
      setShouldBeGeneral(shouldBeGeneral);
    }

    updatePipelineStep('structure', 'running', 'Confermami la struttura che vedi sulla sinistra...');

    // Transizione di stato delegata a useWizardFlow
    transitionToProposed();
  }, [locale, updatePipelineStep, setDataSchema, setShouldBeGeneral, transitionToProposed]);

  /**
   * Simula la generazione di vincoli per UN singolo task
   * ✅ C2: Wrapped with retry
   */
  const generateConstraintsForTask = useCallback(async (task: WizardTaskTreeNode) => {
    updateTaskPipelineStatus(task.id, 'constraints', 'running');
    updateTaskProgress(task.id, 'constraints', 0);
    updatePipelineStep('constraints', 'running', 'sto generando le regole di validazione per assicurare la correttezza dei dati...');

    try {
      // ✅ C2: DELEGA a useWizardRetry - nessuna logica di retry qui
      const generatedConstraints = await wizardRetry.retryNodePhase(
        task.id,
        'constraints',
        async () => {
          return await generateConstraints([task], (progress) => {
            updateTaskProgress(task.id, 'constraints', progress);
            if (progress >= 100) {
              updateTaskPipelineStatus(task.id, 'constraints', 'completed');
              updatePipelineStep('constraints', 'completed', 'Generate!');
            }
          }, locale);
        },
        (progress) => updateTaskProgress(task.id, 'constraints', progress)
      );

    // Assegna constraints al nodo nel dataSchema
    setDataSchema(prev => {
      const updateNode = (nodes: WizardTaskTreeNode[]): WizardTaskTreeNode[] => {
        return nodes.map(node => {
          if (node.id === task.id) {
            return { ...node, constraints: generatedConstraints };
          }
          if (node.subNodes && node.subNodes.length > 0) {
            return { ...node, subNodes: updateNode(node.subNodes) };
          }
          return node;
        });
      };
      return updateNode(prev);
    });

      // Salva anche in wizardState.constraints (per compatibilità)
      setConstraints(prev => [...(prev || []), ...generatedConstraints]);
    } catch (error) {
      // ✅ C3: Dopo tutti i retry falliti, imposta stato 'failed'
      updateTaskPipelineStatus(task.id, 'constraints', 'failed');
      throw error; // Re-throw per logging
    }
  }, [locale, updatePipelineStep, updateTaskPipelineStatus, updateTaskProgress, setDataSchema, setConstraints, wizardRetry]);

  /**
   * Simula la generazione di parser per UN singolo task
   * ✅ C2: Wrapped with retry
   */
  const generateParsersForTask = useCallback(async (task: WizardTaskTreeNode) => {
    updateTaskPipelineStatus(task.id, 'parser', 'running');
    updateTaskProgress(task.id, 'parser', 0);

    try {
      // ✅ C2: DELEGA a useWizardRetry - nessuna logica di retry qui
      const generatedContract = await wizardRetry.retryNodePhase(
        task.id,
        'parser',
        async () => {
          return await generateParsers(
            [task],
            (progress) => {
              updateTaskProgress(task.id, 'parser', progress);
              if (progress >= 100) {
                updateTaskPipelineStatus(task.id, 'parser', 'completed');
                updateParserSubstep?.(null);
                updatePipelineStep('parsers', 'completed', 'Generati!');
              }
            },
            (substep) => {
              updateParserSubstep?.(substep);
            },
            locale
          );
        },
        (progress) => updateTaskProgress(task.id, 'parser', progress)
      );

    // Assegna dataContract al nodo nel dataSchema
    setDataSchema(prev => {
      const updateNode = (nodes: WizardTaskTreeNode[]): WizardTaskTreeNode[] => {
        return nodes.map(node => {
          if (node.id === task.id) {
            return { ...node, dataContract: generatedContract };
          }
          if (node.subNodes && node.subNodes.length > 0) {
            return { ...node, subNodes: updateNode(node.subNodes) };
          }
          return node;
        });
      };
      return updateNode(prev);
    });

      // Salva anche in wizardState.nlpContract (per compatibilità)
      setNlpContract(generatedContract);
    } catch (error) {
      // ✅ C3: Dopo tutti i retry falliti, imposta stato 'failed'
      updateTaskPipelineStatus(task.id, 'parser', 'failed');
      throw error; // Re-throw per logging
    }
  }, [locale, updatePipelineStep, updateTaskPipelineStatus, updateTaskProgress, updateParserSubstep, setDataSchema, setNlpContract, wizardRetry]);

  /**
   * Simula la generazione di messaggi per UN singolo task
   */
  const generateMessagesForTask = useCallback(async (task: WizardTaskTreeNode) => {
    // ✅ INVARIANT CHECK: task.id MUST equal task.templateId (single source of truth)
    if (task.id !== task.templateId) {
      console.error('[useWizardGeneration][generateMessagesForTask] ❌ CRITICAL: task.id !== task.templateId', {
        taskId: task.id,
        taskTemplateId: task.templateId,
        taskLabel: task.label,
      });
      throw new Error(
        `[useWizardGeneration] CRITICAL: task.id (${task.id}) !== task.templateId (${task.templateId}) for task "${task.label}". ` +
        `This should never happen. The ID must be consistent throughout the wizard lifecycle.`
      );
    }

    // ✅ LOGGING PLAN B: Log before message generation
    console.log('[useWizardGeneration][generateMessagesForTask] 🚀 LOGGING PLAN B: Starting message generation', {
      taskId: task.id,
      taskTemplateId: task.templateId,
      taskLabel: task.label,
      taskType: task.type,
      taskIcon: task.icon,
      idMatchesTemplateId: task.id === task.templateId,
      locale,
    });

    updateTaskPipelineStatus(task.id, 'messages', 'running');
    updateTaskProgress(task.id, 'messages', 0);

    let generatedMessages: WizardStepMessages;
    let generationError: Error | null = null;

    try {
      // ✅ C2: DELEGA a useWizardRetry - nessuna logica di retry qui
      generatedMessages = await wizardRetry.retryNodePhase(
        task.id,
        'messages',
        async () => {
          return await generateMessages(
            [task],
            locale,
            (progress) => {
              updateTaskProgress(task.id, 'messages', progress);
              if (progress >= 100) {
                updateTaskPipelineStatus(task.id, 'messages', 'completed');
                updateMessageSubstep?.(null);
                updatePipelineStep('messages', 'completed', 'Generati!');
              }
            },
            (substep) => {
              updateMessageSubstep?.(substep);
            }
          );
        },
        (progress) => updateTaskProgress(task.id, 'messages', progress)
      );
    } catch (error) {
      generationError = error instanceof Error ? error : new Error(String(error));
      console.error('[useWizardGeneration][generateMessagesForTask] ❌ LOGGING PLAN B: Message generation failed', {
        taskId: task.id,
        taskLabel: task.label,
        error: generationError.message,
        errorStack: generationError.stack,
      });
      // ✅ C3: Dopo tutti i retry falliti, imposta stato 'failed'
      updateTaskPipelineStatus(task.id, 'messages', 'failed');
      // Re-throw to let caller handle
      throw error;
    }

    // ✅ LOGGING PLAN B: Log after message generation
    console.log('[useWizardGeneration][generateMessagesForTask] ✅ LOGGING PLAN B: Message generation completed', {
      taskId: task.id,
      taskTemplateId: task.templateId,
      taskLabel: task.label,
      hasMessages: !!generatedMessages,
      messagesStructure: {
        hasAsk: !!generatedMessages.ask,
        hasNoInput: !!generatedMessages.noInput,
        hasConfirm: !!generatedMessages.confirm,
        hasNotConfirmed: !!generatedMessages.notConfirmed,
        hasViolation: !!generatedMessages.violation,
        hasSuccess: !!generatedMessages.success,
      },
      messageCounts: {
        askCount: generatedMessages.ask?.base?.length || 0,
        noInputCount: generatedMessages.noInput?.base?.length || 0,
        noMatchCount: generatedMessages.ask?.reask?.length || 0,
        confirmCount: generatedMessages.confirm?.base?.length || 0,
        notConfirmedCount: generatedMessages.notConfirmed?.base?.length || 0,
        violationCount: generatedMessages.violation?.base?.length || 0,
        successCount: generatedMessages.success?.base?.length || 0,
      },
      errorOccurred: !!generationError,
    });

    setMessages(task.id, generatedMessages);
  }, [locale, updatePipelineStep, updateTaskPipelineStatus, updateTaskProgress, updateMessageSubstep, setMessages, wizardRetry]);

  /**
   * FASE 2: Parallelizzazione massiva
   * Dopo la conferma della struttura, lancia TUTTE le operazioni in parallelo
   */
  const continueAfterStructureConfirmation = useCallback(async (taskTree: WizardTaskTreeNode[]) => {
    const totalParsers = calculateTotalParsers(taskTree);
    const allTasks = flattenTaskTree(taskTree);

    // ✅ LOGGING PLAN A: Log complete flattenTaskTree before generation
    console.log('[useWizardGeneration][continueAfterStructureConfirmation] 📊 LOGGING PLAN A: Complete task tree structure', {
      totalNodes: allTasks.length,
      totalParsers,
      nodes: allTasks.map(task => ({
        id: task.id,
        templateId: task.templateId,
        label: task.label,
        type: task.type,
        icon: task.icon,
        hasSubNodes: !!task.subNodes,
        subNodesCount: task.subNodes?.length || 0,
        subNodesIds: task.subNodes?.map(s => ({ id: s.id, label: s.label })) || [],
        idMatchesTemplateId: task.id === task.templateId,
      })),
      rootNodes: taskTree.map(root => ({
        id: root.id,
        templateId: root.templateId,
        label: root.label,
        subNodesCount: root.subNodes?.length || 0,
      })),
    });

    // ✅ INVARIANT CHECK: Verify all nodes have id === templateId
    const nodesWithMismatch = allTasks.filter(t => t.id !== t.templateId);
    if (nodesWithMismatch.length > 0) {
      console.error('[useWizardGeneration][continueAfterStructureConfirmation] ❌ CRITICAL: Nodes with id !== templateId', {
        nodesWithMismatch: nodesWithMismatch.map(n => ({
          id: n.id,
          templateId: n.templateId,
          label: n.label,
        })),
        totalNodes: allTasks.length,
        mismatchedCount: nodesWithMismatch.length,
      });
      throw new Error(
        `[useWizardGeneration] CRITICAL: Found ${nodesWithMismatch.length} nodes with id !== templateId. ` +
        `This should never happen. The ID must be consistent throughout the wizard lifecycle. ` +
        `Mismatched nodes: ${nodesWithMismatch.map(n => `"${n.label}" (id: ${n.id}, templateId: ${n.templateId})`).join(', ')}.`
      );
    }

    // ✅ INVARIANT CHECK: Verify all node IDs are unique
    const nodeIds = allTasks.map(t => t.id);
    const duplicateIds = nodeIds.filter((id, index) => nodeIds.indexOf(id) !== index);
    if (duplicateIds.length > 0) {
      const uniqueDuplicates = [...new Set(duplicateIds)];
      console.error('[useWizardGeneration][continueAfterStructureConfirmation] ❌ CRITICAL: Duplicate node IDs', {
        duplicateIds: uniqueDuplicates,
        totalNodes: allTasks.length,
        duplicateCount: duplicateIds.length,
        nodesWithDuplicates: allTasks.filter(t => uniqueDuplicates.includes(t.id)).map(n => ({
          id: n.id,
          label: n.label,
        })),
      });
      throw new Error(
        `[useWizardGeneration] CRITICAL: Found duplicate node IDs: ${uniqueDuplicates.join(', ')}. ` +
        `This should never happen. Each node must have a unique ID.`
      );
    }

    // ✅ VERIFY: All nodes must be included (root + all sub-nodes)
    console.log('[useWizardGeneration][continueAfterStructureConfirmation] ✅ All nodes validated', {
      totalNodes: allTasks.length,
      nodeIds: allTasks.map(t => ({ id: t.id, label: t.label })),
      allIdsUnique: duplicateIds.length === 0,
      allIdsMatchTemplateIds: nodesWithMismatch.length === 0,
    });

    // Inizializzo lo stato di tutti i task
    allTasks.forEach(task => {
      updateTaskPipelineStatus(task.id, 'constraints', 'pending');
      updateTaskPipelineStatus(task.id, 'parser', 'pending');
      updateTaskPipelineStatus(task.id, 'messages', 'pending');
    });

    // Aggiorna step a 'running' quando inizia la generazione parallela
    updatePipelineStep('constraints', 'running', 'sto generando le regole di validazione per assicurare la correttezza dei dati...');
    updatePipelineStep('parsers', 'running', 'sto generando i parser NLP per l\'estrazione dei dati da una frase...');
    updatePipelineStep('messages', 'running', 'sto generando i messaggi per gestire il dialogo con l\'utente...');

    // Transizione di stato delegata a useWizardFlow
    transitionToGenerating();

    // Array di tutte le promise da eseguire in parallelo
    const allPromises: Promise<void>[] = [];

    // Per ogni task, creo 3 promise (una per fase) - esecuzione reale in parallelo
    console.log('[useWizardGeneration][continueAfterStructureConfirmation] 📊 Starting parallel generation', {
      allTasksCount: allTasks.length,
      allTasksIds: allTasks.map(t => ({ id: t.id, templateId: t.templateId, label: t.label })),
    });

    allTasks.forEach(task => {
      console.log('[useWizardGeneration][continueAfterStructureConfirmation] 🔄 Adding promises for task', {
        taskId: task.id,
        taskTemplateId: task.templateId,
        taskLabel: task.label,
      });
      allPromises.push(generateConstraintsForTask(task));
      allPromises.push(generateParsersForTask(task));
      allPromises.push(generateMessagesForTask(task));
    });

    try {
      await Promise.all(allPromises);

      // Calcola stato aggregato dopo completamento
      // Legge lo stato aggiornato da dataSchema tramite setDataSchema
      setDataSchema(currentSchema => {
        calculateAggregatedPipelineStatus(currentSchema, setPipelineSteps);
        return currentSchema; // Non modifica, solo legge per calcolare aggregato
      });
    } catch (error) {
      console.error('[useWizardGeneration] ❌ Errore durante esecuzione parallela:', error);
      throw error;
    }
  }, [
    flattenTaskTree,
    updatePipelineStep,
    setPipelineSteps,
    updateTaskPipelineStatus,
    generateConstraintsForTask,
    generateParsersForTask,
    generateMessagesForTask,
    transitionToGenerating,
    calculateAggregatedPipelineStatus,
    setDataSchema,
  ]);

  return {
    runGenerationPipeline,
    continueAfterStructureConfirmation,
    flattenTaskTree,
    calculateAggregatedPipelineStatus,
  };
}
