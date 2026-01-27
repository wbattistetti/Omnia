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
  notes: Record<string, string>; // Key format: "phrase|method" (e.g., "12|regex")
  editingNote: string | null;
  hoveredCell: string | null;

  // Actions (legacy - using rowIndex, kept for backward compatibility during migration)
  startEditing: (key: string) => void;
  stopEditing: () => void;
  getNote: (key: string) => string;
  hasNote: (key: string) => boolean;
  addNote: (key: string, text: string) => void;
  deleteNote: (key: string) => void;
  setHovered: (key: string | null) => void;
  isHovered: (key: string) => boolean;

  // ✅ NEW: Actions using phrase|method (stable key)
  getNoteByPhraseAndMethod: (phrase: string, method: string) => string;
  hasNoteForPhraseAndMethod: (phrase: string, method: string) => boolean;
  setNoteForPhraseAndMethod: (phrase: string, method: string, text: string) => void;
  deleteNoteForPhraseAndMethod: (phrase: string, method: string) => void;

  // Persistence
  loadNotes: (notes: Record<string, string>) => void;
  migrateOldNotes: (oldNotes: Record<string, string>, examplesList: string[]) => Record<string, string>;

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

  // ✅ NEW: Actions using phrase|method (stable key)
  getNoteByPhraseAndMethod: (phrase: string, method: string) => {
    const state = get();
    const key = getCellKeyFromPhrase(phrase, method);
    return state.notes[key] || '';
  },

  hasNoteForPhraseAndMethod: (phrase: string, method: string) => {
    const state = get();
    const key = getCellKeyFromPhrase(phrase, method);
    return !!state.notes[key];
  },

  setNoteForPhraseAndMethod: (phrase: string, method: string, text: string) => {
    const key = getCellKeyFromPhrase(phrase, method);
    set((state) => ({
      notes: { ...state.notes, [key]: text },
    }));
  },

  deleteNoteForPhraseAndMethod: (phrase: string, method: string) => {
    const key = getCellKeyFromPhrase(phrase, method);
    set((state) => {
      const newNotes = { ...state.notes };
      delete newNotes[key];
      return { notes: newNotes };
    });
  },

  // ✅ Persistence: Load notes from node
  loadNotes: (notes: Record<string, string>) => {
    set({ notes: { ...notes } });
  },

  // ✅ Migration: Convert old keys (rowIndex-column) to new keys (phrase|method)
  migrateOldNotes: (oldNotes: Record<string, string>, examplesList: string[]): Record<string, string> => {
    const migrated: Record<string, string> = {};

    for (const [oldKey, note] of Object.entries(oldNotes)) {
      // Check if it's an old key format: "rowIndex-column"
      const match = oldKey.match(/^(\d+)-(regex|ner|llm|det|embeddings)$/);
      if (match) {
        const rowIndex = parseInt(match[1], 10);
        const method = match[2];

        // Get phrase from examplesList
        if (rowIndex >= 0 && rowIndex < examplesList.length) {
          const phrase = examplesList[rowIndex];
          if (phrase) {
            // Create new key: "phrase|method"
            const newKey = getCellKeyFromPhrase(phrase, method);
            migrated[newKey] = note;
          }
        }
      } else {
        // Already new format or unknown format - keep as is
        migrated[oldKey] = note;
      }
    }

    return migrated;
  },
}));

/**
 * ✅ NEW: Generate cell key from phrase and method (stable key)
 * Format: "phrase|method"
 * Example: "12|regex", "13 maggio 2012|ner"
 */
export const getCellKeyFromPhrase = (phrase: string, method: string): string => {
  // Normalize phrase: trim and lowercase for consistency
  const normalizedPhrase = phrase.trim().toLowerCase();
  return `${normalizedPhrase}|${method}`;
};

/**
 * @deprecated Use getCellKeyFromPhrase instead
 * Kept for backward compatibility during migration
 */
export const getCellKey = (rowIndex: number, column: string): string => {
  return `${rowIndex}-${column}`;
};
