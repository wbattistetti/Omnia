import React from 'react';

interface SidebarEntityAccordionProps {
  title: string;
  icon: React.ReactNode;
  color: string;
  isOpen: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
  action?: React.ReactNode;
}

const SidebarEntityAccordion: React.FC<SidebarEntityAccordionProps> = ({
  title,
  icon,
  color,
  isOpen,
  onToggle,
  children,
  action
}) => (
  <div className="mb-4">
    <div
      className="flex items-center justify-between p-3 rounded-lg cursor-pointer"
      style={{ background: color, color: '#fff', borderRadius: 12, width: '100%' }}
      onClick={onToggle}
    >
      <div className="flex items-center">
        {icon && <span className="mr-3">{icon}</span>}
        <span className="font-semibold">{title}</span>
      </div>
      <div className="flex items-center">
        {action}
        <span className="ml-2">{isOpen ? '▼' : '▶'}</span>
      </div>
    </div>
    {isOpen && (
      <div className="mt-2 pl-2">
        {children}
      </div>
    )}
  </div>
);

export default SidebarEntityAccordion;