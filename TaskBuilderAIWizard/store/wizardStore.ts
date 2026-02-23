// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Wizard Store (Zustand)
 *
 * Single source of truth for wizard state.
 * Eliminates race conditions, multiple sources of truth, and complex hook dependencies.
 */

import { create } from 'zustand';
import type { WizardTaskTreeNode, WizardStepMessages, WizardConstraint } from '../types';
import { WizardMode } from '../types/WizardMode';
import type { WizardStep } from '../types/WizardStep';

export type PipelineStep = {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  payload?: string;
  substeps?: PipelineStep[];
};

interface WizardStore {
  // ============================================
  // STATE
  // ============================================

  wizardMode: WizardMode;
  currentStep: WizardStep;
  dataSchema: WizardTaskTreeNode[];
  constraints: WizardConstraint[];
  setConstraints: (constraints: WizardConstraint[]) => void;
  // ❌ REMOVED: nlpContract - dataContract is now in node.dataContract
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
  // ✅ POINT OF NO RETURN: Flag that prevents any modification to structure phase after confirmation
  structureConfirmed: boolean;
  // ✅ NEW: Real counters (source of truth for progress)
  phaseCounters: {
    constraints: { completed: number; total: number };
    parsers: { completed: number; total: number };
    messages: { completed: number; total: number };
  };

  // ============================================
  // ACTIONS - Synchronous state updates
  // ============================================

  setWizardMode: (mode: WizardMode) => void;
  setCurrentStep: (step: WizardStep) => void;
  setDataSchema: (schema: WizardTaskTreeNode[] | ((prev: WizardTaskTreeNode[]) => WizardTaskTreeNode[])) => void;
  setConstraints: (constraints: WizardConstraint[] | ((prev: WizardConstraint[]) => WizardConstraint[])) => void;
  // ❌ REMOVED: setNlpContract - dataContract is now in node.dataContract
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
  setStructureConfirmed: (confirmed: boolean) => void;
  // ✅ NEW: Update phase counter (source of truth for progress)
  updatePhaseCounter: (phase: 'constraints' | 'parsers' | 'messages', completed: number, total: number) => void;
  reset: () => void;

  // ============================================
  // SELECTORS - Computed values
  // ============================================

  showStructureConfirmation: () => boolean;
  // ❌ REMOVED: structureConfirmed selector - CONFLICT with field
  // ✅ Use field directly: store.structureConfirmed (boolean)
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
  // ❌ REMOVED: nlpContract - dataContract is now in node.dataContract
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
  structureConfirmed: false,
  // ✅ NEW: Initialize phase counters
  phaseCounters: {
    constraints: { completed: 0, total: 0 },
    parsers: { completed: 0, total: 0 },
    messages: { completed: 0, total: 0 }
  },

  // ============================================
  // ACTIONS
  // ============================================

  setWizardMode: (mode) => {
    // ✅ POINT OF NO RETURN: If structure is confirmed, NEVER go back to DATA_STRUCTURE_PROPOSED
    // Access the boolean field directly (not the selector function)
    const currentState = get();
    const isConfirmed = (currentState as any as { structureConfirmed: boolean }).structureConfirmed === true;

    if (mode === WizardMode.DATA_STRUCTURE_PROPOSED && isConfirmed) {
      console.warn('[wizardStore] ⚠️ Attempted to set wizardMode to DATA_STRUCTURE_PROPOSED after confirmation - blocked');
      return;
    }

    set({ wizardMode: mode });
  },

  setCurrentStep: (step) => set({ currentStep: step }),

  setDataSchema: (schema) => set((state) => ({
    dataSchema: typeof schema === 'function' ? schema(state.dataSchema) : schema
  })),

  setConstraints: (constraints) => set((state) => ({
    constraints: typeof constraints === 'function' ? constraints(state.constraints) : constraints
  })),

  // ❌ REMOVED: setNlpContract - dataContract is now in node.dataContract

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

