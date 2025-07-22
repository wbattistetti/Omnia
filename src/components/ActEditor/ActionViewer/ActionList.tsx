// Executive summary: Renders a responsive grid of available actions for drag & drop.
import React, { useState, useEffect, useRef } from 'react';
import ActionItem from './ActionItem';
import { MessageCircle, HelpCircle, Headphones, Shield, PhoneOff, Database, Mail, MessageSquare, FunctionSquare as Function, Music, Eraser, ArrowRight, Tag, Clock, ServerCog } from 'lucide-react';
import { useActionsCatalog } from '../../../context/ActionsCatalogContext';

const MIN_THUMBNAIL_WIDTH = 100;

// Mappa tra nome icona (stringa) e componente React
const iconMap: Record<string, React.ReactNode> = {
  MessageCircle: <MessageCircle size={24} />,  HelpCircle: <HelpCircle size={24} />,  Headphones: <Headphones size={24} />,  Shield: <Shield size={24} />,  PhoneOff: <PhoneOff size={24} />,  Database: <Database size={24} />,  Mail: <Mail size={24} />,  MessageSquare: <MessageSquare size={24} />,  Function: <Function size={24} />,  Music: <Music size={24} />,  Eraser: <Eraser size={24} />,  ArrowRight: <ArrowRight size={24} />,  Tag: <Tag size={24} />,  Clock: <Clock size={24} />,  ServerCog: <ServerCog size={24} />
};

const DEFAULT_LANG = 'it';

const ActionList: React.FC = () => {
  const { actionsCatalog } = useActionsCatalog();
  const [columns, setColumns] = useState(4);
  const containerRef = useRef<HTMLDivElement>(null);
  const [lang, setLang] = useState(DEFAULT_LANG);

  useEffect(() => {
    const updateColumns = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const possibleColumns = Math.floor(containerWidth / MIN_THUMBNAIL_WIDTH);
        const newColumns = Math.max(1, Math.min(possibleColumns, actionsCatalog.length));
        setColumns(newColumns);
      }
    };

    const resizeObserver = new ResizeObserver(updateColumns);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [actionsCatalog.length]);

  useEffect(() => {
    // fetch('/data/actionsCatalog.json') // This line is removed as per the new_code
    //   .then(res => res.json())
    //   .then(setActions);
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
        {actionsCatalog.map((action, index) => {
          if (!action) {
            return null;
          }
          // Estrai label, description, primaryValue, parameters come stringhe
          const label = typeof action.label === 'object' ? action.label[lang] || action.label.en || action.id : action.label;
          const description = typeof action.description === 'object' ? action.description[lang] || action.description.en || '' : action.description;
          // Esempio: primaryValue = action.text[lang] o action.text
          let primaryValue = '';
          if (action.text) {
            primaryValue = typeof action.text === 'object' ? action.text[lang] || action.text.en || '' : action.text;
          }
          // Parametri figli: estrai solo quelli che sono oggetti lingua o stringhe
          let parameters = [];
          if (action.parameters && Array.isArray(action.parameters)) {
            parameters = action.parameters.map((param: any) => ({
              key: param.key,
              value: typeof param.value === 'object' ? param.value[lang] || param.value.en || '' : param.value
            }));
          }
          const props = {
            action,
            icon: iconMap[action.icon] || <Tag size={24} />,
            iconName: action.icon,
            label,
            color: action.color,
            description,
            primaryValue,
            parameters
          };
          // Passa key direttamente, NON dentro props
          return <ActionItem key={action.id || index} {...props} />;
        })}
      </div>
    </div>
  );
};

export default ActionList; 