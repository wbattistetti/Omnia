// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Grammar editor state: one vanilla Zustand store per editor instance (see GrammarStoreProvider).
 */
import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';
import { generateSafeGuid } from '@utils/idGenerator';
import type { Grammar, GrammarNode, GrammarEdge, SemanticSlot, SemanticSet } from '../../types/grammarTypes';
import { removeSlotBindingsForGrammarSlotId } from '../domain/grammar';
import type { SelectionState, EditorState } from '../../types/uiTypes';

export interface GrammarStore {
  // State
  grammar: Grammar | null;
  selection: SelectionState;
  editor: EditorState;

  // Actions - Grammar
  loadGrammar: (grammar: Grammar) => void;
  createGrammar: (name: string) => void;
  updateGrammar: (updates: Partial<Grammar>) => void;
  reset: () => void;

  // Actions - Nodes
  addNode: (node: GrammarNode) => void;
  updateNode: (nodeId: string, updates: Partial<GrammarNode>) => void;
  deleteNode: (nodeId: string) => void;
  selectNode: (nodeId: string | null) => void;

  // Actions - Edges
  addEdge: (edge: GrammarEdge) => void;
  updateEdge: (edgeId: string, updates: Partial<GrammarEdge>) => void;
  deleteEdge: (edgeId: string) => void;
  selectEdge: (edgeId: string | null) => void;

  // Actions - Semantic
  addSlot: (slot: SemanticSlot) => void;
  updateSlot: (slotId: string, updates: Partial<SemanticSlot>) => void;
  deleteSlot: (slotId: string) => void;
  selectSlot: (slotId: string | null) => void;

  addSemanticSet: (set: SemanticSet) => void;
  updateSemanticSet: (setId: string, updates: Partial<SemanticSet>) => void;
  deleteSemanticSet: (setId: string) => void;
  selectSet: (setId: string | null) => void;

  // Actions - Selection
  clearSelection: () => void;

  // Actions - Editor
  setEditing: (isEditing: boolean, nodeId?: string | null, edgeId?: string | null) => void;

  // Selectors
  getNode: (nodeId: string) => GrammarNode | undefined;
  getEdge: (edgeId: string) => GrammarEdge | undefined;
  getSlot: (slotId: string) => SemanticSlot | undefined;
  getSemanticSet: (setId: string) => SemanticSet | undefined;
  hasGrammar: () => boolean;
}

export type GrammarStoreApi = StoreApi<GrammarStore>;

const initialState = {
  grammar: null as Grammar | null,
  selection: {
    selectedNodeId: null,
    selectedEdgeId: null,
    selectedSlotId: null,
    selectedSetId: null,
  } as SelectionState,
  editor: {
    isEditing: false,
    editingNodeId: null,
    editingEdgeId: null,
  } as EditorState,
};

