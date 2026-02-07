import { useCallback } from 'react';
import { fakeGenerateStructure, fakeGenerateConstraints, fakeGenerateParsers, fakeGenerateMessages, discoverParsers } from '../fakeApi/simulateEndpoints';
import { delayBySeconds } from '../utils/delays';
import { PipelineStep } from './useWizardState';
import { FakeTaskTreeNode } from '../types';

type UseSimulationProps = {
  taskTime: number;
  updatePipelineStep: (stepId: string, status: PipelineStep['status']) => void;
  setDataSchema: (schema: any) => void;
  setConstraints: (constraints: any) => void;
  setNlpContract: (contract: any) => void;
  setMessages: (messages: any) => void;
  setCurrentStep: (step: any) => void;
  setShowStructureConfirmation: (show: boolean) => void;
  updateTaskPipelineStatus: (taskId: string, phase: 'constraints' | 'parser' | 'messages', status: 'pending' | 'running' | 'completed') => void;
  updateTaskProgress: (taskId: string, phase: 'constraints' | 'parser' | 'messages', progress: number) => void;
};

export function useSimulation(props: UseSimulationProps) {
  const {
    taskTime,
    updatePipelineStep,
    setDataSchema,
    setConstraints,
    setNlpContract,
    setMessages,
    setCurrentStep,
    setShowStructureConfirmation,
    updateTaskPipelineStatus,
    updateTaskProgress
  } = props;

  /**
   * FASE 1: Generazione struttura dati (PREGIUDIZIALE)
   * Questa è l'unica fase sequenziale - deve completare prima di tutto il resto
   */
  const runGenerationPipeline = useCallback(async (userInput: string) => {
    updatePipelineStep('structure', 'running');
    const schema = await fakeGenerateStructure(userInput, taskTime);
    setDataSchema(schema);
    updatePipelineStep('structure', 'completed');

    setShowStructureConfirmation(true);
  }, [taskTime, updatePipelineStep, setDataSchema, setShowStructureConfirmation]);

  /**
   * Raccoglie tutti i nodi dell'albero (root + subtask) in una lista piatta
   * per poterli processare in parallelo
   */
  const flattenTaskTree = (nodes: FakeTaskTreeNode[]): FakeTaskTreeNode[] => {
    const result: FakeTaskTreeNode[] = [];
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
  const generateConstraintsForTask = async (task: FakeTaskTreeNode) => {
    updateTaskPipelineStatus(task.id, 'constraints', 'running');
    updateTaskProgress(task.id, 'constraints', 0);

    await fakeGenerateConstraints([task], taskTime, (progress) => {
      updateTaskProgress(task.id, 'constraints', progress);
      if (progress >= 100) {
        updateTaskPipelineStatus(task.id, 'constraints', 'completed');
      }
    });
  };

  /**
   * Simula la generazione di parser per UN singolo task
   * Include tutti i substep: Regex, NER, LLM
   */
  const generateParsersForTask = async (task: FakeTaskTreeNode) => {
    updateTaskPipelineStatus(task.id, 'parser', 'running');
    updateTaskProgress(task.id, 'parser', 0);

    await fakeGenerateParsers([task], taskTime, (progress) => {
      updateTaskProgress(task.id, 'parser', progress);
      if (progress >= 100) {
        updateTaskPipelineStatus(task.id, 'parser', 'completed');
      }
    });
  };

  /**
   * Simula la generazione di messaggi per UN singolo task
   * Include tutti i tipi di messaggi: Normal, NoInput, Confirm, ecc.
   */
  const generateMessagesForTask = async (task: FakeTaskTreeNode) => {
    updateTaskPipelineStatus(task.id, 'messages', 'running');
    updateTaskProgress(task.id, 'messages', 0);

    const generatedMessages = await fakeGenerateMessages([task], taskTime, (progress) => {
      updateTaskProgress(task.id, 'messages', progress);
      if (progress >= 100) {
        updateTaskPipelineStatus(task.id, 'messages', 'completed');
      }
    });

    setMessages(generatedMessages);
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
  const continueAfterStructureConfirmation = useCallback(async (taskTree: FakeTaskTreeNode[]) => {
    setShowStructureConfirmation(false);

    // Piccola pausa prima di iniziare
    await delayBySeconds(0.5);

    // ======================================
    // DISCOVERY DINAMICA DEI PARSER
    // ======================================
    // Scopriamo quanti parser servono per ogni nodo
    const parserDiscoveries = await discoverParsers(taskTree);
    const totalParsers = parserDiscoveries.reduce((sum, d) => sum + d.parsersCount, 0);

    // Log per debug (in produzione questo andrebbe rimosso o fatto in modo diverso)
    console.log(`Parser discovery: ${totalParsers} parser totali per ${parserDiscoveries.length} nodi`);

    // Raccolgo tutti i task (root + subtask) in una lista piatta
    const allTasks = flattenTaskTree(taskTree);

    // Inizializzo lo stato di tutti i task
    allTasks.forEach(task => {
      updateTaskPipelineStatus(task.id, 'constraints', 'pending');
      updateTaskPipelineStatus(task.id, 'parser', 'pending');
      updateTaskPipelineStatus(task.id, 'messages', 'pending');
    });

    // ======================================
    // PARALLELIZZAZIONE MASSIVA CON MICRO-RITARDI
    // ======================================

    // Array di tutte le promise da eseguire in parallelo
    const allPromises: Promise<void>[] = [];

    // Per ogni task, creo 3 promise (una per fase) con micro-ritardi
    allTasks.forEach(task => {
      // Micro-ritardo casuale tra 50-200ms per ogni task
      const constraintsDelay = 50 + Math.random() * 150;
      const parsersDelay = 50 + Math.random() * 150;
      const messagesDelay = 50 + Math.random() * 150;

      allPromises.push(
        (async () => {
          await new Promise(resolve => setTimeout(resolve, constraintsDelay));
          await generateConstraintsForTask(task);
        })()
      );

      allPromises.push(
        (async () => {
          await new Promise(resolve => setTimeout(resolve, parsersDelay));
          await generateParsersForTask(task);
        })()
      );

      allPromises.push(
        (async () => {
          await new Promise(resolve => setTimeout(resolve, messagesDelay));
          await generateMessagesForTask(task);
        })()
      );
    });

    // Lancio TUTTO in parallelo
    await Promise.all(allPromises);

    // Tutte le fasi sono completate
    setCurrentStep('modulo_pronto');
  }, [taskTime, setCurrentStep, setShowStructureConfirmation, updateTaskPipelineStatus]);

  return {
    runGenerationPipeline,
    continueAfterStructureConfirmation
  };
}
