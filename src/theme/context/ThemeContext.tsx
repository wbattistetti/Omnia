import React, { createContext, useContext, useReducer, useCallback, ReactNode } from 'react';
import { ThemeState, ThemeAction, initialThemeState } from '../types/theme';
import { themeReducer } from '../reducers/themeReducer';
import { ThemeElement, Position } from '../types/theme';

// ============================================================================
// CONTEXT TYPE
// ============================================================================

interface ThemeContextType {
  state: ThemeState;
  actions: {
    toggleEditMode: () => void;
    openColorPicker: (element: ThemeElement, property: keyof ThemeElement['properties'], position: Position) => void;
    closeColorPicker: () => void;
    updateCurrentColor: (color: string) => void;
    applyColorChange: (elementId: string, property: keyof ThemeElement['properties'], color: string) => void;
    undo: () => void;
    redo: () => void;
  };
}

// ============================================================================
// CONTEXT CREATION
// ============================================================================

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [state, dispatch] = useReducer(themeReducer, initialThemeState);

  const actions = {
    toggleEditMode: useCallback(() => {
      console.log('🎨 Toggle edit mode');
      dispatch({ type: 'TOGGLE_EDIT_MODE' });
    }, []),

    openColorPicker: useCallback((
      element: ThemeElement, 
      property: keyof ThemeElement['properties'], 
      position: Position
    ) => {
      console.log('🎨 Opening color picker:', { element: element.name, property, position });
      const originalColor = element.properties[property] || '#000000';
      dispatch({ 
        type: 'OPEN_COLOR_PICKER', 
        payload: { element, property, position, originalColor } 
      });
    }, []),

    closeColorPicker: useCallback(() => {
      console.log('🎨 Closing color picker');
      dispatch({ type: 'CLOSE_COLOR_PICKER' });
    }, []),

    updateCurrentColor: useCallback((color: string) => {
      dispatch({ type: 'UPDATE_CURRENT_COLOR', payload: color });
    }, []),

    applyColorChange: useCallback((
      elementId: string, 
      property: keyof ThemeElement['properties'], 
      color: string
    ) => {
      console.log('🎨 Applying color change:', { elementId, property, color });
      dispatch({ 
        type: 'APPLY_COLOR_CHANGE', 
        payload: { elementId, property, color } 
      });
    }, []),

    undo: useCallback(() => {
      console.log('🎨 Undo');
      dispatch({ type: 'UNDO' });
    }, []),

    redo: useCallback(() => {
      console.log('🎨 Redo');
      dispatch({ type: 'REDO' });
    }, []),
  };

  return (
    <ThemeContext.Provider value={{ state, actions }}>
      {children}
    </ThemeContext.Provider>
  );
}

// ============================================================================
// CUSTOM HOOK
// ============================================================================

export function useThemeContext() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeContext must be used within ThemeProvider');
  }
  return context;
} 