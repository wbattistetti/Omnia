import React, { ReactNode, useCallback } from 'react';
import { ChevronDown, ChevronRight, Paintbrush } from 'lucide-react';
import { useThemeManager } from '../../theme/ThemeManager';

interface SidebarEntityAccordionProps {
  title: React.ReactNode;
  icon: React.ReactNode;
  color: string;
  lightColor: string;
  isOpen: boolean;
  onToggle: () => void;
  action?: React.ReactNode;
  children: ReactNode;
  entityType: keyof ReturnType<typeof useThemeManager>['colors'];
}

const SidebarEntityAccordion: React.FC<SidebarEntityAccordionProps> = ({
  title,
  icon,
  color,
  lightColor,
  isOpen,
  onToggle,
  action,
  children,
  entityType
}) => {
  const { isEditMode, openEditor } = useThemeManager();

  const handleHeaderClick = useCallback((e: React.MouseEvent) => {
    if (isEditMode) {
      e.stopPropagation();
      openEditor(entityType, e.currentTarget as HTMLElement);
    } else {
      onToggle();
    }
  }, [isEditMode, entityType, openEditor, onToggle]);

  return (
    <div className="mb-2" style={{ position: 'relative' }}>
      <div
        className="flex items-center justify-between cursor-pointer px-4 py-2 hover:bg-slate-700 transition-colors"
        onClick={handleHeaderClick}
        style={{ 
          background: color, 
          borderTopLeftRadius: 8, 
          borderTopRightRadius: 8,
          cursor: isEditMode ? 'pointer' : 'default'
        }}
      >
        <div className="flex items-center gap-2">
          <div className="w-5 h-5" style={{ color: '#fff' }}>{icon}</div>
          <span className="text-white font-semibold text-sm capitalize">{title}</span>
          {isEditMode && (
            <Paintbrush size={14} className="text-white opacity-70" />
          )}
        </div>
        <div className="flex items-center gap-2">
          {action}
          {isOpen ? (
            <ChevronDown className="w-4 h-4 text-gray-200" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-200" />
          )}
        </div>
      </div>
      {isOpen && (
        <div
          className="px-4 py-2 rounded-b-md"
          style={{ background: lightColor, outline: 'none', boxShadow: 'none' }}
          tabIndex={-1}
        >
          {children}
        </div>
      )}
    </div>
  );
};

export default SidebarEntityAccordion;