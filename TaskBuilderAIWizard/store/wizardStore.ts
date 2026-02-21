// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Wizard Store (Zustand)
 *
 * Single source of truth for wizard state.
 * Eliminates race conditions, multiple sources of truth, and complex hook dependencies.
 */

import { create } from 'zustand';
import type { WizardTaskTreeNode, WizardStepMessages, WizardConstraint, WizardNLPContract } from '../types';
import { WizardMode } from '../types/WizardMode';
import type { WizardStep } from '../types/WizardStep';

export type PipelineStep = {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  payload?: string;
};

interface WizardStore {
  // ============================================
  // STATE
  // ============================================

  wizardMode: WizardMode;
  currentStep: WizardStep;
  dataSchema: WizardTaskTreeNode[];
  constraints: WizardConstraint[];
  nlpContract: WizardNLPContract | null;
  messages: Map<string, WizardStepMessages>;
  messagesGeneralized: Map<string, WizardStepMessages>;
  messagesContextualized: Map<string, WizardStepMessages>;
  shouldBeGeneral: boolean;
  activeNodeId: string | null;
  selectedModuleId: string | null;
  correctionInput: string;
  currentParserSubstep: string | null;
  currentMessageSubstep: string | null;
  pipelineSteps: PipelineStep[];

  // ============================================
  // ACTIONS - Synchronous state updates
  // ============================================

  setWizardMode: (mode: WizardMode) => void;
  setCurrentStep: (step: WizardStep) => void;
  setDataSchema: (schema: WizardTaskTreeNode[] | ((prev: WizardTaskTreeNode[]) => WizardTaskTreeNode[])) => void;
  setConstraints: (constraints: WizardConstraint[]) => void;
  setNlpContract: (contract: WizardNLPContract | null) => void;
  setMessages: (nodeId: string, messages: WizardStepMessages) => void;
  setMessagesGeneralized: (nodeId: string, messages: WizardStepMessages) => void;
  setMessagesContextualized: (nodeId: string, messages: WizardStepMessages) => void;
  setShouldBeGeneral: (value: boolean) => void;
  setActiveNodeId: (nodeId: string | null) => void;
  setSelectedModuleId: (moduleId: string | null) => void;
  setCorrectionInput: (input: string) => void;
  setCurrentParserSubstep: (substep: string | null) => void;
  setCurrentMessageSubstep: (substep: string | null) => void;
  updatePipelineStep: (stepId: string, status: PipelineStep['status'], payload?: string) => void;
  updateTaskPipelineStatus: (taskId: string, phase: 'constraints' | 'parser' | 'messages', status: 'pending' | 'running' | 'completed' | 'failed') => void;
  updateTaskProgress: (taskId: string, phase: 'constraints' | 'parser' | 'messages', progress: number) => void;
  reset: () => void;

  // ============================================
  // SELECTORS - Computed values
  // ============================================

  showStructureConfirmation: () => boolean;
  structureConfirmed: () => boolean;
  showCorrectionMode: () => boolean;
  getMessagesToUse: () => Map<string, WizardStepMessages>;
}

const initialPipelineSteps: PipelineStep[] = [
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
];

