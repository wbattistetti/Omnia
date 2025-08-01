import React, { ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface SidebarEntityAccordionProps {
  title: React.ReactNode;
  icon: React.ReactNode;
  color: string;
  lightColor: string;
  isOpen: boolean;
  onToggle: () => void;
  action?: React.ReactNode;
  children: ReactNode;
}

const SidebarEntityAccordion: React.FC<SidebarEntityAccordionProps> = ({
  title,
  icon,
  color,
  lightColor,
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
        style={{ background: color, borderTopLeftRadius: 8, borderTopRightRadius: 8 }}
      >
        <div className="flex items-center gap-2">
          <div className="w-5 h-5" style={{ color: '#fff' }}>{icon}</div>
          <span className="text-white font-semibold text-sm capitalize">{title}</span>
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