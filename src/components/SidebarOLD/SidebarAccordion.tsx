import React from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * SidebarAccordion: header con icona, titolo, chevron, +, gestione apertura.
 * TODO: animare apertura/chiusura, focus, aria-label.
 */
const SidebarAccordion: React.FC<{
  title: string;
  icon: React.ReactNode;
  color: string;
  isOpen: boolean;
  onToggle: () => void;
  action?: React.ReactNode;
  children?: React.ReactNode;
}> = ({ title, icon, color, isOpen, onToggle, action, children }) => {
  return (
    <div style={{ marginBottom: 12, background: isOpen ? '#f3e8ff' : '#fff', borderRadius: 8, boxShadow: isOpen ? '0 2px 8px #e9d5ff55' : 'none' }}>
      <div
        style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', cursor: 'pointer', userSelect: 'none' }}
        onClick={onToggle}
        tabIndex={0}
        aria-expanded={isOpen}
      >
        <span style={{ marginRight: 12 }}>{icon}</span>
        <span style={{ fontWeight: 700, color, flex: 1 }}>{title}</span>
        <span style={{ transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          <ChevronDown className="w-5 h-5 text-gray-400" />
        </span>
        {action && <span style={{ marginLeft: 8 }}>{action}</span>}
      </div>
      {isOpen && <div style={{ padding: '8px 0 0 0' }}>{children}</div>}
    </div>
  );
};

export default SidebarAccordion;