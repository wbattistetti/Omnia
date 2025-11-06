import React, { createContext, useContext, ReactNode } from 'react';
import { useFontStore } from '../state/fontStore';

interface FontContextType {
  fontTypeClass: string;
  fontSizeClass: string;
  combinedClass: string;
  fontType: 'sans' | 'serif' | 'mono';
  fontSize: 'xs' | 'sm' | 'base' | 'md' | 'lg';
}

const FontContext = createContext<FontContextType | undefined>(undefined);

export function FontProvider({ children }: { children: ReactNode }) {
  const { fontType, fontSize } = useFontStore();

  const fontTypeClass = {
    sans: 'font-intent-sans',
    serif: 'font-intent-serif',
    mono: 'font-intent-mono',
  }[fontType];

  const fontSizeClass = {
    xs: 'text-intent-xs',
    sm: 'text-intent-sm',
    base: 'text-intent-base',
    md: 'text-intent-md',
    lg: 'text-intent-lg',
  }[fontSize];

  const value: FontContextType = {
    fontTypeClass,
    fontSizeClass,
    combinedClass: `${fontTypeClass} ${fontSizeClass}`,
    fontType,
    fontSize,
  };

  return <FontContext.Provider value={value}>{children}</FontContext.Provider>;
}

export function useFontContext(): FontContextType {
  const context = useContext(FontContext);
  if (!context) {
    throw new Error('useFontContext must be used within FontProvider');
  }
  return context;
}

