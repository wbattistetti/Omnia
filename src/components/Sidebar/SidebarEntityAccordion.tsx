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
  const handleHeaderClick = () => {
    onToggle();
  };

  return (
    <div className="mb-2">
      <div
        className="flex items-center justify-between cursor-pointer px-4 py-2 hover:bg-slate-700 transition-colors"
        onClick={handleHeaderClick}
        style={{
          background: '#3b82f6',
          color: '#ffffff',
          borderTopLeftRadius: 8,
          borderTopRightRadius: 8
        }}
      >
        <div className="flex items-center gap-2">
          <div className="w-5 h-5" style={{ color: '#ffffff' }}>
            {icon}
          </div>
          <span className="font-semibold capitalize">
            {title}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded border border-white/20" />
          {action}
          {isOpen ? (
            <ChevronDown className="w-4 h-4" style={{ color: '#ffffff' }} />
          ) : (
            <ChevronRight className="w-4 h-4" style={{ color: '#ffffff' }} />
          )}
        </div>
      </div>
      {isOpen && (
        <div className="bg-slate-800 border-l-2 border-blue-500">
          {children}
        </div>
      )}
    </div>
  );
};

export default SidebarEntityAccordion;