import React from 'react';
import { ThemeProvider as StateProvider } from '../hooks/useThemeState';
import { MiniColorPicker } from './MiniColorPicker';
import { useThemeState } from '../hooks/useThemeState';

function ThemeProviderContent({ children }: { children: React.ReactNode }) {
  const { state } = useThemeState();
  const { isMiniPickerOpen, editingElement, editingProperty, originalValue } = state;

  return (
    <>
      {children}
      <MiniColorPicker
        isOpen={isMiniPickerOpen}
        position={{ x: 100, y: 100 }} // Default position, will be updated by actions
        elementId={editingElement?.id || ''}
        property={editingProperty || ''}
        initialValue={originalValue}
      />
    </>
  );
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <StateProvider>
      <ThemeProviderContent>
        {children}
      </ThemeProviderContent>
    </StateProvider>
  );
} 