  updatePipelineStep: (stepId, status, payload) => {
    // ✅ POINT OF NO RETURN: If structure is confirmed, NEVER update structure step
    // EXCEPT: Allow updating to 'completed' when user clicks "Sì" (this is the confirmation action itself)
    const currentState = get();
    // Access the boolean field directly (not the selector function)
    const isConfirmed = (currentState as any as { structureConfirmed: boolean }).structureConfirmed === true;
    if (stepId === 'structure' && isConfirmed && status !== 'completed') {
      // Allow 'completed' status even if confirmed (this is the confirmation action itself)
      console.warn('[wizardStore] ⚠️ Attempted to update structure step after confirmation - blocked');
      return;
    }

    // ✅ DEBUG: Log pipeline step updates
    const currentStep = currentState.pipelineSteps.find(s => s.id === stepId);
    console.log(`[wizardStore] 📊 updatePipelineStep called`, {
      stepId,
      status,
      payload,
      currentStatus: currentStep?.status,
      currentPayload: currentStep?.payload,
      payloadChanged: currentStep?.payload !== payload,
      statusChanged: currentStep?.status !== status
    });

    set((state) => {
      // ✅ FIX 3: ALWAYS create new objects (even if unchanged) for React re-render
      const updated = state.pipelineSteps.map(step => {
        if (step.id === stepId) {
          // ✅ FIX: ALWAYS create new step object (no optimization - React needs new reference)
          const newStep = { ...step, status, ...(payload !== undefined ? { payload } : {}) };
          console.log(`[wizardStore] ✅ updatePipelineStep: Creating new step object`, {
            stepId,
            oldStatus: step.status,
            newStatus: status,
            oldPayload: step.payload,
            newPayload: payload,
            isSame: step.status === status && step.payload === payload
          });
          return newStep;
        }
        return step;
      });

      // ✅ FIX: ALWAYS return new array (even if unchanged) for React re-render
      console.log(`[wizardStore] 📊 updatePipelineStep: Returning new pipelineSteps array`, {
        stepId,
        updatedSteps: updated.map(s => ({ id: s.id, status: s.status, payload: s.payload }))
      });
      return { pipelineSteps: updated };
    });
  },

  // ✅ FIX 2: Update phase counter (source of truth for progress)
  updatePhaseCounter: (phase, completed, total) => {
    console.log(`[wizardStore] 📊 updatePhaseCounter called`, {
      phase,
      completed,
      total,
      progress: total > 0 ? Math.round((completed / total) * 100) : 0
    });
    set((state) => ({
      phaseCounters: {
        ...state.phaseCounters,
        [phase]: { completed, total }
      }
    }));
  },

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

  setStructureConfirmed: (confirmed) => set({ structureConfirmed: confirmed }),

  reset: () => set({
    wizardMode: WizardMode.START,
    currentStep: 'idle',
    dataSchema: [],
    constraints: [],
    // ❌ REMOVED: nlpContract - dataContract is now in node.dataContract
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
    structureConfirmed: false,
    phaseCounters: {
      constraints: { completed: 0, total: 0 },
      parsers: { completed: 0, total: 0 },
      messages: { completed: 0, total: 0 }
    }
  }),

  // ============================================
  // SELECTORS
  // ============================================

  showStructureConfirmation: () => {
    const state = get();
    // ✅ Verify: wizardMode is DATA_STRUCTURE_PROPOSED AND structureConfirmed is false
    return state.wizardMode === WizardMode.DATA_STRUCTURE_PROPOSED && !state.structureConfirmed;
  },

  // ❌ REMOVED: structureConfirmed selector - CONFLICT with field
  // ✅ Use field directly: store.structureConfirmed (boolean)

  showCorrectionMode: () => get().wizardMode === WizardMode.DATA_STRUCTURE_CORRECTION,

  getMessagesToUse: () => {
    const state = get();
    return state.messagesGeneralized.size > 0 ? state.messagesGeneralized : state.messages;
  }
}));
