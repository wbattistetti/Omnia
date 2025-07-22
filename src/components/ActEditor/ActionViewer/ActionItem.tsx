// Executive summary: Represents a single draggable action item with icon and label.
import React from 'react';
import styles from './ActionItem.module.css';
import { useDrag } from 'react-dnd';

const MIN_THUMBNAIL_WIDTH = 100;

// Mappa da nome icona a SVG stringa (solo le icone usate)
const iconSVGMap: Record<string, string> = {
  MessageCircle: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-message-circle"><path d="M21 15a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h1l3 3 3-3h7z"/></svg>`,
  HelpCircle: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-help-circle"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 1 1 5.83 1c0 2-3 3-3 3"/><line x1="12" x2="12" y1="17" y2="17"/></svg>`,
  Headphones: `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' class='lucide lucide-headphones'><path d='M3 18v-2a9 9 0 0 1 18 0v2'/><rect width='4' height='6' x='19' y='16' rx='2'/><rect width='4' height='6' x='1' y='16' rx='2'/></svg>`,
  Shield: `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' class='lucide lucide-shield'><path d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'/></svg>`,
  PhoneOff: `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' class='lucide lucide-phone-off'><path d='M10.5 13.5a9.9 9.9 0 0 0 4 4l2-2a2 2 0 0 1 2.1-.4 12.1 12.1 0 0 0 3.9.7 2 2 0 0 1 2 2v3.6a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 3.6 7.7 2 2 0 0 1 5.6 5.6h3.6a2 2 0 0 1 2 2c0 1.3.2 2.6.7 3.9a2 2 0 0 1-.4 2.1l-2 2'/><line x1='22' x2='2' y1='2' y2='22'/></svg>`,
  Database: `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' class='lucide lucide-database'><ellipse cx='12' cy='5' rx='9' ry='3'/><path d='M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5'/><path d='M3 12c0 1.7 4 3 9 3s9-1.3 9-3'/></svg>`,
  Mail: `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' class='lucide lucide-mail'><rect width='20' height='16' x='2' y='4' rx='2'/><path d='m22 6-8 7-8-7'/></svg>`,
  MessageSquare: `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' class='lucide lucide-message-square'><path d='M21 15a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h1l3 3 3-3h7z'/></svg>`,
  Function: `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' class='lucide lucide-function-square'><rect width='20' height='20' x='2' y='2' rx='5'/><path d='M9.5 15.5 11 9l2 6 1.5-6'/></svg>`,
  Music: `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' class='lucide lucide-music'><path d='M9 18V5l12-2v13'/><circle cx='6' cy='18' r='3'/><circle cx='18' cy='16' r='3'/></svg>`,
  Eraser: `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' class='lucide lucide-eraser'><path d='M7 21h14'/><path d='M17 3a2.8 2.8 0 0 1 4 4L7 21a2.8 2.8 0 0 1-4-4L17 3z'/></svg>`,
  ArrowRight: `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' class='lucide lucide-arrow-right'><line x1='5' x2='19' y1='12' y2='12'/><polyline points='12 5 19 12 12 19'/></svg>`,
  Tag: `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' class='lucide lucide-tag'><path d='M2 12V2h10l10 10-10 10L2 12z'/><circle cx='7' cy='7' r='2'/></svg>`,
  Clock: `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' class='lucide lucide-clock'><circle cx='12' cy='12' r='10'/><polyline points='12 6 12 12 16 14'/></svg>`,
  ServerCog: `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' class='lucide lucide-server-cog'><rect width='20' height='8' x='2' y='2' rx='2'/><rect width='20' height='8' x='2' y='14' rx='2'/><path d='M6 6h.01M6 18h.01M12 18a2 2 0 1 0 4 0 2 2 0 0 0-4 0zm8 2v2m0 4v2m2-4h-4'/></svg>`,
};

interface ActionItemProps {
  action: any; // Assuming action is an object with id, iconName, label, color, description, primaryValue, parameters
  icon: React.ReactNode;
  iconName: string;
  label: string;
  color: string;
  description?: string;
  primaryValue?: string;
  parameters?: { key: string; value: string }[];
}

const ActionItem: React.FC<ActionItemProps> = ({ action, icon, iconName, label, color, description, primaryValue, parameters }) => {
  const [{ isDragging }, dragRef] = useDrag({
    type: 'ACTION',
    item: {
      action,
      label,
      icon: iconName,
      color,
      primaryValue,
      parameters
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  return (
    <div
      ref={dragRef}
      style={{
        opacity: isDragging ? 0.5 : 1,
        cursor: 'grab',
        border: isDragging ? '2px solid #2563eb' : undefined,
        background: isDragging ? '#e0e7ff' : undefined,
        padding: 8,
        borderRadius: 6,
        marginBottom: 4
      }}
    >
      <div className={`${color} ${styles.icon}`}>
        {icon}
      </div>
      <span className={styles.label}>{label}</span>
    </div>
  );
};

export default ActionItem; 