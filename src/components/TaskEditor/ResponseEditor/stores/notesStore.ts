import { create } from 'zustand';

/**
 * Zustand store for managing cell notes in the Response Editor
 *
 * ✅ ENTERPRISE-READY: Zero prop drilling, zero memo comparison issues
 * ✅ PERFORMANCE: Components subscribe only to the state they need
 * ✅ SIMPLICITY: No context providers, no complex dependencies
 */
interface NotesStore {
  // State
  notes: Record<string, string>;
  editingNote: string | null;
  hoveredCell: string | null;

  // Actions
  startEditing: (key: string) => void;
  stopEditing: () => void;
  getNote: (key: string) => string;
  hasNote: (key: string) => boolean;
  addNote: (key: string, text: string) => void;
  deleteNote: (key: string) => void;
  setHovered: (key: string | null) => void;
  isHovered: (key: string) => boolean;

  // Utility: Reset store (useful when closing/opening editor)
  reset: () => void;
}

export const useNotesStore = create<NotesStore>((set, get) => ({
  // Initial state
  notes: {},
  editingNote: null,
  hoveredCell: null,

  // Actions
  startEditing: (key) => set({ editingNote: key }),
  stopEditing: () => set({ editingNote: null }),

  // ✅ Functions that use get() - must be defined as arrow functions
  getNote: (key: string) => {
    const state = get();
    return state.notes[key] || '';
  },
  hasNote: (key: string) => {
    const state = get();
    return !!state.notes[key];
  },

  addNote: (key, text) =>
    set((state) => ({
      notes: { ...state.notes, [key]: text },
    })),

  deleteNote: (key) =>
    set((state) => {
      const newNotes = { ...state.notes };
      delete newNotes[key];
      return { notes: newNotes };
    }),

  setHovered: (key) => set({ hoveredCell: key }),
  isHovered: (key: string) => {
    const state = get();
    return state.hoveredCell === key;
  },

  reset: () => set({ notes: {}, editingNote: null, hoveredCell: null }),
}));

/**
 * Helper function to generate cell key (for backward compatibility)
 */
export const getCellKey = (rowIndex: number, column: string): string => {
  return `${rowIndex}-${column}`;
};
