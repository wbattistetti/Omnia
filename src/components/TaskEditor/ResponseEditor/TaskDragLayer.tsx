import React from 'react';
import { useDragLayer } from 'react-dnd';
import { DND_TYPE_VIEWER, DND_TYPE } from './TaskRowDnDWrapper';
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
 * CustomDragLayer for Tasks being dragged
 * Shows a visual preview of the task being dragged with the correct icon
 */
const TaskDragLayer: React.FC = () => {
  // Disabled - no custom drag preview shown
  // Only the thin blue preview line in TaskRowDnDWrapper will be visible
  return null;
};

export default TaskDragLayer;