export function createGrammarStore(): GrammarStoreApi {
  return createStore<GrammarStore>((set, get) => ({
  // Initial state
  ...initialState,

  // Actions - Grammar
  loadGrammar: (grammar) => set({ grammar }),

  createGrammar: (name) => {
    const newGrammar: Grammar = {
      id: generateSafeGuid(),
      name,
      nodes: [],
      edges: [],
      slots: [],
      semanticSets: [],
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: '1.0.0',
      },
    };
    set({ grammar: newGrammar });
  },

  updateGrammar: (updates) => set((state) => ({
    grammar: state.grammar
      ? {
          ...state.grammar,
          ...updates,
          metadata: {
            ...state.grammar.metadata,
            updatedAt: Date.now(),
          },
        }
      : null,
  })),

  reset: () => set(initialState),

  // Actions - Nodes
  addNode: (node) => {
    const state = get();
    if (!state.grammar) return;
    set({
      grammar: {
        ...state.grammar,
        nodes: [...state.grammar.nodes, node],
        metadata: {
          ...state.grammar.metadata,
          updatedAt: Date.now(),
        },
      },
    });
  },

  updateNode: (nodeId, updates) => set((state) => ({
    grammar: state.grammar
      ? {
          ...state.grammar,
          nodes: state.grammar.nodes.map((n) =>
            n.id === nodeId
              ? { ...n, ...updates, updatedAt: Date.now() }
              : n
          ),
          metadata: {
            ...state.grammar.metadata,
            updatedAt: Date.now(),
          },
        }
      : null,
  })),

  deleteNode: (nodeId) => set((state) => {
    if (!state.grammar) return state;
    return {
      grammar: {
        ...state.grammar,
        nodes: state.grammar.nodes.filter((n) => n.id !== nodeId),
        edges: state.grammar.edges.filter(
          (e) => e.source !== nodeId && e.target !== nodeId
        ),
        metadata: {
          ...state.grammar.metadata,
          updatedAt: Date.now(),
        },
      },
      selection: {
        ...state.selection,
        selectedNodeId:
          state.selection.selectedNodeId === nodeId
            ? null
            : state.selection.selectedNodeId,
      },
    };
  }),

  selectNode: (nodeId) =>
    set((state) => ({
      selection: {
        ...state.selection,
        selectedNodeId: nodeId,
        selectedEdgeId: null, // Clear edge selection when selecting node
      },
    })),

  // Actions - Edges
  addEdge: (edge) => {
    const state = get();
    if (!state.grammar) return;
    set({
      grammar: {
        ...state.grammar,
        edges: [...state.grammar.edges, edge],
        metadata: {
          ...state.grammar.metadata,
          updatedAt: Date.now(),
        },
      },
    });
  },

  updateEdge: (edgeId, updates) => set((state) => ({
    grammar: state.grammar
      ? {
          ...state.grammar,
          edges: state.grammar.edges.map((e) =>
            e.id === edgeId ? { ...e, ...updates } : e
          ),
          metadata: {
            ...state.grammar.metadata,
            updatedAt: Date.now(),
          },
        }
      : null,
  })),

  deleteEdge: (edgeId) => set((state) => {
    if (!state.grammar) return state;
    return {
      grammar: {
        ...state.grammar,
        edges: state.grammar.edges.filter((e) => e.id !== edgeId),
        metadata: {
          ...state.grammar.metadata,
          updatedAt: Date.now(),
        },
      },
      selection: {
        ...state.selection,
        selectedEdgeId:
          state.selection.selectedEdgeId === edgeId
            ? null
            : state.selection.selectedEdgeId,
      },
    };
  }),

  selectEdge: (edgeId) =>
    set((state) => ({
      selection: {
        ...state.selection,
        selectedEdgeId: edgeId,
        selectedNodeId: null, // Clear node selection when selecting edge
      },
    })),

  // Actions - Semantic Slots
  addSlot: (slot) => set((state) => ({
    grammar: state.grammar
      ? {
          ...state.grammar,
          slots: [...state.grammar.slots, slot],
          metadata: {
            ...state.grammar.metadata,
            updatedAt: Date.now(),
          },
        }
      : null,
  })),

  updateSlot: (slotId, updates) => set((state) => ({
    grammar: state.grammar
      ? {
          ...state.grammar,
          slots: state.grammar.slots.map((s) =>
            s.id === slotId ? { ...s, ...updates } : s
          ),
          metadata: {
            ...state.grammar.metadata,
            updatedAt: Date.now(),
          },
        }
      : null,
  })),

  deleteSlot: (slotId) => set((state) => {
    if (!state.grammar) return state;
    return {
      grammar: {
        ...state.grammar,
        slots: state.grammar.slots.filter((s) => s.id !== slotId),
        slotBindings: removeSlotBindingsForGrammarSlotId(state.grammar.slotBindings, slotId),
        metadata: {
          ...state.grammar.metadata,
          updatedAt: Date.now(),
        },
      },
      selection: {
        ...state.selection,
        selectedSlotId:
          state.selection.selectedSlotId === slotId
            ? null
            : state.selection.selectedSlotId,
      },
    };
  }),

  selectSlot: (slotId) =>
    set((state) => ({
      selection: {
        ...state.selection,
        selectedSlotId: slotId,
      },
    })),

  // Actions - Semantic Sets
  addSemanticSet: (semanticSet) => set((state) => ({
    grammar: state.grammar
      ? {
          ...state.grammar,
          semanticSets: [...state.grammar.semanticSets, semanticSet],
          metadata: {
            ...state.grammar.metadata,
            updatedAt: Date.now(),
          },
        }
      : null,
  })),

  updateSemanticSet: (setId, updates) => set((state) => ({
    grammar: state.grammar
      ? {
          ...state.grammar,
          semanticSets: state.grammar.semanticSets.map((s) =>
            s.id === setId ? { ...s, ...updates } : s
          ),
          metadata: {
            ...state.grammar.metadata,
            updatedAt: Date.now(),
          },
        }
      : null,
  })),

  deleteSemanticSet: (setId) => set((state) => {
    if (!state.grammar) return state;
    return {
      grammar: {
        ...state.grammar,
        semanticSets: state.grammar.semanticSets.filter((s) => s.id !== setId),
        metadata: {
          ...state.grammar.metadata,
          updatedAt: Date.now(),
        },
      },
      selection: {
        ...state.selection,
        selectedSetId:
          state.selection.selectedSetId === setId
            ? null
            : state.selection.selectedSetId,
      },
    };
  }),

  selectSet: (setId) =>
    set((state) => ({
      selection: {
        ...state.selection,
        selectedSetId: setId,
      },
    })),

  // Actions - Selection
  clearSelection: () =>
    set((state) => ({
      selection: {
        selectedNodeId: null,
        selectedEdgeId: null,
        selectedSlotId: null,
        selectedSetId: null,
      },
    })),

  // Actions - Editor
  setEditing: (isEditing, nodeId = null, edgeId = null) =>
    set((state) => ({
      editor: {
        isEditing,
        editingNodeId: nodeId,
        editingEdgeId: edgeId,
      },
    })),

  // Selectors
  getNode: (nodeId) => {
    const state = get();
    return state.grammar?.nodes.find((n) => n.id === nodeId);
  },

  getEdge: (edgeId) => {
    const state = get();
    return state.grammar?.edges.find((e) => e.id === edgeId);
  },

  getSlot: (slotId) => {
    const state = get();
    return state.grammar?.slots.find((s) => s.id === slotId);
  },

  getSemanticSet: (setId) => {
    const state = get();
    return state.grammar?.semanticSets.find((s) => s.id === setId);
  },

  hasGrammar: () => {
    const state = get();
    return state.grammar !== null;
  },
}));
}
