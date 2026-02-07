import { create } from 'zustand';

/**
 * Zustand store for managing cell overrides in the Response Editor TesterGrid
 *
 * ✅ FASE 2 - OPTIMIZATION: Zero prop drilling, eliminates re-renders when cellOverrides changes
 * ✅ PERFORMANCE: Components subscribe only to the overrides they need
 * ✅ SIMPLICITY: No context providers, no complex dependencies
 *
 * Key format: "${rowIdx}:${col}:${key}" (e.g., "0:det:value", "1:ner:day")
 * - rowIdx: Index of the row in examplesList
 * - col: Column type ('det' | 'ner' | 'llm')
 * - key: Field key (e.g., 'value', 'day', 'month', 'year')
 */
interface CellOverridesStore {
  // State
  overrides: Record<string, string>; // Key format: "${rowIdx}:${col}:${key}"

  // Actions
  setOverride: (rowIdx: number, col: 'det' | 'ner' | 'llm', key: string, value: string) => void;
  getOverride: (rowIdx: number, col: 'det' | 'ner' | 'llm', key: string) => string | undefined;
  hasOverride: (rowIdx: number, col: 'det' | 'ner' | 'llm', key: string) => boolean;
  removeOverride: (rowIdx: number, col: 'det' | 'ner' | 'llm', key: string) => void;
  clearOverrides: () => void;
  clearRowOverrides: (rowIdx: number) => void;

  // Batch operations
  setOverrides: (overrides: Record<string, string>) => void;
  getAllOverrides: () => Record<string, string>;

  // Utility: Reset store (useful when closing/opening editor or changing node)
  reset: () => void;
}

// Helper to generate key
const getOverrideKey = (rowIdx: number, col: 'det' | 'ner' | 'llm', key: string): string => {
  return `${rowIdx}:${col}:${key}`;
};

export const useCellOverridesStore = create<CellOverridesStore>((set, get) => ({
  // Initial state
  overrides: {},

  // Actions
  setOverride: (rowIdx, col, key, value) => {
    const overrideKey = getOverrideKey(rowIdx, col, key);
    set((state) => ({
      overrides: { ...state.overrides, [overrideKey]: value },
    }));
  },

  getOverride: (rowIdx, col, key) => {
    const state = get();
    const overrideKey = getOverrideKey(rowIdx, col, key);
    return state.overrides[overrideKey];
  },

  hasOverride: (rowIdx, col, key) => {
    const state = get();
    const overrideKey = getOverrideKey(rowIdx, col, key);
    return overrideKey in state.overrides;
  },

  removeOverride: (rowIdx, col, key) => {
    const overrideKey = getOverrideKey(rowIdx, col, key);
    set((state) => {
      const newOverrides = { ...state.overrides };
      delete newOverrides[overrideKey];
      return { overrides: newOverrides };
    });
  },

  clearOverrides: () => set({ overrides: {} }),

  clearRowOverrides: (rowIdx) => {
    set((state) => {
      const newOverrides = { ...state.overrides };
      // Remove all overrides for this row
      Object.keys(newOverrides).forEach((key) => {
        if (key.startsWith(`${rowIdx}:`)) {
          delete newOverrides[key];
        }
      });
      return { overrides: newOverrides };
    });
  },

  // Batch operations
  setOverrides: (overrides) => set({ overrides }),

  getAllOverrides: () => {
    const state = get();
    return state.overrides;
  },

  // Reset store
  reset: () => set({ overrides: {} }),
}));
