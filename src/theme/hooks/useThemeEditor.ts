import { useCallback } from 'react';
import { useThemeState } from './useThemeState';
import { useThemeActions } from './useThemeActions';

export function useThemeEditor() {
  const { state } = useThemeState();
  const { openEditorAt } = useThemeActions();
  const { isEditMode } = state;

  const createClickHandler = useCallback((
    elementName: string,
    part: 'background' | 'text' | 'border' = 'background'
  ) => {
    return (e: React.MouseEvent) => {
      if (!isEditMode) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const coordinates = {
        x: rect.left + rect.width / 2,
        y: rect.bottom + 10,
      };

      console.log('🎨 Componente cliccato:', { elementName, part, coordinates });

      openEditorAt(elementName, part, coordinates);
    };
  }, [isEditMode, openEditorAt]);

  return {
    isEditMode,
    createClickHandler,
  };
} 