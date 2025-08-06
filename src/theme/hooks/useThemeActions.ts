import { useCallback } from 'react';
import { useThemeState } from './useThemeState';
import { ThemeElement } from '../types';
import { elementRegistry } from '../utils/elementRegistry';

// ============================================================================
// HOOK PER LE AZIONI DEL TEMA
// ============================================================================

export function useThemeActions() {
  const { dispatch } = useThemeState();

  // ============================================================================
  // AZIONI PRINCIPALI
  // ============================================================================

  const toggleEditMode = useCallback(() => {
    dispatch({ type: 'TOGGLE_EDIT_MODE' });
  }, [dispatch]);

  const openEditorAt = useCallback((
    elementName: string,
    part: 'background' | 'text' | 'border',
    coordinates: { x: number; y: number }
  ) => {
    
    const element = elementRegistry.get(elementName);
    if (!element) {
      return;
    }

    const propertyMap = {
      background: 'background',
      text: 'color',
      border: 'borderColor'
    } as const;
    
    const property = propertyMap[part];
    if (!property) {
      return;
    }

    // Get original value from CSS or default
    const originalValue = element.properties[property] || '#000000';
    
    openMiniPicker(element, property, coordinates, originalValue);
  }, [dispatch]);

  const openMiniPicker = useCallback((
    element: ThemeElement,
    property: keyof ThemeElement['properties'],
    position: { x: number; y: number },
    originalValue: string
  ) => {
    dispatch({
      type: 'OPEN_MINI_PICKER',
      payload: { element, property, position, originalValue }
    });
  }, [dispatch]);

  const closeMiniPicker = useCallback(() => {
    dispatch({ type: 'CLOSE_MINI_PICKER' });
  }, [dispatch]);

  const updatePreviewValue = useCallback((value: string) => {
    dispatch({ type: 'UPDATE_PREVIEW_VALUE', payload: value });
  }, [dispatch]);

  const applyPropertyChange = useCallback((
    elementId: string,
    property: keyof ThemeElement['properties'],
    value: string
  ) => {
    dispatch({
      type: 'APPLY_PROPERTY_CHANGE',
      payload: { elementId, property, value }
    });
  }, [dispatch]);

  const restoreOriginalValue = useCallback(() => {
    dispatch({ type: 'RESTORE_ORIGINAL_VALUE' });
  }, [dispatch]);

  const setCustomCursor = useCallback((enabled: boolean) => {
    dispatch({ type: 'SET_CUSTOM_CURSOR', payload: enabled });
  }, [dispatch]);

  const clearTemporaryChanges = useCallback(() => {
    dispatch({ type: 'CLEAR_TEMPORARY_CHANGES' });
  }, [dispatch]);

  // ============================================================================
  // AZIONI COMPOSTE
  // ============================================================================

  const handleApplyChange = useCallback((
    elementId: string,
    property: keyof ThemeElement['properties'],
    value: string
  ) => {
    applyPropertyChange(elementId, property, value);
  }, [applyPropertyChange]);

  const handleCancelChange = useCallback(() => {
    restoreOriginalValue();
  }, [restoreOriginalValue]);

  const handlePreviewChange = useCallback((value: string) => {
    updatePreviewValue(value);
  }, [updatePreviewValue]);

  // ============================================================================
  // RETURN DELLE AZIONI
  // ============================================================================

  return {
    // Azioni base
    toggleEditMode,
    openEditorAt,
    openMiniPicker,
    closeMiniPicker,
    updatePreviewValue,
    applyPropertyChange,
    restoreOriginalValue,
    setCustomCursor,
    clearTemporaryChanges,
    
    // Azioni composte
    handleApplyChange,
    handleCancelChange,
    handlePreviewChange,
  };
} 