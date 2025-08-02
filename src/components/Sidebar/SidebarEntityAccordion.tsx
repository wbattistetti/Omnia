import React, { ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useThemeEditor } from '../../theme/hooks/useThemeEditor';
import { useThemeElement } from '../../theme/utils/elementRegistry';

interface SidebarEntityAccordionProps {
  title: React.ReactNode;
  icon: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  action?: React.ReactNode;
  children: ReactNode;
}

const SidebarEntityAccordion: React.FC<SidebarEntityAccordionProps> = ({
  title,
  icon,
  isOpen,
  onToggle,
  action,
  children
}) => {
  const { isEditMode, createClickHandler } = useThemeEditor();

  // Auto-registrazione del componente
  useThemeElement(
    'accordion-header',
    'Accordion Header',
    ['background', 'color', 'borderColor'],
    {
      background: '#3b82f6',
      color: '#ffffff',
      borderColor: '#1e40af'
    }
  );

  const handleBackgroundClick = createClickHandler('accordion-header', 'background');
  const handleTextClick = createClickHandler('accordion-header', 'text');
  const handleBorderClick = createClickHandler('accordion-header', 'border');

  const handleHeaderClick = (e: React.MouseEvent) => {
    if (isEditMode) {
      return; // Non aprire l'accordion se siamo in modalità editing
    }
    onToggle();
  };

  const handleChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Previene la propagazione al header
    onToggle(); // Sempre apri/chiudi l'accordion
  };

  return (
    <div className="mb-2">
      <div
        className="flex items-center justify-between cursor-pointer px-4 py-2 hover:bg-slate-700 transition-colors"
        onClick={handleHeaderClick}
        data-theme-element="accordion-header"
        style={{ 
          background: '#3b82f6', 
          color: '#ffffff', 
          borderTopLeftRadius: 8, 
          borderTopRightRadius: 8,
          cursor: isEditMode ? 'default' : 'pointer'
        }}
      >
        <div className="flex items-center gap-2">
          <div 
            className="w-5 h-5" 
            style={{ color: '#ffffff' }}
            onClick={handleTextClick}
            data-theme-part="text"
          >
            {icon}
          </div>
          <span 
            className="font-semibold text-sm capitalize"
            onClick={handleTextClick}
            style={{ cursor: isEditMode ? 'pointer' : 'default' }}
            data-theme-part="text"
          >
            {title}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div 
            className="w-4 h-4 rounded border border-white/20"
            onClick={handleBorderClick}
            style={{ cursor: isEditMode ? 'pointer' : 'default' }}
            data-theme-part="border"
          />
          {action}
          {isOpen ? (
            <ChevronDown 
              className="w-4 h-4" 
              style={{ color: '#ffffff' }} 
              onClick={handleChevronClick}
            />
          ) : (
            <ChevronRight 
              className="w-4 h-4" 
              style={{ color: '#ffffff' }} 
              onClick={handleChevronClick}
            />
          )}
        </div>
      </div>
      {isOpen && (
        <div
          className="px-4 py-2 rounded-b-md"
          style={{ background: 'var(--sidebar-content-bg)', color: 'var(--sidebar-content-text)', outline: 'none', boxShadow: 'none' }}
          tabIndex={-1}
        >
          {children}
        </div>
      )}
    </div>
  );
};

export default SidebarEntityAccordion;