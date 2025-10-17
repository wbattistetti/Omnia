import React from 'react';
import { useDragLayer } from 'react-dnd';
import { DND_TYPE_VIEWER, DND_TYPE } from './ActionRowDnDWrapper';
import { 
  MessageCircle, HelpCircle, Headphones, Shield, PhoneOff, 
  Database, Mail, MessageSquare, FunctionSquare as Function, 
  Music, Eraser, ArrowRight, Tag, Clock, ServerCog 
} from 'lucide-react';

// Mappa tra nome icona (stringa) e componente React
const iconMap: Record<string, React.ReactNode> = {
  MessageCircle: <MessageCircle size={20} />,
  HelpCircle: <HelpCircle size={20} />,
  Headphones: <Headphones size={20} />,
  Shield: <Shield size={20} />,
  PhoneOff: <PhoneOff size={20} />,
  Database: <Database size={20} />,
  Mail: <Mail size={20} />,
  MessageSquare: <MessageSquare size={20} />,
  Function: <Function size={20} />,
  Music: <Music size={20} />,
  Eraser: <Eraser size={20} />,
  ArrowRight: <ArrowRight size={20} />,
  Tag: <Tag size={20} />,
  Clock: <Clock size={20} />,
  ServerCog: <ServerCog size={20} />
};

/**
 * CustomDragLayer for Actions being dragged
 * Shows a visual preview of the action being dragged with the correct icon
 */
const ActionDragLayer: React.FC = () => {
  const { isDragging, item, currentOffset, itemType } = useDragLayer((monitor) => ({
    isDragging: monitor.isDragging(),
    item: monitor.getItem(),
    currentOffset: monitor.getClientOffset(),
    itemType: monitor.getItemType(),
  }));

  if (!isDragging) return null;
  if (!item) return null;
  if (!currentOffset) return null;

  // Show for both viewer actions and internal reordering
  if (itemType !== DND_TYPE_VIEWER && itemType !== DND_TYPE) return null;

  const label = item.label || item.action?.label || 'Action';
  const iconName = item.icon || item.action?.icon || 'Tag';
  const color = item.color || item.action?.color || 'blue';
  
  // Converti iconName in componente React
  const IconComponent = iconMap[iconName] || <Tag size={20} />;

  // Mappa colori CSS class names -> colori HEX esatti
  const colorMap: Record<string, string> = {
    'orange': '#f97316',
    'green': '#10b981',
    'blue': '#3b82f6',
    'red': '#ef4444',
    'cyan': '#06b6d4',
    'purple': '#a855f7',
    'yellow': '#eab308',
    'gray': '#6b7280'
  };
  
  const iconColor = colorMap[color] || '#3b82f6';
  const borderColor = colorMap[color] || '#3b82f6';
  
  return (
    <div style={{
      position: 'fixed',
      pointerEvents: 'none',
      left: 0,
      top: 0,
      width: '100%',
      height: '100%',
      zIndex: 10000
    }}>
      <div style={{
        position: 'absolute',
        left: currentOffset.x,
        top: currentOffset.y,
        transform: 'translate(10px, -50%)',
        background: '#1e293b',
        border: `1px solid ${iconColor}`,
        borderRadius: 8,
        boxShadow: `0 6px 20px ${iconColor}40`,
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        minWidth: 160,
        whiteSpace: 'nowrap',
        fontWeight: 500,
        fontSize: 14,
        color: '#ffffff',
        opacity: 0.95
      }}>
        <div 
          className={color}
          style={{
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 6,
            flexShrink: 0
          }}>
          {IconComponent}
        </div>
        <span style={{ whiteSpace: 'nowrap' }}>{label}</span>
      </div>
    </div>
  );
};

export default ActionDragLayer;

