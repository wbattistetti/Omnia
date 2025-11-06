import React from 'react';
import { Wrench, X } from 'lucide-react';
import { useThemeManager } from '../../theme/ThemeManager';
import { useThemeElement } from '../../theme/utils/elementRegistry';

// ============================================================================
// SIDEBAR HEADER - ENTERPRISE GRADE
// ============================================================================

interface SidebarHeaderProps {
  onClose?: () => void;
}

export default function SidebarHeader({ onClose }: SidebarHeaderProps) {
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
            <span className="text-white font-bold">O</span>
          </div>
          <div>
            <h1
              className="font-semibold text-white"
              onClick={handleTextClick}
              style={{ cursor: isEditMode ? 'pointer' : 'default' }}
              data-theme-part="color"
            >
              Omnia
            </h1>
            <p
              className="text-gray-400"
              onClick={handleTextClick}
              style={{ cursor: isEditMode ? 'pointer' : 'default' }}
              data-theme-part="color"
            >
              Data Dialogue Templates
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            title="Backend Builder"
            onClick={() => {
              try {
                document.dispatchEvent(new CustomEvent('backendBuilder:open'));
              } catch {}
            }}
            className="p-2 text-gray-300 hover:text-white transition-colors"
          >
            <Wrench className="w-5 h-5" />
          </button>
          {onClose && (
            <button
              title="Chiudi Library"
              onClick={onClose}
              className="p-2 text-gray-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
              aria-label="Chiudi Library"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}