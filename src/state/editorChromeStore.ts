/**
 * Persisted UI chrome accent for editor/settings (sidebar highlights, accents).
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type EditorAccentPreset = 'amber' | 'cyan' | 'violet' | 'emerald';

interface EditorChromeState {
  accent: EditorAccentPreset;
  setAccent: (accent: EditorAccentPreset) => void;
}

export const useEditorChromeStore = create<EditorChromeState>()(
  persist(
    (set) => ({
      accent: 'amber',
      setAccent: (accent) => set({ accent }),
    }),
    { name: 'omnia-editor-chrome' }
  )
);
