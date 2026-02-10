// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useState, useMemo } from 'react';
import { WizardStep, WizardConstraint, WizardNLPContract, WizardStepMessages, WizardTaskTreeNode } from '../types';
import { WizardMode } from '../types/WizardMode';
import { SimulationSpeed } from '../utils/delays';

export type PipelineStep = {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  payload?: string;
  substeps?: PipelineStep[];
};

/**
 * Hook che gestisce SOLO lo stato del wizard.
 * Nessuna logica, nessuna transizione, nessuna API, nessun effetto.
 * Tutto deve essere stabile e memoizzato.
 */
export function useWizardState() {
  // ============================================
  // STATO PURO - Nessuna logica
  // ============================================

  const [wizardMode, setWizardMode] = useState<WizardMode>(WizardMode.START);
  const [currentStep, setCurrentStep] = useState<WizardStep>('idle');
  const [dataSchema, setDataSchema] = useState<WizardTaskTreeNode[]>([]);
  const [constraints, setConstraints] = useState<WizardConstraint[]>([]);
  const [nlpContract, setNlpContract] = useState<WizardNLPContract | null>(null);
  const [messages, setMessages] = useState<Map<string, WizardStepMessages>>(new Map());
  const [messagesGeneralized, setMessagesGeneralized] = useState<Map<string, WizardStepMessages>>(new Map());
  const [messagesContextualized, setMessagesContextualized] = useState<Map<string, WizardStepMessages>>(new Map());
  const [shouldBeGeneral, setShouldBeGeneral] = useState<boolean>(false);
  const [speed, setSpeed] = useState<SimulationSpeed>('fast');
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [iconSize, setIconSize] = useState<number>(64);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [correctionInput, setCorrectionInput] = useState('');
  const [currentParserSubstep, setCurrentParserSubstep] = useState<string | null>(null);
  const [currentMessageSubstep, setCurrentMessageSubstep] = useState<string | null>(null);

  // Pipeline steps - stato iniziale
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

  // ============================================
  // HELPER DERIVATI - Read-only, memoizzati
  // ============================================

  const showStructureConfirmation = useMemo(
    () => wizardMode === WizardMode.DATA_STRUCTURE_PROPOSED,
    [wizardMode]
  );

  const structureConfirmed = useMemo(
    () => wizardMode === WizardMode.DATA_STRUCTURE_CONFIRMED ||
          wizardMode === WizardMode.GENERATING ||
          wizardMode === WizardMode.COMPLETED,
    [wizardMode]
  );

  const showCorrectionMode = useMemo(
    () => wizardMode === WizardMode.DATA_STRUCTURE_CORRECTION,
    [wizardMode]
  );

  // ============================================
  // SETTER SEMPLICI - Nessuna logica
  // ============================================

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

  const setMessagesForNode = (nodeId: string, nodeMessages: WizardStepMessages) => {
    setMessages(prev => {
      const newMap = new Map(prev);
      const hadPreviousValue = newMap.has(nodeId);
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

  /**
   * Aggiorna il progresso di una fase specifica per un task
   * Setter semplice che aggiorna dataSchema
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
   * Setter semplice che aggiorna dataSchema
   * ✅ C3: Aggiunto stato 'failed' per gestire nodi falliti
   */
  const updateTaskPipelineStatus = (
    taskId: string,
    phase: 'constraints' | 'parser' | 'messages',
    status: 'pending' | 'running' | 'completed' | 'failed'
  ) => {
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
      return updateNode(prev);
    });
  };

  // ============================================
  // RETURN - Solo stato e setter semplici
  // ============================================

  return {
    // Stato wizard
    wizardMode,
    setWizardMode,
    currentStep,
    setCurrentStep,

    // Stato dati
    dataSchema,
    setDataSchema,
    constraints,
    setConstraints,
    nlpContract,
    setNlpContract,
    messages,
    setMessages: setMessagesForNode,
    messagesGeneralized,
    setMessagesGeneralized,
    messagesContextualized,
    setMessagesContextualized,
    shouldBeGeneral,
    setShouldBeGeneral,

    // Stato UI
    speed,
    setSpeed,
    activeNodeId,
    setActiveNodeId,
    iconSize,
    setIconSize,
    selectedModuleId,
    setSelectedModuleId,
    correctionInput,
    setCorrectionInput,
    currentParserSubstep,
    setCurrentParserSubstep,
    currentMessageSubstep,
    setCurrentMessageSubstep,

    // Pipeline
    pipelineSteps,
    setPipelineSteps,
    updatePipelineStep,
    resetPipeline,
    updateTaskProgress,
    updateTaskPipelineStatus,

    // Helper derivati (read-only)
    showStructureConfirmation,
    structureConfirmed,
    showCorrectionMode,
  };
}
