import React, { useState, useRef, useEffect } from 'react';
import { HexColorPicker } from 'react-colorful';
import { X, Check } from 'lucide-react';

interface ColorPickerProps {
  isOpen: boolean;
  currentColor: string;
  onApply: (color: string) => void;
  onCancel: () => void;
  onPreview?: (color: string) => void; // Callback per preview in tempo reale
  title: string;
  targetElement?: HTMLElement | null; // Elemento cliccato per il posizionamento
}

const ColorPicker: React.FC<ColorPickerProps> = ({
  isOpen,
  currentColor,
  onApply,
  onCancel,
  onPreview,
  title,
  targetElement
}) => {
  const [color, setColor] = useState(currentColor);
  const pickerRef = useRef<HTMLDivElement>(null);
  const isInitialized = useRef(false);

  // Inizializza il colore SOLO quando si apre il picker per la prima volta
  useEffect(() => {
    if (isOpen && !isInitialized.current) {
      setColor(currentColor);
      isInitialized.current = true;
    } else if (!isOpen) {
      isInitialized.current = false;
    }
  }, [isOpen, currentColor]);

  // Gestisce il click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        onCancel();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onCancel]);

  // Gestisce ESC per chiudere
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onCancel]);

  // Gestisce il cambio colore in tempo reale
  const handleColorChange = (newColor: string) => {
    setColor(newColor);
    // Chiama la callback di preview se disponibile
    if (onPreview) {
      onPreview(newColor);
    }
  };

  if (!isOpen) return null;

  // Calcola la posizione basata sull'elemento target
  const getPosition = () => {
    if (!targetElement) {
      // Fallback al centro se non c'è target
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)'
      };
    }

    const rect = targetElement.getBoundingClientRect();
    const pickerWidth = 320; // Larghezza approssimativa del picker
    const pickerHeight = 400; // Altezza approssimativa del picker
    
    // Posizione a destra dell'elemento
    let left = rect.right + 10;
    let top = rect.top;
    
    // Se il picker va fuori schermo a destra, posizionalo a sinistra
    if (left + pickerWidth > window.innerWidth) {
      left = rect.left - pickerWidth - 10;
    }
    
    // Se il picker va fuori schermo in basso, spostalo su
    if (top + pickerHeight > window.innerHeight) {
      top = window.innerHeight - pickerHeight - 10;
    }
    
    // Se il picker va fuori schermo in alto, spostalo giù
    if (top < 10) {
      top = 10;
    }

    return {
      position: 'fixed' as const,
      top: `${top}px`,
      left: `${left}px`,
      zIndex: 1000
    };
  };

  return (
    <div 
      ref={pickerRef}
      className="bg-white rounded-lg shadow-xl p-4 border border-gray-200"
      style={getPosition()}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Color Picker */}
      <div className="mb-4">
        <HexColorPicker
          color={color}
          onChange={handleColorChange}
          style={{ width: '280px', height: '200px' }}
        />
      </div>

      {/* Color Preview */}
      <div className="flex items-center gap-3 mb-4">
        <div 
          className="w-6 h-6 rounded border border-gray-300"
          style={{ backgroundColor: color }}
        />
        <span className="text-xs font-mono text-gray-600">{color}</span>
      </div>

      {/* Buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => onApply(color)}
          className="flex-1 bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-1"
        >
          <Check size={14} />
          Applica
        </button>
        <button
          onClick={onCancel}
          className="flex-1 bg-gray-200 text-gray-800 px-3 py-2 rounded text-sm hover:bg-gray-300 transition-colors"
        >
          Annulla
        </button>
      </div>
    </div>
  );
};

export default ColorPicker; 