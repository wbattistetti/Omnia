import { useState, useEffect, useCallback } from 'react';
import { useThemeContext } from '../context/ThemeContext';
import { elementRegistry } from '../utils/elementRegistry';

export function useThemeEditor() {
  const { state, actions } = useThemeContext();
  const { isEditMode, customCursor, undoStack } = state;

  // Applica il cursor personalizzato
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

  // Applica i cambiamenti di colore agli elementi
  useEffect(() => {
    if (undoStack.length > 0) {
      const lastChange = undoStack[undoStack.length - 1];
      console.log('🎨 Applicando cambio colore:', lastChange);
      
      // Trova l'elemento nel DOM
      const element = document.querySelector(`[data-theme-element="${lastChange.elementId}"]`);
      if (element) {
        // Applica il colore
        (element as HTMLElement).style[lastChange.property as any] = lastChange.newValue;
        console.log('🎨 Colore applicato a elemento:', lastChange.elementId, lastChange.property, lastChange.newValue);
      } else {
        console.warn('🎨 Elemento non trovato:', lastChange.elementId);
      }
    }
  }, [undoStack]);

  const toggleEditMode = useCallback(() => {
    console.log('🎨 Toggle edit mode chiamato');
    actions.toggleEditMode();
  }, [actions]);

  const createClickHandler = useCallback((elementId: string, property: string) => {
    return (event: React.MouseEvent) => {
      if (!isEditMode) return;
      
      event.preventDefault();
      event.stopPropagation();
      
      console.log('🎨 Click su elemento editabile:', elementId, property);
      
      // Trova l'elemento nel registry
      const element = elementRegistry.get(elementId);
      if (element) {
        const position = { x: event.clientX, y: event.clientY };
        actions.openColorPicker(element, property as any, position);
      } else {
        console.warn('🎨 Elemento non trovato nel registry:', elementId);
      }
    };
  }, [isEditMode, actions]);

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
          
          // Crea un elemento temporaneo per il color picker
          const tempElement = {
            id: elementId,
            type: 'component' as const,
            name: elementId,
            properties: {
              background: '#ffffff',
              color: '#000000',
              borderColor: '#cccccc',
              fontSize: '14px',
              fontWeight: 'normal'
            },
            selector: `[data-theme-element="${elementId}"]`,
            editableProperties: ['background', 'color', 'borderColor'] as ('background' | 'color' | 'borderColor')[]
          };
          
          actions.openColorPicker(tempElement, property as any, position);
        }
      }
    };
  }, [isEditMode, actions]);

  return {
    isEditMode,
    customCursor,
    toggleEditMode,
    createClickHandler,
    createAutoDetectionHandler,
    canUndo: undoStack.length > 0,
    canRedo: state.redoStack.length > 0,
    undo: actions.undo,
    redo: actions.redo,
  };
} 