// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useCallback } from 'react';
import { generateStructure, generateConstraints, generateParsers, generateMessages, calculateTotalParsers } from '../api/wizardApi';
import { buildContractFromNode } from '../api/wizardApi';
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
  transitionToProposed: () => void;
  transitionToGenerating: () => void;
  // ✅ NEW: Function to create template + instance for first step (before DATA_STRUCTURE_PROPOSED)
  createTemplateAndInstanceForProposed?: () => Promise<void>;
  // ✅ MODELLO DETERMINISTICO: Ref stabile per checkAndComplete
  checkAndCompleteRef?: { current: ((dataSchema: WizardTaskTreeNode[]) => Promise<void>) | null };
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
    transitionToProposed,
    transitionToGenerating,
    createTemplateAndInstanceForProposed, // ✅ NEW: Function to create template + instance for first step
    checkAndCompleteRef, // ✅ MODELLO DETERMINISTICO: Ref stabile per checkAndComplete
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

  // ❌ RIMOSSO: calculateAggregatedPipelineStatus - sostituito da sistema di contatori deterministici

  /**
   * FASE 1: Generazione struttura dati (PREGIUDIZIALE)
   * Questa è l'unica fase sequenziale - deve completare prima di tutto il resto
   */
  const runGenerationPipeline = useCallback(async (userInput: string, rowId?: string) => { // ✅ ALWAYS equals row.id (which equals task.id when task exists)
    updatePipelineStep('structure', 'running', 'sto pensando a qual è la migliore struttura dati per questo task...');

    const { schema, shouldBeGeneral } = await generateStructure(userInput, rowId, locale); // ✅ ALWAYS equals row.id

    setDataSchema(schema);
    if (setShouldBeGeneral) {
      setShouldBeGeneral(shouldBeGeneral);
    }

    updatePipelineStep('structure', 'running', 'Confermami la struttura che vedi sulla sinistra...');

    // ✅ CRITICAL: Create template + instance BEFORE emitting DATA_STRUCTURE_PROPOSED
    // This ensures that when DATA_STRUCTURE_PROPOSED is emitted, template + instance are already in memory
    if (createTemplateAndInstanceForProposed) {
      console.log('[useWizardGeneration] 🚀 Creating template + instance for proposed structure (before DATA_STRUCTURE_PROPOSED)');
      await createTemplateAndInstanceForProposed();
      console.log('[useWizardGeneration] ✅ Template + instance created - onFirstStepComplete() should call transitionToProposed()');
      // ✅ onFirstStepComplete() DEVE chiamare transitionToProposed()
      // Se non viene chiamato, c'è un bug in createTemplateAndInstanceForProposed che deve essere fixato
    } else {
      console.warn('[useWizardGeneration] ⚠️ createTemplateAndInstanceForProposed not provided - emitting DATA_STRUCTURE_PROPOSED without template+instance');
      // ✅ Backward compatibility: emetti DATA_STRUCTURE_PROPOSED direttamente
      transitionToProposed();
    }
  }, [locale, updatePipelineStep, setDataSchema, setShouldBeGeneral, transitionToProposed, createTemplateAndInstanceForProposed]);

  /**
   * Simula la generazione di vincoli per UN singolo task
   * ✅ C2: Wrapped with retry
   */
  const generateConstraintsForTask = useCallback(async (task: WizardTaskTreeNode) => {
    updateTaskPipelineStatus(task.id, 'constraints', 'running');
    updateTaskProgress(task.id, 'constraints', 0);

    try {
      // ✅ C2: DELEGA a useWizardRetry - nessuna logica di retry qui
      const generatedConstraints = await wizardRetry.retryNodePhase(
        task.id,
        'constraints',
        async () => {
          return await generateConstraints([task], (progress) => {
            updateTaskProgress(task.id, 'constraints', progress);
          }, locale);
        },
        (progress) => updateTaskProgress(task.id, 'constraints', progress)
      );

      // ✅ FIX: Mark task as completed AFTER generation
      console.log('[NODE COMPLETED]', {
        id: task.id,
        label: task.label,
        phase: 'constraints',
        newStatus: 'completed'
      });
      updateTaskPipelineStatus(task.id, 'constraints', 'completed');

      // ❌ RIMOSSO: setDataSchema con updatePipelineStep - calculateAggregatedPipelineStatus lo farà dopo Promise.all

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
            },
            locale
          );
        },
        (progress) => updateTaskProgress(task.id, 'parser', progress)
      );

      // ✅ FIX: Mark task as completed AFTER generation
      console.log('[NODE COMPLETED]', {
        id: task.id,
        label: task.label,
        phase: 'parser',
        newStatus: 'completed'
      });
      updateTaskPipelineStatus(task.id, 'parser', 'completed');

      // ❌ RIMOSSO: setDataSchema con updatePipelineStep - calculateAggregatedPipelineStatus lo farà dopo Promise.all

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
  }, [locale, updatePipelineStep, updateTaskPipelineStatus, updateTaskProgress, setDataSchema, setNlpContract, wizardRetry, flattenTaskTree]);

  /**
   * Simula la generazione di messaggi per UN singolo task
   * @param onPhaseComplete - Callback chiamato quando la fase completa (opzionale)
   */
  const generateMessagesForTask = useCallback(async (task: WizardTaskTreeNode, onPhaseComplete?: () => void) => {
    // ✅ INVARIANT CHECK: task.id MUST equal task.templateId (single source of truth)
    if (task.id !== task.templateId) {
      throw new Error(
        `[useWizardGeneration] CRITICAL: task.id (${task.id}) !== task.templateId (${task.templateId}) for task "${task.label}". ` +
        `This should never happen. The ID must be consistent throughout the wizard lifecycle.`
      );
    }

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
            }
          );
        },
        (progress) => updateTaskProgress(task.id, 'messages', progress)
      );

      // ✅ FIX: Mark task as completed AFTER generation
      console.log('[NODE COMPLETED]', {
        id: task.id,
        label: task.label,
        phase: 'messages',
        newStatus: 'completed'
      });
      updateTaskPipelineStatus(task.id, 'messages', 'completed');

      // ✅ FIX: Salva messages PRIMA di chiamare onPhaseComplete
      // Questo garantisce che quando checkAndComplete viene chiamato, i messages sono già salvati
      setMessages(task.id, generatedMessages);

      // ✅ Chiama callback DOPO aver salvato messages
      if (onPhaseComplete) {
        onPhaseComplete();
      }
    } catch (error) {
      generationError = error instanceof Error ? error : new Error(String(error));
      // ✅ C3: Dopo tutti i retry falliti, imposta stato 'failed'
      updateTaskPipelineStatus(task.id, 'messages', 'failed');
      // ❌ NON incrementare il contatore in caso di errore
      // Il contatore conta solo i success, non i failed
      // Re-throw to let caller handle
      throw error;
    }
  }, [locale, updatePipelineStep, updateTaskPipelineStatus, updateTaskProgress, setMessages, wizardRetry, flattenTaskTree]);

  /**
   * FASE 2: Parallelizzazione massiva con tracking deterministico
   * Dopo la conferma della struttura, lancia TUTTE le operazioni in parallelo
   * Sistema di contatori per tracking in tempo reale
   */
  const continueAfterStructureConfirmation = useCallback(async (taskTree: WizardTaskTreeNode[]) => {
    const allTasks = flattenTaskTree(taskTree);

    // ✅ INVARIANT CHECK: Verify all nodes have id === templateId
    const nodesWithMismatch = allTasks.filter(t => t.id !== t.templateId);
    if (nodesWithMismatch.length > 0) {
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
      throw new Error(
        `[useWizardGeneration] CRITICAL: Found duplicate node IDs: ${uniqueDuplicates.join(', ')}. ` +
        `This should never happen. Each node must have a unique ID.`
      );
    }

    // Inizializzo lo stato di tutti i task
    allTasks.forEach(task => {
      updateTaskPipelineStatus(task.id, 'constraints', 'pending');
      updateTaskPipelineStatus(task.id, 'parser', 'pending');
      updateTaskPipelineStatus(task.id, 'messages', 'pending');
    });

    // ============================================
    // SISTEMA DI CONTATORI DETERMINISTICI
    // ============================================
    const numeroNodi = allTasks.length;

    // Contatori per ogni fase
    const constraintsCounter = { completed: 0, total: numeroNodi };
    const parserCounter = { completed: 0, total: numeroNodi }; // Per ora: 1 contract per nodo
    const messagesCounter = { completed: 0, total: numeroNodi }; // 1 chiamata per nodo (generateMessages fa 8 chiamate AI sequenziali internamente)

    // Build payload for constraints card
    const constraintsPayload = `Sto generando i constraints per: ${allTasks
      .map(n => n.label)
      .join(', ')}…`;

    // Get parsers plan from backend for parser card payload
    let parsersPayload = 'Sto generando tutti i parser necessari per estrarre i dati, nell\'ordine di escalation appropriato: …';
    try {
      const rootNode = taskTree[0];
      if (rootNode) {
        const contract = buildContractFromNode(rootNode);
        const provider = localStorage.getItem('omnia.aiProvider') || 'openai';
        const model = localStorage.getItem('omnia.aiModel') || undefined;

        const planResponse = await fetch('/api/nlp/plan-engines', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contract,
            nodeLabel: rootNode.label,
            locale,
            provider,
            model
          })
        });

        if (planResponse.ok) {
          const planData = await planResponse.json();
          if (planData.success && planData.parsersPlan) {
            const enabledParsers = planData.parsersPlan
              .filter((p: any) => p.enabled)
              .map((p: any) => p.type)
              .join(', ');
            parsersPayload = `Sto generando tutti i parser necessari per estrarre i dati, nell'ordine di escalation appropriato: ${enabledParsers}…`;
          }
        }
      }
    } catch (error) {
      console.warn('[useWizardGeneration] Failed to get parsers plan, using default payload:', error);
    }

    // Build payload for messages card using step labels from Response Editor
    const MESSAGE_STEP_LABELS = [
      'Chiedo il dato',
      'Non sento',
      'Non capisco',
      'Devo confermare',
      'Non Confermato',
      'Ho capito!'
    ];
    const messagesPayload = `Sto generando tutti i messaggi che il bot deve utilizzare in tutte le possibili situazioni: ${MESSAGE_STEP_LABELS
      .map(s => `"${s}"`)
      .join(', ')}…`;

    // Memorizza i payload iniziali per combinare con la percentuale (dopo che sono stati definiti)
    const initialPayloads = {
      constraints: constraintsPayload,
      parsers: parsersPayload,
      messages: messagesPayload
    };

    // Funzione per aggiornare progresso di una fase
    const updatePhaseProgress = (phase: 'constraints' | 'parser' | 'messages') => {
      const counter = phase === 'constraints' ? constraintsCounter
                    : phase === 'parser' ? parserCounter
                    : messagesCounter;

      counter.completed++;
      const progress = Math.round((counter.completed / counter.total) * 100);

      const phaseId = phase === 'constraints' ? 'constraints'
                    : phase === 'parser' ? 'parsers'
                    : 'messages';

      const initialPayload = phase === 'constraints' ? initialPayloads.constraints
                           : phase === 'parser' ? initialPayloads.parsers
                           : initialPayloads.messages;

      if (counter.completed === counter.total) {
        // Fase completata
        const payload = phase === 'constraints' ? 'Generati!'
                      : phase === 'parser' ? 'Generati!'
                      : 'Generati!';
        updatePipelineStep(phaseId, 'completed', payload);

        // ✅ MODELLO DETERMINISTICO: Verifica se TUTTE le fasi sono complete
        const allPhasesComplete =
          constraintsCounter.completed === constraintsCounter.total &&
          parserCounter.completed === parserCounter.total &&
          messagesCounter.completed === messagesCounter.total;

        if (allPhasesComplete && checkAndCompleteRef?.current) {
          // ✅ MODELLO DETERMINISTICO: Chiama checkAndComplete SOLO quando tutti i contatori sono completi
          // checkAndComplete legge direttamente da messages/messagesGeneralized (props), non da parametro
          // Usa taskTree dalla closure di continueAfterStructureConfirmation
          checkAndCompleteRef.current(taskTree).catch(error => {
            console.error('[useWizardGeneration] Error in checkAndComplete:', error);
          });
        }
      } else {
        // Fase in corso - combina messaggio dinamico con percentuale
        // Il payload contiene sia il messaggio dinamico che la percentuale
        // Es: "Sto generando i constraints per: ... 33%"
        // calculatePhaseProgress estrae la percentuale dal payload
        // dynamicMessage viene letto da CenterPanel dal payload (prima parte, senza percentuale)
        const baseMessage = initialPayload.replace(/…$/, ''); // Rimuovi "…" finale
        updatePipelineStep(phaseId, 'running', `${baseMessage} ${progress}%`);
      }
    };

    // Aggiorna step a 'running' quando inizia la generazione parallela con payload dinamici
    // Il payload iniziale contiene il messaggio dinamico, poi viene aggiornato con la percentuale
    updatePipelineStep('constraints', 'running', constraintsPayload);
    updatePipelineStep('parsers', 'running', parsersPayload);
    updatePipelineStep('messages', 'running', messagesPayload);

    // Transizione di stato delegata a useWizardFlow
    transitionToGenerating();

    // ============================================
    // LANCIO PARALLELO DI TUTTE LE FASI
    // ============================================
    const allPromises: Promise<void>[] = [];

    // FASE 1: Constraints - lancia per ogni nodo
    allTasks.forEach(task => {
      allPromises.push(
        generateConstraintsForTask(task)
          .then(() => updatePhaseProgress('constraints'))
          .catch((error) => {
            console.error(`[useWizardGeneration] Error generating constraints for ${task.id}:`, error);
            // Incrementa comunque per non bloccare
            updatePhaseProgress('constraints');
          })
      );
    });

    // FASE 2: Parser - lancia per ogni nodo (per ora: 1 contract per nodo)
    allTasks.forEach(task => {
      allPromises.push(
        generateParsersForTask(task)
          .then(() => updatePhaseProgress('parser'))
          .catch((error) => {
            console.error(`[useWizardGeneration] Error generating parsers for ${task.id}:`, error);
            // Incrementa comunque per non bloccare
            updatePhaseProgress('parser');
          })
      );
    });

    // FASE 3: Messages - lancia per ogni nodo (8 chiamate AI sequenziali dentro generateMessagesForTask)
    allTasks.forEach(task => {
      allPromises.push(
        generateMessagesForTask(task, () => updatePhaseProgress('messages'))
          .catch((error) => {
            console.error(`[useWizardGeneration] Error generating messages for ${task.id}:`, error);
            // Il callback onPhaseComplete viene chiamato anche in caso di errore
          })
      );
    });

    try {
      await Promise.all(allPromises);
      // Tutte le fasi sono complete, i contatori sono già aggiornati
    } catch (error) {
      throw error;
    }
  }, [
    flattenTaskTree,
    updatePipelineStep,
    updateTaskPipelineStatus,
    generateConstraintsForTask,
    generateParsersForTask,
    generateMessagesForTask,
    transitionToGenerating,
  ]);

  return {
    runGenerationPipeline,
    continueAfterStructureConfirmation,
    flattenTaskTree,
  };
}
