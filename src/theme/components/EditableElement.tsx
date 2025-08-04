import React, { ReactNode } from 'react';
import { useThemeEditor } from '../hooks/useThemeEditor';
import { ThemeElement } from '../types/theme';

// ============================================================================
// INTERFACE PROPS
// ============================================================================

interface EditableElementProps {
  element: ThemeElement;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  autoDetection?: boolean;
  dataThemePart?: 'background' | 'text' | 'border';
}

// ============================================================================
// EDITABLE ELEMENT COMPONENT
// ============================================================================

export function EditableElement({ 
  element, 
  children, 
  className = '', 
  style = {},
  autoDetection = false,
  dataThemePart
}: EditableElementProps) {
  const { isEditMode, createClickHandler, createAutoDetectionHandler } = useThemeEditor();

  // Determina la proprietà basata su dataThemePart
  const getProperty = (): keyof ThemeElement['properties'] => {
    if (dataThemePart) {
      const propertyMap = {
        background: 'background',
        text: 'color',
        border: 'borderColor'
      } as const;
      return propertyMap[dataThemePart];
    }
    return 'background'; // Default
  };

  const handleClick = autoDetection 
    ? createAutoDetectionHandler(element)
    : createClickHandler(element, getProperty());

  return (
    <div
      data-theme-element={element.id}
      data-theme-part={dataThemePart}
      onClick={isEditMode ? handleClick : undefined}
      className={`${className} ${isEditMode ? 'theme-editable' : ''}`}
      style={style}
      role={isEditMode ? 'button' : undefined}
      tabIndex={isEditMode ? 0 : undefined}
      aria-label={isEditMode ? `Modifica ${element.name}` : undefined}
    >
      {children}
    </div>
  );
} 