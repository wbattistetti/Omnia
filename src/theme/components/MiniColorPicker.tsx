import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useThemeState } from '../hooks/useThemeState';
import { useThemeActions } from '../hooks/useThemeActions';
import { X, Check, Palette } from 'lucide-react';
import { ThemeProperties } from '../types';

interface MiniColorPickerProps {
  isOpen: boolean;
  position: { x: number; y: number };
  elementId: string;
  property: string;
  initialValue: string;
}

export function MiniColorPicker({ 
  isOpen, 
  position, 
  elementId, 
  property, 
  initialValue 
}: MiniColorPickerProps) {
  const { state } = useThemeState();
  const { applyPropertyChange, closeMiniPicker } = useThemeActions();
  const [colorValue, setColorValue] = useState(initialValue);
  const [previewValue, setPreviewValue] = useState(initialValue);
  const [hue, setHue] = useState(0);
  const [saturation, setSaturation] = useState(50);
  const [lightness, setLightness] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [dragType, setDragType] = useState<'hue' | 'saturation' | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const colorAreaRef = useRef<HTMLDivElement>(null);
  const hueSliderRef = useRef<HTMLDivElement>(null);

  // Convert hex to HSL
  const hexToHSL = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }

    return { h: h * 360, s: s * 100, l: l * 100 };
  };

  // Convert HSL to hex
  const hslToHex = (h: number, s: number, l: number) => {
    h /= 360;
    s /= 100;
    l /= 100;

    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h * 6) % 2 - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;

    if (0 <= h && h < 1/6) {
      r = c; g = x; b = 0;
    } else if (1/6 <= h && h < 2/6) {
      r = x; g = c; b = 0;
    } else if (2/6 <= h && h < 3/6) {
      r = 0; g = c; b = x;
    } else if (3/6 <= h && h < 4/6) {
      r = 0; g = x; b = c;
    } else if (4/6 <= h && h < 5/6) {
      r = x; g = 0; b = c;
    } else if (5/6 <= h && h <= 1) {
      r = c; g = 0; b = x;
    }

    const rHex = Math.round((r + m) * 255).toString(16).padStart(2, '0');
    const gHex = Math.round((g + m) * 255).toString(16).padStart(2, '0');
    const bHex = Math.round((b + m) * 255).toString(16).padStart(2, '0');

    return `#${rHex}${gHex}${bHex}`;
  };

  useEffect(() => {
    if (initialValue && initialValue.startsWith('#')) {
      const hsl = hexToHSL(initialValue);
      setHue(hsl.h);
      setSaturation(hsl.s);
      setLightness(hsl.l);
      setColorValue(initialValue);
      setPreviewValue(initialValue);
    }
  }, [initialValue]);

  useEffect(() => {
    const newHex = hslToHex(hue, saturation, lightness);
    setColorValue(newHex);
    setPreviewValue(newHex);
    // Non chiamiamo applyPropertyChange qui per evitare loop infiniti
    // Verrà chiamato solo quando l'utente conferma
  }, [hue, saturation, lightness]);

  const handleMouseDown = useCallback((e: React.MouseEvent, type: 'hue' | 'saturation') => {
    e.preventDefault();
    e.stopPropagation();
    console.log('🎨 Mouse down on color picker:', type);
    setIsDragging(true);
    setDragType(type);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !dragType) return;

    e.preventDefault();
    e.stopPropagation();

    if (dragType === 'hue' && hueSliderRef.current) {
      const rect = hueSliderRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      setHue(x * 360);
    } else if (dragType === 'saturation' && colorAreaRef.current) {
      const rect = colorAreaRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      setSaturation(x * 100);
      setLightness((1 - y) * 100);
    }
  }, [isDragging, dragType]);

  const handleMouseUp = useCallback(() => {
    console.log('🎨 Mouse up on color picker');
    setIsDragging(false);
    setDragType(null);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleConfirm = () => {
    console.log('🎨 Confermando colore:', colorValue);
    applyPropertyChange(elementId, property as keyof ThemeProperties, colorValue);
    closeMiniPicker();
  };

  const handleCancel = () => {
    applyPropertyChange(elementId, property as keyof ThemeProperties, initialValue);
    closeMiniPicker();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirm();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (!isOpen) return null;

  console.log('🎨 Rendering MiniColorPicker:', { isOpen, position, elementId, property });

  const hueColor = `hsl(${hue}, 100%, 50%)`;
  const currentColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;

  return (
    <div
      className="fixed z-50 bg-white border border-gray-300 rounded-lg shadow-lg p-4"
      style={{
        left: position.x,
        top: position.y,
        minWidth: '280px'
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <Palette size={16} className="text-gray-600" />
          <span className="text-sm font-medium text-gray-700">
            {elementId} - {property}
          </span>
        </div>
        <button
          onClick={handleCancel}
          className="text-gray-400 hover:text-gray-600"
          data-theme-ignore="true"
        >
          <X size={16} />
        </button>
      </div>

      {/* Color Selection Area */}
      <div className="mb-3">
        <div
          ref={colorAreaRef}
          className="relative w-full h-32 rounded border border-gray-300 cursor-crosshair"
          style={{
            background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueColor})`
          }}
          onMouseDown={(e) => handleMouseDown(e, 'saturation')}
        >
          <div
            className="absolute w-3 h-3 border-2 border-white rounded-full shadow-lg"
            style={{
              left: `${saturation}%`,
              top: `${100 - lightness}%`,
              transform: 'translate(-50%, -50%)'
            }}
          />
        </div>
      </div>

      {/* Hue Slider */}
      <div className="mb-3">
        <div
          ref={hueSliderRef}
          className="relative w-full h-6 rounded border border-gray-300 cursor-pointer"
          style={{
            background: 'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)'
          }}
          onMouseDown={(e) => handleMouseDown(e, 'hue')}
        >
          <div
            className="absolute w-3 h-6 border-2 border-white rounded shadow-lg"
            style={{
              left: `${(hue / 360) * 100}%`,
              transform: 'translateX(-50%)'
            }}
          />
        </div>
      </div>

      {/* Color Preview and Hex Input */}
      <div className="flex items-center space-x-3 mb-3">
        <div
          className="w-12 h-12 border border-gray-300 rounded"
          style={{ backgroundColor: currentColor }}
        />
        <input
          ref={inputRef}
          type="text"
          value={colorValue}
          onChange={(e) => {
            const newColor = e.target.value;
            setColorValue(newColor);
            setPreviewValue(newColor);
            if (newColor.startsWith('#')) {
              const hsl = hexToHSL(newColor);
              setHue(hsl.h);
              setSaturation(hsl.s);
              setLightness(hsl.l);
            }
          }}
          onKeyDown={handleKeyDown}
          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="#000000"
          data-theme-ignore="true"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-2">
        <button
          onClick={handleConfirm}
          className="flex-1 px-3 py-2 text-sm bg-green-500 text-white rounded hover:bg-green-600 flex items-center justify-center space-x-1"
          data-theme-ignore="true"
        >
          <Check size={14} />
          <span>Conferma</span>
        </button>
        <button
          onClick={handleCancel}
          className="flex-1 px-3 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
          data-theme-ignore="true"
        >
          Annulla
        </button>
      </div>
    </div>
  );
} 