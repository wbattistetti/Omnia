import { useState, useEffect } from 'react';
import { WizardStep, WizardDataNode, WizardConstraint, WizardNLPContract, WizardStepMessages, WizardTaskTreeNode } from '../types';
import { WizardMode } from '../types/WizardMode';
import { SimulationSpeed } from '../utils/delays';

export type PipelineStep = {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  payload?: string;
  substeps?: PipelineStep[];
};

export function useWizardState() {
  // ✅ NEW: Enum unico invece di currentStep + booleani multipli
  const [wizardMode, setWizardMode] = useState<WizardMode>(WizardMode.START);
  console.log('[useWizardState] 🎯 wizardMode initialized:', wizardMode);

  // ✅ Manteniamo currentStep per compatibilità con codice esistente (verrà deprecato)
  const [currentStep, setCurrentStep] = useState<WizardStep>('idle');

  // ✅ userInput rimosso - usiamo taskLabel direttamente
  const [dataSchema, setDataSchema] = useState<WizardTaskTreeNode[]>([]);
  const [constraints, setConstraints] = useState<WizardConstraint[]>([]);
  const [nlpContract, setNlpContract] = useState<WizardNLPContract | null>(null);
  // ✅ CHANGED: messages è ora una mappa nodeId -> WizardStepMessages per supportare messaggi per-nodo
  const [messages, setMessages] = useState<Map<string, WizardStepMessages>>(new Map());
  // ✅ NEW: Separate generalized and contextualized messages (anche queste sono mappe)
  const [messagesGeneralized, setMessagesGeneralized] = useState<Map<string, WizardStepMessages>>(new Map());
  const [messagesContextualized, setMessagesContextualized] = useState<Map<string, WizardStepMessages>>(new Map());
  // ✅ NEW: Flag indicating if template is generalizable
  const [shouldBeGeneral, setShouldBeGeneral] = useState<boolean>(false);
  const [speed, setSpeed] = useState<SimulationSpeed>('fast');
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [iconSize, setIconSize] = useState<number>(64);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);

  // ✅ DEPRECATED: Usare wizardMode invece
  // const [showStructureConfirmation, setShowStructureConfirmation] = useState(false);
  // const [structureConfirmed, setStructureConfirmed] = useState(false);
  // const [showCorrectionMode, setShowCorrectionMode] = useState(false);

  const [correctionInput, setCorrectionInput] = useState('');

  // ✅ NEW: Sotto-stati per Parser e Messaggi (parte variabile dinamica)
  const [currentParserSubstep, setCurrentParserSubstep] = useState<string | null>(null);
  const [currentMessageSubstep, setCurrentMessageSubstep] = useState<string | null>(null);

  // ✅ Helper per compatibilità: deriva booleani da wizardMode
  const showStructureConfirmation = wizardMode === WizardMode.DATA_STRUCTURE_PROPOSED;
  const structureConfirmed = wizardMode === WizardMode.DATA_STRUCTURE_CONFIRMED ||
                            wizardMode === WizardMode.GENERATING ||
                            wizardMode === WizardMode.COMPLETED;
  const showCorrectionMode = wizardMode === WizardMode.DATA_STRUCTURE_CORRECTION;

  // ✅ DEBUG: Log quando wizardMode cambia
  useEffect(() => {
    console.log('[useWizardState] 🔄 wizardMode changed:', {
      wizardMode,
      showStructureConfirmation,
      structureConfirmed,
      showCorrectionMode,
      dataSchemaLength: dataSchema.length,
    });
  }, [wizardMode, showStructureConfirmation, structureConfirmed, showCorrectionMode, dataSchema.length]);

  const [pipelineSteps, setPipelineSteps] = useState<PipelineStep[]>([
    {
      id: 'structure',
      label: 'Struttura dati',
      status: 'pending',
      payload: 'Devo capire come è composto il dato, quale struttura deve avere, quali sotto-dati sono necessari e come organizzarli per gestire al meglio la richiesta.'
    },
    {
      id: 'constraints',
      label: 'Regole di validazione',
      status: 'pending',
      payload: 'sto generando le regole di validazione per assicurare la correttezza dei dati...'
    },
    {
      id: 'parsers',
      label: 'Parser',
      status: 'pending',
      payload: 'sto generando i parser NLP per l\'estrazione dei dati da una frase:'
    },
    {
      id: 'messages',
      label: 'Messaggi',
      status: 'pending',
      payload: 'sto generando i messaggi per gestire il dialogo con l\'utente:'
    }
  ]);

  /**
   * Aggiorna il progresso di una fase specifica per un task
   */
  const updateTaskProgress = (
    taskId: string,
    phase: 'constraints' | 'parser' | 'messages',
    progress: number
  ) => {
    setDataSchema(prev => {
      const updateNode = (nodes: WizardTaskTreeNode[]): WizardTaskTreeNode[] => {
        return nodes.map(node => {
          if (node.id === taskId) {
            const progressField = phase === 'constraints' ? 'constraintsProgress' : phase === 'parser' ? 'parserProgress' : 'messagesProgress';
            return {
              ...node,
              pipelineStatus: {
                ...node.pipelineStatus,
                constraints: node.pipelineStatus?.constraints || 'pending',
                parser: node.pipelineStatus?.parser || 'pending',
                messages: node.pipelineStatus?.messages || 'pending',
                [progressField]: progress
              }
            };
          }
          if (node.subNodes && node.subNodes.length > 0) {
            return { ...node, subNodes: updateNode(node.subNodes) };
          }
          return node;
        });
      };
      return updateNode(prev);
    });
  };

  /**
   * Aggiorna lo stato di pipeline di un singolo task
   * Calcola automaticamente lo stato aggregato per la categoria
   */
  const updateTaskPipelineStatus = (
    taskId: string,
    phase: 'constraints' | 'parser' | 'messages',
    status: 'pending' | 'running' | 'completed'
  ) => {
    // Aggiorna lo stato del task nell'albero
    setDataSchema(prev => {
      const updateNode = (nodes: WizardTaskTreeNode[]): WizardTaskTreeNode[] => {
        return nodes.map(node => {
          if (node.id === taskId) {
            return {
              ...node,
              pipelineStatus: {
                ...node.pipelineStatus,
                constraints: phase === 'constraints' ? status : (node.pipelineStatus?.constraints || 'pending'),
                parser: phase === 'parser' ? status : (node.pipelineStatus?.parser || 'pending'),
                messages: phase === 'messages' ? status : (node.pipelineStatus?.messages || 'pending'),
                constraintsProgress: node.pipelineStatus?.constraintsProgress,
                parserProgress: node.pipelineStatus?.parserProgress,
                messagesProgress: node.pipelineStatus?.messagesProgress
              }
            };
          }
          if (node.subNodes && node.subNodes.length > 0) {
            return { ...node, subNodes: updateNode(node.subNodes) };
          }
          return node;
        });
      };
      const updated = updateNode(prev);

      // Calcola lo stato aggregato con il nuovo schema
      calculateAggregatedPipelineStatus(updated);

      return updated;
    });
  };

  /**
   * Raccoglie tutti i task (root + subtask) in una lista piatta
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
   * Calcola lo stato aggregato della pipeline:
   * - pending: se almeno un task è pending
   * - running: se almeno un task è running
   * - completed: solo quando TUTTI i task sono completed
   */
  const calculateAggregatedPipelineStatus = (currentSchema: WizardTaskTreeNode[]) => {
    const allTasks = flattenTaskTree(currentSchema);

    if (allTasks.length === 0) return;

    // Mappa fase -> stepId della pipeline centrale
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
        // ✅ NEW: Quando completato, aggiorna messaggio finale
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
  };

  const updatePipelineStep = (stepId: string, status: PipelineStep['status'], payload?: string) => {
    setPipelineSteps(prev => prev.map(step => {
      if (step.id === stepId) {
        return {
          ...step,
          status,
          ...(payload !== undefined ? { payload } : {})
        };
      }
      return step;
    }));
  };

  // ✅ NEW: Aggiorna la parte variabile per Parser
  const updateParserSubstep = (substep: string | null) => {
    setCurrentParserSubstep(substep);
    if (substep) {
      updatePipelineStep('parsers', 'running', `sto generando i parser NLP per l'estrazione dei dati da una frase: **${substep}**...`);
    }
  };

  // ✅ NEW: Aggiorna la parte variabile per Messaggi
  const updateMessageSubstep = (substep: string | null) => {
    setCurrentMessageSubstep(substep);
    if (substep) {
      updatePipelineStep('messages', 'running', `sto generando i messaggi per gestire il dialogo con l'utente: **${substep}**...`);
    }
  };

  // ✅ NEW: Helper per salvare messaggi per un nodo specifico
  const setMessagesForNode = (nodeId: string, nodeMessages: WizardStepMessages) => {
    setMessages(prev => {
      const newMap = new Map(prev);
      newMap.set(nodeId, nodeMessages);
      return newMap;
    });
  };

  const resetPipeline = () => {
    setPipelineSteps([
      {
        id: 'structure',
        label: 'Struttura dati',
        status: 'pending',
        payload: 'sto pensando a qual è la migliore struttura dati per questo task...'
      },
      {
        id: 'constraints',
        label: 'Regole di validazione',
        status: 'pending',
        payload: 'sto generando le regole di validazione per assicurare la correttezza dei dati...'
      },
      {
        id: 'parsers',
        label: 'Parser',
        status: 'pending',
        payload: 'sto generando i parser NLP per l\'estrazione dei dati da una frase:'
      },
      {
        id: 'messages',
        label: 'Messaggi',
        status: 'pending',
        payload: 'sto generando i messaggi per gestire il dialogo con l\'utente:'
      }
    ]);
  };

  return {
    // ✅ NEW: Enum unico
    wizardMode,
    setWizardMode,

    // ✅ DEPRECATED: Mantenuto per compatibilità
    currentStep,
    setCurrentStep,

    // ✅ userInput rimosso - usare taskLabel direttamente

    dataSchema,
    setDataSchema,
    constraints,
    setConstraints,
    nlpContract,
    setNlpContract,
    messages,
    setMessages: setMessagesForNode,
    speed,
    setSpeed,
    pipelineSteps,
    updatePipelineStep,
    resetPipeline,
    updateTaskPipelineStatus,
    updateTaskProgress,
    activeNodeId,
    setActiveNodeId,
    iconSize,
    setIconSize,
    selectedModuleId,
    setSelectedModuleId,

    // ✅ DEPRECATED: Derivate da wizardMode (read-only)
    showStructureConfirmation,
    structureConfirmed,
    showCorrectionMode,

    // ✅ Helper per settare wizardMode (mantiene compatibilità)
    setShowStructureConfirmation: (show: boolean) => {
      console.log('[useWizardState] 🔔 setShowStructureConfirmation called', { show, currentWizardMode: wizardMode });
      if (show) {
        console.log('[useWizardState] ✅ Setting wizardMode to DATA_STRUCTURE_PROPOSED');
        setWizardMode(WizardMode.DATA_STRUCTURE_PROPOSED);
      }
    },
    setStructureConfirmed: (confirmed: boolean) => {
      console.log('[useWizardState] 🔔 setStructureConfirmed called', { confirmed, currentWizardMode: wizardMode });
      if (confirmed && wizardMode === WizardMode.DATA_STRUCTURE_PROPOSED) {
        console.log('[useWizardState] ✅ Setting wizardMode to DATA_STRUCTURE_CONFIRMED');
        setWizardMode(WizardMode.DATA_STRUCTURE_CONFIRMED);
      }
    },
    setShowCorrectionMode: (show: boolean) => {
      console.log('[useWizardState] 🔔 setShowCorrectionMode called', { show, currentWizardMode: wizardMode });
      if (show) {
        console.log('[useWizardState] ✅ Setting wizardMode to DATA_STRUCTURE_CORRECTION');
        setWizardMode(WizardMode.DATA_STRUCTURE_CORRECTION);
      } else if (wizardMode === WizardMode.DATA_STRUCTURE_CORRECTION) {
        console.log('[useWizardState] ✅ Setting wizardMode back to DATA_STRUCTURE_PROPOSED');
        setWizardMode(WizardMode.DATA_STRUCTURE_PROPOSED);
      }
    },

    correctionInput,
    setCorrectionInput,

    // ✅ NEW: Sotto-stati per parte variabile dinamica
    currentParserSubstep,
    updateParserSubstep,
    currentMessageSubstep,
    updateMessageSubstep,

    // ✅ NEW: Generalized and contextualized messages
    messagesGeneralized,
    setMessagesGeneralized,
    messagesContextualized,
    setMessagesContextualized,
    shouldBeGeneral,
    setShouldBeGeneral
  };
}
