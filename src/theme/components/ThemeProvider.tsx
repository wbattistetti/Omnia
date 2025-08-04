import React from 'react';
import { ThemeProvider as StateProvider } from '../context/ThemeContext';
import { ColorPicker } from './ColorPicker';
import { useThemeContext } from '../context/ThemeContext';
import { useThemeManager } from '../ThemeManager';

// ============================================================================
// THEME PROVIDER - ENTERPRISE GRADE
// ============================================================================

function ThemeProviderContent({ children }: { children: React.ReactNode }) {
  const { state } = useThemeContext();
  const { 
    isColorPickerOpen, 
    activeElement, 
    activeProperty, 
    pickerPosition,
    currentColor 
  } = state;

  // Utilizza il nuovo ThemeManager per la gestione del cursor e auto-detection
  useThemeManager();

  return (
    <>
      {children}
      <ColorPicker
        isOpen={isColorPickerOpen}
        position={pickerPosition}
        elementId={activeElement?.id || ''}
        property={activeProperty || ''}
        initialColor={currentColor}
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