export const useWizardStore = create<WizardStore>((set, get) => ({
  // ============================================
  // INITIAL STATE
  // ============================================

  wizardMode: WizardMode.START,
  currentStep: 'idle',
  dataSchema: [],
  constraints: [],
  nlpContract: null,
  messages: new Map(),
  messagesGeneralized: new Map(),
  messagesContextualized: new Map(),
  shouldBeGeneral: false,
  activeNodeId: null,
  selectedModuleId: null,
  correctionInput: '',
  currentParserSubstep: null,
  currentMessageSubstep: null,
  pipelineSteps: initialPipelineSteps,

  // ============================================
  // ACTIONS
  // ============================================

  setWizardMode: (mode) => set({ wizardMode: mode }),

  setCurrentStep: (step) => set({ currentStep: step }),

  setDataSchema: (schema) => set((state) => ({
    dataSchema: typeof schema === 'function' ? schema(state.dataSchema) : schema
  })),

  setConstraints: (constraints) => set({ constraints }),

  setNlpContract: (contract) => set({ nlpContract: contract }),

  setMessages: (nodeId, messages) => set((state) => {
    const newMap = new Map(state.messages);
    newMap.set(nodeId, messages);
    return { messages: newMap };
  }),

  setMessagesGeneralized: (nodeId, messages) => set((state) => {
    const newMap = new Map(state.messagesGeneralized);
    newMap.set(nodeId, messages);
    return { messagesGeneralized: newMap };
  }),

  setMessagesContextualized: (nodeId, messages) => set((state) => {
    const newMap = new Map(state.messagesContextualized);
    newMap.set(nodeId, messages);
    return { messagesContextualized: newMap };
  }),

  setShouldBeGeneral: (value) => set({ shouldBeGeneral: value }),

  setActiveNodeId: (nodeId) => set({ activeNodeId: nodeId }),

  setSelectedModuleId: (moduleId) => set({ selectedModuleId: moduleId }),

  setCorrectionInput: (input) => set({ correctionInput: input }),

  setCurrentParserSubstep: (substep) => set({ currentParserSubstep: substep }),

  setCurrentMessageSubstep: (substep) => set({ currentMessageSubstep: substep }),

  updatePipelineStep: (stepId, status, payload) => set((state) => {
    const updated = state.pipelineSteps.map(step => {
      if (step.id === stepId) {
        // Only update if status or payload actually changed
        if (step.status === status && step.payload === payload) {
          return step; // Return same reference if no change
        }
        return { ...step, status, ...(payload !== undefined ? { payload } : {}) };
      }
      return step;
    });

    // Check if anything actually changed
    const hasChanged = updated.some((step, index) => step !== state.pipelineSteps[index]);
    return hasChanged ? { pipelineSteps: updated } : {};
  }),

  updateTaskPipelineStatus: (taskId, phase, status) => set((state) => {
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
    return { dataSchema: updateNode(state.dataSchema) };
  }),

  updateTaskProgress: (taskId, phase, progress) => set((state) => {
    const updateNode = (nodes: WizardTaskTreeNode[]): WizardTaskTreeNode[] => {
      return nodes.map(node => {
        if (node.id === taskId) {
          const progressField = phase === 'constraints' ? 'constraintsProgress'
                           : phase === 'parser' ? 'parserProgress'
                           : 'messagesProgress';
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
    return { dataSchema: updateNode(state.dataSchema) };
  }),

  reset: () => set({
    wizardMode: WizardMode.START,
    currentStep: 'idle',
    dataSchema: [],
    constraints: [],
    nlpContract: null,
    messages: new Map(),
    messagesGeneralized: new Map(),
    messagesContextualized: new Map(),
    shouldBeGeneral: false,
    activeNodeId: null,
    selectedModuleId: null,
    correctionInput: '',
    currentParserSubstep: null,
    currentMessageSubstep: null,
    pipelineSteps: initialPipelineSteps
  }),

  // ============================================
  // SELECTORS
  // ============================================

  showStructureConfirmation: () => get().wizardMode === WizardMode.DATA_STRUCTURE_PROPOSED,

  structureConfirmed: () => {
    const mode = get().wizardMode;
    return mode === WizardMode.DATA_STRUCTURE_CONFIRMED ||
           mode === WizardMode.GENERATING ||
           mode === WizardMode.COMPLETED;
  },

  showCorrectionMode: () => get().wizardMode === WizardMode.DATA_STRUCTURE_CORRECTION,

  getMessagesToUse: () => {
    const state = get();
    return state.messagesGeneralized.size > 0 ? state.messagesGeneralized : state.messages;
  }
}));
