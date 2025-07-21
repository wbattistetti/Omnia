// Executive summary: Renders a responsive grid of available actions for drag & drop.
import React, { useState, useEffect, useRef } from 'react';
import ActionItem from './ActionItem';
import { MessageCircle, HelpCircle, Headphones, Shield, PhoneOff, Database, Mail, MessageSquare, FunctionSquare as Function, Music, Eraser, ArrowRight, Tag, Clock, ServerCog } from 'lucide-react';

const MIN_THUMBNAIL_WIDTH = 100;

// Mappa tra nome icona (stringa) e componente React
const iconMap: Record<string, React.ReactNode> = {
  MessageCircle: <MessageCircle size={24} />,  HelpCircle: <HelpCircle size={24} />,  Headphones: <Headphones size={24} />,  Shield: <Shield size={24} />,  PhoneOff: <PhoneOff size={24} />,  Database: <Database size={24} />,  Mail: <Mail size={24} />,  MessageSquare: <MessageSquare size={24} />,  Function: <Function size={24} />,  Music: <Music size={24} />,  Eraser: <Eraser size={24} />,  ArrowRight: <ArrowRight size={24} />,  Tag: <Tag size={24} />,  Clock: <Clock size={24} />,  ServerCog: <ServerCog size={24} />
};

const DEFAULT_LANG = 'it';

const ActionList: React.FC = () => {
  const [columns, setColumns] = useState(4);
  const containerRef = useRef<HTMLDivElement>(null);
  const [actions, setActions] = useState<any[]>([]);
  const [lang, setLang] = useState(DEFAULT_LANG);

  useEffect(() => {
    const updateColumns = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const possibleColumns = Math.floor(containerWidth / MIN_THUMBNAIL_WIDTH);
        const newColumns = Math.max(1, Math.min(possibleColumns, actions.length));
        setColumns(newColumns);
      }
    };

    const resizeObserver = new ResizeObserver(updateColumns);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [actions.length]);

  useEffect(() => {
    fetch('/data/actionsCatalog.json')
      .then(res => res.json())
      .then(setActions);
  }, []);

  return (
    <div>
      {/* Se vuoi permettere la selezione lingua, aggiungi qui un select */}
      {/* <select value={lang} onChange={e => setLang(e.target.value)}>
        <option value="it">Italiano</option>
        <option value="en">English</option>
        <option value="pt">Português</option>
      </select> */}
      <div
        ref={containerRef}
        className="grid auto-rows-min gap-1 overflow-y-auto overflow-x-hidden h-full w-full p-2"
        style={{
          gridTemplateColumns: `repeat(${columns}, minmax(${MIN_THUMBNAIL_WIDTH}px, 1fr))`,
        }}
      >
        {actions.map((action, index) => (
          <ActionItem
            key={action.id || index}
            icon={iconMap[action.icon] || <Tag size={24} />}
            label={action.label?.[lang] || action.label?.en || action.id}
            color={action.color}
            description={action.description?.[lang] || action.description?.en || ''}
          />
        ))}
      </div>
    </div>
  );
};

export default ActionList; 