import React from 'react';
import { useThemeEditor } from '../../theme/hooks/useThemeEditor';
import { useThemeElement } from '../../theme/utils/elementRegistry';
import { ThemeToggle } from '../../theme/components/ThemeToggle';

export default function SidebarHeader() {
  const { isEditMode, createClickHandler } = useThemeEditor();

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

  const handleBackgroundClick = createClickHandler('sidebar-header', 'background');
  const handleTextClick = createClickHandler('sidebar-header', 'text');

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
              data-theme-part="text"
            >
              Omnia
            </h1>
            <p 
              className="text-sm text-gray-400"
              onClick={handleTextClick}
              style={{ cursor: isEditMode ? 'pointer' : 'default' }}
              data-theme-part="text"
            >
              Data Dialogue Templates
            </p>
          </div>
        </div>
        <ThemeToggle />
      </div>
    </div>
  );
}