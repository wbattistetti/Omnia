import { useCallback } from 'react';
import { generateStructure, generateConstraints, generateParsers, generateMessages, calculateTotalParsers } from '../api/simulateEndpoints';
import { PipelineStep } from './useWizardState';
import { WizardTaskTreeNode } from '../types';

type UseSimulationProps = {
  locale?: string;
  updatePipelineStep: (stepId: string, status: PipelineStep['status'], payload?: string) => void;
  setDataSchema: (schema: any) => void;
  setConstraints: (constraints: any) => void;
  setNlpContract: (contract: any) => void;
  setMessages: (nodeId: string, messages: WizardStepMessages) => void;
  setCurrentStep: (step: any) => void;
  setShowStructureConfirmation: (show: boolean) => void;
  updateTaskPipelineStatus: (taskId: string, phase: 'constraints' | 'parser' | 'messages', status: 'pending' | 'running' | 'completed') => void;
  updateTaskProgress: (taskId: string, phase: 'constraints' | 'parser' | 'messages', progress: number) => void;
  updateParserSubstep?: (substep: string | null) => void;
  updateMessageSubstep?: (substep: string | null) => void;
};

export function useSimulation(props: UseSimulationProps) {
  const {
    locale = 'it',
    updatePipelineStep,
    setDataSchema,
    setConstraints,
    setNlpContract,
    setMessages,
    setCurrentStep,
    setShowStructureConfirmation,
    updateTaskPipelineStatus,
    updateTaskProgress,
    updateParserSubstep,
    updateMessageSubstep
  } = props;

  /**
   * FASE 1: Generazione struttura dati (PREGIUDIZIALE)
   * Questa è l'unica fase sequenziale - deve completare prima di tutto il resto
   */
  const runGenerationPipeline = useCallback(async (userInput: string, taskId?: string, locale: string = 'it') => {
    console.log('[useSimulation] 🚀 runGenerationPipeline START', { userInput, taskId, locale });
    updatePipelineStep('structure', 'running', 'sto pensando a qual è la migliore struttura dati per questo task...');
    console.log('[useSimulation] 📊 Pipeline step structure -> running');

    console.log('[useSimulation] ⏳ Chiamando generateStructure...');
    const { schema, shouldBeGeneral } = await generateStructure(userInput, taskId, locale);
    console.log('[useSimulation] ✅ generateStructure completato', {
      schemaLength: schema?.length,
      shouldBeGeneral
    });

    setDataSchema(schema);
    console.log('[useSimulation] 📝 dataSchema aggiornato');

    // Update message when structure is generated (before confirmation)
    updatePipelineStep('structure', 'running', 'Confermami la struttura che vedi sulla sinistra...');

    console.log('[useSimulation] 🔔 Chiamando setShowStructureConfirmation(true)...');
    setShowStructureConfirmation(true);
    console.log('[useSimulation] ✅ setShowStructureConfirmation(true) chiamato');
  }, [locale, updatePipelineStep, setDataSchema, setShowStructureConfirmation]);

  /**
   * Raccoglie tutti i nodi dell'albero (root + subtask) in una lista piatta
   * per poterli processare in parallelo
   */
  const flattenTaskTree = (nodes: WizardTaskTreeNode[]): WizardTaskTreeNode[] => {
    const result: WizardTaskTreeNode[] = [];
    nodes.forEach(node => {
      result.push(node);
      if (node.subNodes && node.subNodes.length > 0) {
        result.push(...flattenTaskTree(node.subNodes));
      }
    });
    return result;
  };

  /**
   * Simula la generazione di vincoli per UN singolo task
   * Questa funzione sarà eseguita in parallelo per tutti i task
   */
  const generateConstraintsForTask = async (task: WizardTaskTreeNode) => {
    updateTaskPipelineStatus(task.id, 'constraints', 'running');
    updateTaskProgress(task.id, 'constraints', 0);
    // ✅ NEW: Aggiorna messaggio quando inizia generazione constraints
    updatePipelineStep('constraints', 'running', 'sto generando le regole di validazione per assicurare la correttezza dei dati...');

        const generatedConstraints = await generateConstraints([task], (progress) => {
      updateTaskProgress(task.id, 'constraints', progress);
      if (progress >= 100) {
        updateTaskPipelineStatus(task.id, 'constraints', 'completed');
        // ✅ NEW: Aggiorna step a completed quando tutti i constraints sono generati
        updatePipelineStep('constraints', 'completed', 'Generate!');
      }
    }, locale);  // ✅ NEW: Pass locale

    // ✅ NEW: Assegna constraints al nodo nel dataSchema
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

    // ✅ NEW: Salva anche in wizardState.constraints (per compatibilità)
    setConstraints(prev => [...(prev || []), ...generatedConstraints]);

    console.log('[useSimulation][generateConstraintsForTask] ✅ COMPLETED', {
      taskId: task.id,
      constraintsCount: generatedConstraints.length
    });
  };

  /**
   * Simula la generazione di parser per UN singolo task
   * Include tutti i substep: Regex, NER, LLM, fallback, escalation, normalizzazione, validazione semantica
   */
  const generateParsersForTask = async (task: WizardTaskTreeNode) => {
    console.log('[useSimulation][generateParsersForTask] 🚀 START', { taskId: task.id, taskLabel: task.label, locale });
    updateTaskPipelineStatus(task.id, 'parser', 'running');
    updateTaskProgress(task.id, 'parser', 0);

        const generatedContract = await generateParsers(
          [task],
          (progress) => {
        updateTaskProgress(task.id, 'parser', progress);
        if (progress >= 100) {
          updateTaskPipelineStatus(task.id, 'parser', 'completed');
          updateParserSubstep?.(null); // Reset substep quando completato
          // ✅ NEW: Aggiorna step a completed quando il parser è generato
          updatePipelineStep('parsers', 'completed', 'Generati!');
        }
      },
      (substep) => {
        // ✅ NEW: Aggiorna parte variabile dinamica
        updateParserSubstep?.(substep);
      },
      locale  // ✅ NEW: Pass locale
    );

    // ✅ NEW: Assegna dataContract al nodo nel dataSchema
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

    // ✅ NEW: Salva anche in wizardState.nlpContract (per compatibilità)
    setNlpContract(generatedContract);

    console.log('[useSimulation][generateParsersForTask] ✅ COMPLETED', {
      taskId: task.id,
      hasContract: !!generatedContract
    });
  };

  /**
   * Simula la generazione di messaggi per UN singolo task
   * Include tutti i tipi di messaggi: richiesta iniziale, no match, no input, ambiguità, conferma, completamento
   */
  const generateMessagesForTask = async (task: WizardTaskTreeNode) => {
    console.log('[useSimulation][generateMessagesForTask] 🚀 START', { taskId: task.id, taskLabel: task.label, locale });
    updateTaskPipelineStatus(task.id, 'messages', 'running');
    updateTaskProgress(task.id, 'messages', 0);

    // ✅ NEW: generateMessages fa 8 chiamate separate (una per step type)
    const generatedMessages = await generateMessages(
      [task],
      locale,  // ✅ NEW: Pass locale
      (progress) => {
        updateTaskProgress(task.id, 'messages', progress);
        if (progress >= 100) {
          updateTaskPipelineStatus(task.id, 'messages', 'completed');
          updateMessageSubstep?.(null); // Reset substep quando completato
          // ✅ NEW: Aggiorna step a completed quando i messaggi sono generati
          updatePipelineStep('messages', 'completed', 'Generati!');
        }
      },
      (substep) => {
        // ✅ NEW: Aggiorna parte variabile dinamica
        updateMessageSubstep?.(substep);
      }
    );

    setMessages(task.id, generatedMessages);

    console.log('[useSimulation][generateMessagesForTask] ✅ COMPLETED', {
      taskId: task.id,
      hasMessages: !!generatedMessages,
      askCount: generatedMessages.ask?.base?.length || 0,
      noInputCount: generatedMessages.noInput?.base?.length || 0,
      confirmCount: generatedMessages.confirm?.base?.length || 0
    });
  };

  /**
   * FASE 2: Parallelizzazione massiva
   * Dopo la conferma della struttura, lancia TUTTE le operazioni in parallelo:
   * - Per ogni task (root + subtask)
   * - Per ogni fase (constraints, parser, messages)
   *
   * Esempio con 1 root + 3 subtask:
   * - 4 task × 3 fasi = 12 operazioni in parallelo!
   */
  const continueAfterStructureConfirmation = useCallback(async (taskTree: WizardTaskTreeNode[]) => {
    console.log('[useSimulation][continueAfterStructureConfirmation] 🚀 START', {
      taskTreeLength: taskTree?.length,
      taskTree: taskTree?.map(t => ({ id: t.id, label: t.label })),
      locale
    });

    setShowStructureConfirmation(false);

    // Calculate total parsers needed (simple count, 1 per node)
    const totalParsers = calculateTotalParsers(taskTree);
    console.log(`[useSimulation][continueAfterStructureConfirmation] Total parsers needed: ${totalParsers} for ${taskTree.length} root nodes`);

    // Raccolgo tutti i task (root + subtask) in una lista piatta
    const allTasks = flattenTaskTree(taskTree);

    // Inizializzo lo stato di tutti i task
    allTasks.forEach(task => {
      updateTaskPipelineStatus(task.id, 'constraints', 'pending');
      updateTaskPipelineStatus(task.id, 'parser', 'pending');
      updateTaskPipelineStatus(task.id, 'messages', 'pending');
    });

    // ✅ NEW: Aggiorna step a 'running' quando inizia la generazione parallela
    console.log('[useSimulation][continueAfterStructureConfirmation] 📊 Updating pipeline steps to running...');
    updatePipelineStep('constraints', 'running', 'sto generando le regole di validazione per assicurare la correttezza dei dati...');
    updatePipelineStep('parsers', 'running', 'sto generando i parser NLP per l\'estrazione dei dati da una frase...');
    updatePipelineStep('messages', 'running', 'sto generando i messaggi per gestire il dialogo con l\'utente...');

    // ======================================
    // PARALLELIZZAZIONE MASSIVA
    // ======================================

    // Array di tutte le promise da eseguire in parallelo
    const allPromises: Promise<void>[] = [];

    // Per ogni task, creo 3 promise (una per fase) - esecuzione reale in parallelo
    allTasks.forEach(task => {
      allPromises.push(generateConstraintsForTask(task));
      allPromises.push(generateParsersForTask(task));
      allPromises.push(generateMessagesForTask(task));
    });

    // Lancio TUTTO in parallelo
    console.log('[useSimulation][continueAfterStructureConfirmation] 🚀 Starting parallel execution', {
      totalPromises: allPromises.length,
      allTasksLength: allTasks.length
    });

    try {
      await Promise.all(allPromises);
      console.log('[useSimulation][continueAfterStructureConfirmation] ✅ Tutte le fasi completate');
    } catch (error) {
      console.error('[useSimulation][continueAfterStructureConfirmation] ❌ Errore durante esecuzione parallela:', error);
      throw error;
    }

        // All phases completed - wizard will close automatically
      }, [locale, setShowStructureConfirmation, updateTaskPipelineStatus, updateTaskProgress, updatePipelineStep, updateParserSubstep, updateMessageSubstep, setDataSchema, setConstraints, setNlpContract, setMessages]);

  return {
    runGenerationPipeline,
    continueAfterStructureConfirmation
  };
}
