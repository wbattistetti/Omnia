import React, { useState, useEffect, useRef } from 'react';
import { Position } from '../types/theme';
import { useThemeContext } from '../context/ThemeContext';
import { HexColorPicker, HexColorInput } from 'react-colorful';

// ============================================================================
// INTERFACE PROPS
// ============================================================================

interface ColorPickerProps {
  isOpen: boolean;
  position: Position;
  elementId: string;
  property: string;
  initialColor: string;
}

// ============================================================================
// COLOR PICKER COMPONENT
// ============================================================================

export function ColorPicker({ 
  isOpen, 
  position, 
  elementId, 
  property, 
  initialColor 
}: ColorPickerProps) {
  const { state, actions } = useThemeContext();
  const [currentColor, setCurrentColor] = useState(initialColor);
  
  // Aggiorna il colore corrente quando cambia l'initialColor
  useEffect(() => {
    if (isOpen) {
      setCurrentColor(initialColor);
    }
  }, [isOpen, initialColor]);

  // Applica il colore in tempo reale all'elemento
  useEffect(() => {
    if (isOpen && elementId) {
      const element = document.querySelector(`[data-theme-element="${elementId}"]`);
      if (element) {
        (element as HTMLElement).style[property as any] = currentColor;
      }
    }
  }, [currentColor, isOpen, elementId, property]);
  
  // Se non è aperto, non renderizzare nulla
  if (!isOpen) {
    return null;
  }

  const handleClose = () => {
    try {
      // Ripristina il colore originale dal context
      const originalColor = state.originalColor;
      const element = document.querySelector(`[data-theme-element="${elementId}"]`);
      if (element) {
        (element as HTMLElement).style[property as any] = originalColor;
      }
      actions.closeColorPicker();
    } catch (error) {
      console.error('🎨 ColorPicker handleClose errore:', error);
    }
  };

  const handleApply = () => {
    try {
      actions.applyColorChange(elementId, property as any, currentColor);
      actions.closeColorPicker();
    } catch (error) {
      console.error('🎨 ColorPicker handleApply errore:', error);
    }
  };

  const handleColorChange = (newColor: string) => {
    setCurrentColor(newColor);
    actions.updateCurrentColor(newColor);
  };

  return (
    <div
      className="fixed z-50 bg-white border border-gray-300 rounded-lg shadow-lg p-4"
      style={{
        left: position.x,
        top: position.y,
        minWidth: '280px'
      }}
      data-theme-ignore="true"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-700">
            {elementId} - {property}
          </span>
        </div>
        <button
          onClick={handleClose}
          className="text-gray-400 hover:text-gray-600"
          data-theme-ignore="true"
          aria-label="Chiudi color picker"
        >
          ✕
        </button>
      </div>

      {/* React Colorful Picker */}
      <div className="mb-3" data-theme-ignore="true">
        <HexColorPicker
          color={currentColor}
          onChange={handleColorChange}
          style={{ width: '100%', height: '200px' }}
        />
      </div>

      {/* Color Input */}
      <div className="flex items-center space-x-3 mb-3" data-theme-ignore="true">
        <div
          className="w-12 h-12 border border-gray-300 rounded"
          style={{ backgroundColor: currentColor }}
        />
        <HexColorInput
          color={currentColor}
          onChange={handleColorChange}
          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="#000000"
          data-theme-ignore="true"
          aria-label="Colore esadecimale"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-2">
        <button
          onClick={handleApply}
          className="flex-1 px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 flex items-center justify-center"
          data-theme-ignore="true"
        >
          <span className="mr-1">✓</span>
          Conferma
        </button>
        <button
          onClick={handleClose}
          className="flex-1 px-3 py-2 text-sm bg-gray-300 text-gray-700 rounded hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
          data-theme-ignore="true"
        >
          Annulla
        </button>
      </div>
    </div>
  );
} 