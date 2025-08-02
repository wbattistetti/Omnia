import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { ThemeState, ThemeAction, themeReducer, initialState } from '../state/ThemeReducer';

// ============================================================================
// CONTEXT TYPE
// ============================================================================

interface ThemeContextType {
  state: ThemeState;
  dispatch: React.Dispatch<ThemeAction>;
}

// ============================================================================
// CONTEXT
// ============================================================================

const ThemeContext = createContext<ThemeContextType>({
  state: initialState,
  dispatch: () => {},
});

// ============================================================================
// PROVIDER
// ============================================================================

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [state, dispatch] = useReducer(themeReducer, initialState);

  return React.createElement(ThemeContext.Provider, { value: { state, dispatch } }, children);
}

// ============================================================================
// HOOK PRINCIPALE
// ============================================================================

export function useThemeState() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeState must be used within a ThemeProvider');
  }
  return context;
}

// ============================================================================
// HOOK SPECIALIZZATI
// ============================================================================

export function useEditMode() {
  const { state } = useThemeState();
  return state.isEditMode;
}

export function useMiniPicker() {
  const { state } = useThemeState();
  return {
    isOpen: state.isMiniPickerOpen,
    editingElement: state.editingElement,
    editingProperty: state.editingProperty,
    previewValue: state.previewValue,
    originalValue: state.originalValue,
  };
}

export function useCustomCursor() {
  const { state } = useThemeState();
  return state.customCursor;
}

export function useTemporaryChanges() {
  const { state } = useThemeState();
  return state.temporaryChanges;
} 