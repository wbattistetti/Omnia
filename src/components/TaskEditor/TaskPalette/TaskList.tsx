// Executive summary: Renders a responsive grid of available tasks for drag & drop.
import React, { useState, useEffect, useRef, useMemo } from 'react';
import TaskItem from './TaskItem';
import { MessageCircle, HelpCircle, Headphones, Shield, PhoneOff, Database, Mail, MessageSquare, FunctionSquare as Function, Music, Eraser, ArrowRight, Tag, Clock, ServerCog } from 'lucide-react';
import { useFontContext } from '../../../context/FontContext';
import { TaskContext, EscalationStepType } from '../../../types/taskContext';
import { filterTasksByContext } from '../../../utils/taskContextHelpers';

const MIN_THUMBNAIL_WIDTH = 100;

// Mappa tra nome icona (stringa) e componente React
const iconMap: Record<string, React.ReactNode> = {
  MessageCircle: <MessageCircle size={24} />,  HelpCircle: <HelpCircle size={24} />,  Headphones: <Headphones size={24} />,  Shield: <Shield size={24} />,  PhoneOff: <PhoneOff size={24} />,  Database: <Database size={24} />,  Mail: <Mail size={24} />,  MessageSquare: <MessageSquare size={24} />,  Function: <Function size={24} />,  Music: <Music size={24} />,  Eraser: <Eraser size={24} />,  ArrowRight: <ArrowRight size={24} />,  Tag: <Tag size={24} />,  Clock: <Clock size={24} />,  ServerCog: <ServerCog size={24} />
};

const DEFAULT_LANG = 'it';

type TaskListProps = {
  tasks: any[];
  stepKey?: string; // Optional step key for filtering (e.g., 'start', 'noMatch')
};

const TaskList: React.FC<TaskListProps> = ({ tasks, stepKey }) => {
  const { combinedClass } = useFontContext();
  const [columns, setColumns] = useState(4);
  const containerRef = useRef<HTMLDivElement>(null);
  const [lang, setLang] = useState(DEFAULT_LANG);

  // Filter tasks by context (escalation) and optionally by step type
  const filteredTasks = useMemo(() => {
    if (!stepKey) {
      // If no stepKey, show all tasks allowed in escalation
      return filterTasksByContext(tasks, TaskContext.ESCALATION);
    }

    // Map stepKey string to EscalationStepType enum
    const stepTypeMap: Record<string, EscalationStepType> = {
      'start': EscalationStepType.START,
      'noMatch': EscalationStepType.NO_MATCH,
      'noInput': EscalationStepType.NO_INPUT,
      'confirmation': EscalationStepType.CONFIRMATION,
      'success': EscalationStepType.SUCCESS,
      'introduction': EscalationStepType.INTRODUCTION,
    };

    const stepType = stepTypeMap[stepKey];
    if (stepType) {
      return filterTasksByContext(tasks, TaskContext.ESCALATION, stepType);
    }

    // Fallback: show all escalation tasks if stepKey doesn't match
    return filterTasksByContext(tasks, TaskContext.ESCALATION);
  }, [tasks, stepKey]);

  useEffect(() => {
    const updateColumns = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const possibleColumns = Math.floor(containerWidth / MIN_THUMBNAIL_WIDTH);
        const newColumns = Math.max(1, Math.min(possibleColumns, filteredTasks.length));
        setColumns(newColumns);
      }
    };

    const resizeObserver = new ResizeObserver(updateColumns);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [filteredTasks.length]);

  useEffect(() => {
    // fetch('/data/actionsCatalog.json') // This line is removed as per the new_code
    //   .then(res => res.json())
    //   .then(setActions);
  }, []);

  return (
    <div className={`action-list-grid ${combinedClass}`} style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Se vuoi permettere la selezione lingua, aggiungi qui un select */}
      {/* <select value={lang} onChange={e => setLang(e.target.value)}>
        <option value="it">Italiano</option>
        <option value="en">English</option>
        <option value="pt">Português</option>
      </select> */}
      <div
        ref={containerRef}
        className="action-list-grid-inner"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
          gap: 16,
          width: '100%',
          minHeight: 0,
        }}
      >
        {filteredTasks.map((task, index) => {
          if (!task) {
            return null;
          }
          // Estrai label, description, primaryValue, parameters come stringhe
          const label = typeof task.label === 'object' ? task.label[lang] || task.label.en || task.id : task.label;
          const description = typeof task.description === 'object' ? task.description[lang] || task.description.en || '' : task.description;
          // Esempio: primaryValue = task.text[lang] o task.text
          let primaryValue = '';
          if (task.text) {
            primaryValue = typeof task.text === 'object' ? task.text[lang] || task.text.en || '' : task.text;
          }
          // Parametri figli: estrai solo quelli che sono oggetti lingua o stringhe
          let parameters = [];
          if (task.parameters && Array.isArray(task.parameters)) {
            parameters = task.parameters.map((param: any) => ({
              key: param.key,
              value: typeof param.value === 'object' ? param.value[lang] || param.value.en || '' : param.value
            }));
          }
          const props = {
            task,
            icon: iconMap[task.icon] || <Tag size={24} />,
            iconName: task.icon,
            label,
            color: task.color,
            description,
            primaryValue,
            parameters
          };
          // Passa key direttamente, NON dentro props
          return <div className="action-list-item" key={task.id || index}><TaskItem {...props} /></div>;
        })}
      </div>
    </div>
  );
};

export default TaskList;

