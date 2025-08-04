import React from 'react';
import { useThemeManager } from '../../theme/ThemeManager';
import { useThemeElement } from '../../theme/utils/elementRegistry';

// ============================================================================
// SIDEBAR HEADER - ENTERPRISE GRADE
// ============================================================================

export default function SidebarHeader() {
  const { isEditMode, createClickHandler } = useThemeManager();

  // Auto-registrazione del componente
  useThemeElement(
    'sidebar-header',
    'Sidebar Header',
    ['background', 'color', 'borderColor'],
    {
      background: '#1e293b',
      color: '#ffffff',
      borderColor: '#475569'
    }
  );

  // Utilizza il nuovo ThemeManager per creare i click handler
  const handleBackgroundClick = createClickHandler('sidebar-header', 'background');
  const handleTextClick = createClickHandler('sidebar-header', 'color');

  return (
    <div 
      className="p-4 border-b border-slate-700 bg-slate-800"
      data-theme-element="sidebar-header"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div 
            className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center"
            onClick={handleBackgroundClick}
            style={{ cursor: isEditMode ? 'pointer' : 'default' }}
            data-theme-part="background"
          >
            <span className="text-white font-bold text-sm">O</span>
          </div>
          <div>
            <h1 
              className="text-lg font-semibold text-white"
              onClick={handleTextClick}
              style={{ cursor: isEditMode ? 'pointer' : 'default' }}
              data-theme-part="color"
            >
              Omnia
            </h1>
            <p 
              className="text-sm text-gray-400"
              onClick={handleTextClick}
              style={{ cursor: isEditMode ? 'pointer' : 'default' }}
              data-theme-part="color"
            >
              Data Dialogue Templates
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}