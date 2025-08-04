import React from 'react';
import { useThemeManager } from '../ThemeManager';

// ============================================================================
// PULSANTE TOGGLE TEMA - ENTERPRISE GRADE
// ============================================================================

export function ThemeToggle() {
  const { isEditMode, toggleEditMode } = useThemeManager();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleEditMode();
  };

  return (
    <button
      onClick={handleClick}
      className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
        isEditMode
          ? 'bg-green-600 hover:bg-green-700 text-white'
          : 'bg-slate-600 hover:bg-slate-700 text-white'
      }`}
      data-theme-ignore="true"
      title={isEditMode ? 'Disattiva editing tema' : 'Attiva editing tema'}
      aria-label={isEditMode ? 'Disattiva editing tema' : 'Attiva editing tema'}
    >
      {isEditMode ? 'Tema ATTIVO' : 'Tema DISATTIVO'}
    </button>
  );
} 