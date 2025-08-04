import { useCallback, useEffect } from 'react';
import { useThemeContext } from './context/ThemeContext';
import { elementRegistry } from './utils/elementRegistry';
import { ThemeElement, Position, ThemeProperties } from './types/theme';

// ============================================================================
// THEME MANAGER - ENTERPRISE GRADE
// ============================================================================

export function useThemeManager() {
  const { state, actions } = useThemeContext();
  const { isEditMode, customCursor, undoStack } = state;

  // ============================================================================
  // CURSOR MANAGEMENT
  // ============================================================================

  useEffect(() => {
    if (customCursor) {
      document.body.classList.add('theme-edit-mode');
      console.log('🎨 Cursor personalizzato applicato');
    } else {
      document.body.classList.remove('theme-edit-mode');
      console.log('🎨 Cursor personalizzato rimosso');
    }

    return () => {
      document.body.classList.remove('theme-edit-mode');
    };
  }, [customCursor]);

  // ============================================================================
  // DOM UPDATE MANAGEMENT
  // ============================================================================

  useEffect(() => {
    if (undoStack.length > 0) {
      const lastChange = undoStack[undoStack.length - 1];
      console.log('🎨 Applicando cambio colore:', lastChange);
      
      applyColorToElement(lastChange.elementId, lastChange.property, lastChange.newValue);
    }
  }, [undoStack]);

  const applyColorToElement = useCallback((
    elementId: string, 
    property: keyof ThemeProperties, 
    color: string
  ) => {
    const element = document.querySelector(`[data-theme-element="${elementId}"]`);
    if (element) {
      (element as HTMLElement).style[property as any] = color;
      console.log('🎨 Colore applicato a elemento:', elementId, property, color);
    } else {
      console.warn('🎨 Elemento non trovato:', elementId);
    }
  }, []);

  // ============================================================================
  // EDIT MODE MANAGEMENT
  // ============================================================================

  const toggleEditMode = useCallback(() => {
    console.log('🎨 Toggle edit mode chiamato');
    actions.toggleEditMode();
  }, [actions]);

  // ============================================================================
  // ELEMENT CLICK HANDLERS
  // ============================================================================

  const createClickHandler = useCallback((
    elementId: string, 
    property: keyof ThemeProperties
  ) => {
    return (event: React.MouseEvent) => {
      if (!isEditMode) return;
      
      event.preventDefault();
      event.stopPropagation();
      
      console.log('🎨 Click su elemento editabile:', elementId, property);
      
      const element = elementRegistry.get(elementId);
      if (element) {
        const position = { x: event.clientX, y: event.clientY };
        const originalColor = getCurrentElementColor(elementId, property);
        
        actions.openColorPicker(element, property, position, originalColor);
      } else {
        console.warn('🎨 Elemento non trovato nel registry:', elementId);
      }
    };
  }, [isEditMode, actions]);

  // ============================================================================
  // AUTO-DETECTION HANDLERS
  // ============================================================================

  const createAutoDetectionHandler = useCallback(() => {
    return (event: React.MouseEvent) => {
      if (!isEditMode) return;
      
      const target = event.target as HTMLElement;
      const themePart = target.closest('[data-theme-part]');
      
      if (themePart) {
        const elementId = themePart.getAttribute('data-theme-element');
        const property = themePart.getAttribute('data-theme-part');
        
        if (elementId && property) {
          console.log('🎨 Auto-detection:', elementId, property);
          const position = { x: event.clientX, y: event.clientY };
          const originalColor = getCurrentElementColor(elementId, property as keyof ThemeProperties);
          
          const tempElement: ThemeElement = {
            id: elementId,
            type: 'component',
            name: elementId,
            properties: {
              background: '#ffffff',
              color: '#000000',
              borderColor: '#cccccc',
              fontSize: '14px',
              fontWeight: 'normal'
            },
            selector: `[data-theme-element="${elementId}"]`,
            editableProperties: ['background', 'color', 'borderColor']
          };
          
          actions.openColorPicker(tempElement, property as keyof ThemeProperties, position, originalColor);
        }
      }
    };
  }, [isEditMode, actions]);

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  const getCurrentElementColor = useCallback((
    elementId: string, 
    property: keyof ThemeProperties
  ): string => {
    const element = document.querySelector(`[data-theme-element="${elementId}"]`);
    if (element) {
      const computedStyle = window.getComputedStyle(element as Element);
      return computedStyle[property as any] || '#000000';
    }
    return '#000000';
  }, []);

  const restoreOriginalColor = useCallback((
    elementId: string, 
    property: keyof ThemeProperties
  ) => {
    // Usa il colore originale dal context
    const originalColor = state.originalColor;
    applyColorToElement(elementId, property, originalColor);
    console.log('🎨 Colore originale ripristinato:', elementId, property, originalColor);
  }, [applyColorToElement, state.originalColor]);

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  return {
    // State
    isEditMode,
    customCursor,
    
    // Actions
    toggleEditMode,
    createClickHandler,
    createAutoDetectionHandler,
    applyColorToElement,
    restoreOriginalColor,
    getCurrentElementColor,
    
    // Context actions (pass-through)
    actions
  };
} 