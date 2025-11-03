import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type FontType = 'sans' | 'serif' | 'mono';
type FontSize = 'xs' | 'sm' | 'base' | 'md' | 'lg';

interface FontState {
  fontType: FontType;
  fontSize: FontSize;
  setFontType: (type: FontType) => void;
  setFontSize: (size: FontSize) => void;
}

export const useFontStore = create<FontState>()(
  persist(
    (set) => ({
      fontType: 'sans',
      fontSize: 'xs', // Default più piccolo
      setFontType: (type) => set({ fontType: type }),
      setFontSize: (size) => set({ fontSize: size }),
    }),
    {
      name: 'app-font-preferences', // Cambiato da intent-editor a app
    }
  )
);

export type { FontType, FontSize };

