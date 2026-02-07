import { useState } from 'react';
import { WizardStep, FakeDataNode, FakeConstraint, FakeNLPContract, FakeStepMessages, FakeTaskTreeNode } from '../types';
import { SimulationSpeed } from '../utils/delays';

export type PipelineStep = {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  payload?: string;
  substeps?: PipelineStep[];
};

export function useWizardState() {
  const [currentStep, setCurrentStep] = useState<WizardStep>('idle');
  const [userInput, setUserInput] = useState('Chiedi la data di nascita');
  const [dataSchema, setDataSchema] = useState<FakeTaskTreeNode[]>([]);
  const [constraints, setConstraints] = useState<FakeConstraint[]>([]);
  const [nlpContract, setNlpContract] = useState<FakeNLPContract | null>(null);
  const [messages, setMessages] = useState<FakeStepMessages | null>(null);
  const [speed, setSpeed] = useState<SimulationSpeed>('fast');
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [iconSize, setIconSize] = useState<number>(64);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [showStructureConfirmation, setShowStructureConfirmation] = useState(false);
  const [structureConfirmed, setStructureConfirmed] = useState(false);
  const [showCorrectionMode, setShowCorrectionMode] = useState(false);
  const [correctionInput, setCorrectionInput] = useState('');

  const [pipelineSteps, setPipelineSteps] = useState<PipelineStep[]>([
    {
      id: 'structure',
      label: 'Struttura dati',
      status: 'pending',
      payload: 'Devo capire come è composto il dato, quale struttura deve avere, quali sotto-dati sono necessari e come organizzarli per gestire al meglio la richiesta.'
    },
    {
      id: 'constraints',
      label: 'Vincoli di validazione',
      status: 'pending',
      payload: 'Sto definendo le regole di validazione per assicurare che i dati raccolti siano corretti, completi e coerenti con i requisiti del task.'
    },
    {
      id: 'parsers',
      label: 'Parser',
      status: 'pending',
      payload: 'Servono per l\'interpretazione della frase'
    },
    {
      id: 'messages',
      label: 'Messaggi',
      status: 'pending',
      payload: 'Sto creando i messaggi per ogni situazione: quando chiedo il dato all\'utente, quando non ho capito la risposta, quando non ho sentito bene, quando devo confermare, ecc.'
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
      const updateNode = (nodes: FakeTaskTreeNode[]): FakeTaskTreeNode[] => {
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
      const updateNode = (nodes: FakeTaskTreeNode[]): FakeTaskTreeNode[] => {
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
   * Calcola lo stato aggregato della pipeline:
   * - pending: se almeno un task è pending
   * - running: se almeno un task è running
   * - completed: solo quando TUTTI i task sono completed
   */
  const calculateAggregatedPipelineStatus = (currentSchema: FakeTaskTreeNode[]) => {
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
      } else if (statuses.some(s => s === 'running')) {
        aggregatedStatus = 'running';
      }

      return { ...step, status: aggregatedStatus };
    }));
  };

  const updatePipelineStep = (stepId: string, status: PipelineStep['status']) => {
    setPipelineSteps(prev => prev.map(step => {
      if (step.id === stepId) {
        return { ...step, status };
      }
      return step;
    }));
  };

  const resetPipeline = () => {
    setPipelineSteps([
      {
        id: 'structure',
        label: 'Struttura dati',
        status: 'pending',
        payload: 'Devo capire come è composto il dato, quale struttura deve avere, quali sotto-dati sono necessari e come organizzarli per gestire al meglio la richiesta.'
      },
      {
        id: 'constraints',
        label: 'Vincoli di validazione',
        status: 'pending',
        payload: 'Sto definendo le regole di validazione per assicurare che i dati raccolti siano corretti, completi e coerenti con i requisiti del task.'
      },
      {
        id: 'parsers',
        label: 'Parser',
        status: 'pending',
        payload: 'Servono per l\'interpretazione della frase'
      },
      {
        id: 'messages',
        label: 'Messaggi',
        status: 'pending',
        payload: 'Sto creando i messaggi per ogni situazione: quando chiedo il dato all\'utente, quando non ho capito la risposta, quando non ho sentito bene, quando devo confermare, ecc.'
      }
    ]);
  };

  return {
    currentStep,
    setCurrentStep,
    userInput,
    setUserInput,
    dataSchema,
    setDataSchema,
    constraints,
    setConstraints,
    nlpContract,
    setNlpContract,
    messages,
    setMessages,
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
    showStructureConfirmation,
    setShowStructureConfirmation,
    structureConfirmed,
    setStructureConfirmed,
    showCorrectionMode,
    setShowCorrectionMode,
    correctionInput,
    setCorrectionInput
  };
}
