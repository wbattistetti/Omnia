import React, { ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

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
  return (
    <div className="mb-2">
      <div
        className="flex items-center justify-between cursor-pointer px-4 py-2 hover:bg-slate-700 transition-colors"
        onClick={onToggle}
        style={{ background: 'var(--sidebar-header)', color: 'var(--sidebar-header-text)', borderTopLeftRadius: 8, borderTopRightRadius: 8 }}
      >
        <div className="flex items-center gap-2">
          <div className="w-5 h-5" style={{ color: 'var(--sidebar-header-text)' }}>{icon}</div>
          <span className="font-semibold text-sm capitalize">{title}</span>
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