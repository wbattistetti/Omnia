// Executive summary: Main entry point for the Response Editor component. Handles layout and orchestration of the response tree.
import React, { useState } from 'react';
import ActionItem from '../ActionViewer/ActionItem';
import ActionList from '../ActionViewer/ActionList';
import { Tag, MessageCircle, HelpCircle, Headphones, Shield, PhoneOff, Database, Mail, MessageSquare, FunctionSquare as Function, Music, Eraser, ArrowRight, Clock, ServerCog } from 'lucide-react';
import ToolbarButton from './ToolbarButton';
import TreeView from './TreeView';
import styles from './ResponseEditor.module.css';
import { TreeNodeProps } from './types';
import { useTreeNodes } from './useTreeNodes';
import { useReducer } from 'react';

const iconMap: Record<string, React.ReactNode> = {
  MessageCircle: <MessageCircle size={24} />,  HelpCircle: <HelpCircle size={24} />,  Headphones: <Headphones size={24} />,  Shield: <Shield size={24} />,  PhoneOff: <PhoneOff size={24} />,  Database: <Database size={24} />,  Mail: <Mail size={24} />,  MessageSquare: <MessageSquare size={24} />,  Function: <Function size={24} />,  Music: <Music size={24} />,  Eraser: <Eraser size={24} />,  ArrowRight: <ArrowRight size={24} />,  Tag: <Tag size={24} />,  Clock: <Clock size={24} />,  ServerCog: <ServerCog size={24} />
};

const DEFAULT_LANG = 'it';

const stepBg: Record<string, string> = {
  normal: '#fff',
  noMatch: '#ffeaea',
  noInput: '#f5f6fa',
};
const stepIndent: Record<string, number> = {
  normal: 0,
  noMatch: 24,
  noInput: 24,
};

const estraiParametroPrincipale = (action: any, catalog: any, translations: any, lang: string) => {
  if (!catalog || !catalog.params) {
    return '[catalogo non trovato]';
  }
  const paramKey = Object.keys(catalog.params).find(k => catalog.params[k].type === 'string');
  if (!paramKey) {
    return '[parametro principale non trovato]';
  }
  const translationKey = action[paramKey];
  if (!translationKey) {
    return '[chiave di traduzione mancante]';
  }
  if (!translations) {
    return `[${translationKey}] [translations mancante]`;
  }
  let value = translationKey;
  let found = false;
  if (Array.isArray(translations)) {
    const t = translations.find((t: any) => t.key === translationKey);
    if (t && t.value && t.value[lang]) {
      value = t.value[lang];
      found = true;
    }
  } else if (typeof translations === 'object') {
    if (translations[translationKey] && translations[translationKey][lang]) {
      value = translations[translationKey][lang];
      found = true;
    }
  }
  if (!found) {
    value = `[${translationKey}] non trovato!`;
  }
  return value;
};

const estraiValoreTradotto = (key: string, translations: any, lang: string) => {
  if (!key) {
    return '';
  }
  if (!translations) {
    return '';
  }
  let value = '';
  if (Array.isArray(translations)) {
    const t = translations.find((t: any) => t.key === key);
    if (t && t.value && t.value[lang]) {
      value = t.value[lang];
    }
  } else if (typeof translations === 'object') {
    if (translations[key] && translations[key][lang]) {
      value = translations[key][lang];
    }
  }
  return value;
};

const estraiNodiDaDDT = (ddt: any): TreeNodeProps[] => {
  // TODO: implementa la logica reale di estrazione
  if (!ddt) return [];
  // Esempio: supponiamo che ddt.prompts sia un array di stringhe
  if (Array.isArray(ddt?.prompts)) {
    return ddt.prompts.map((text: string, i: number) => ({
      id: String(i + 1),
      text,
      type: i === 0 ? 'root' : 'action',
      onDrop: () => {}
    }));
  }
  return [];
};

const estraiLabelAzione = (actionType: string, translations: any, lang: string) => {
  const key = `action.${actionType}.label`;
  if (!translations) return '';
  if (Array.isArray(translations)) {
    const t = translations.find((t: any) => t.key === key);
    return t && t.value && t.value[lang] ? t.value[lang] : '';
  } else if (typeof translations === 'object') {
    return translations[key] && translations[key][lang] ? translations[key][lang] : '';
  }
  return '';
};

interface ResponseEditorProps {
  ddt?: any;
  translations?: any;
  lang?: string;
}

const defaultNodes: TreeNodeProps[] = [
  { id: '1', text: "What is the patient's date of birth?", type: 'root' },
  { id: '2', text: "I didn't understand. Could you provide the patient's date of birth?", type: 'nomatch', level: 1, parentId: '1' },
  { id: '3', text: "Please provide the patient's date of birth.", type: 'noinput', level: 1, parentId: '1' }
];

// Inserisce un nodo nell'array subito prima o dopo il targetId, mantenendo parentId e level
function insertNodeAt(nodes: TreeNodeProps[], newNode: TreeNodeProps, targetId: string, position: 'before' | 'after'): TreeNodeProps[] {
  const idx = nodes.findIndex(n => n.id === targetId);
  if (idx === -1) return [...nodes, newNode];
  const before = position === 'before';
  // Trova tutti i nodi con lo stesso parentId e level del target
  const target = nodes[idx];
  const siblings = nodes.filter(n => n.parentId === target.parentId && n.level === target.level);
  // Trova la posizione tra i fratelli
  const siblingIdx = siblings.findIndex(n => n.id === targetId);
  // Costruisci il nuovo array
  const result: TreeNodeProps[] = [];
  let inserted = false;
  for (let n of nodes) {
    if (n.parentId === target.parentId && n.level === target.level && siblings.includes(n)) {
      if (!inserted && n.id === targetId && before) {
        result.push(newNode);
        inserted = true;
      }
      result.push(n);
      if (!inserted && n.id === targetId && !before) {
        result.push(newNode);
        inserted = true;
      }
    } else {
      result.push(n);
    }
  }
  if (!inserted) result.push(newNode);
  return result;
}

function nodesReducer(state: TreeNodeProps[], action: any): TreeNodeProps[] {
  switch (action.type) {
    case 'SET':
      return action.nodes;
    case 'ADD':
      if (action.insertAt) {
        // Inserimento ordinato tra fratelli
        return insertNodeAt(state, action.node, action.targetId, action.position);
      }
      return [...state, action.node];
    case 'REMOVE':
      return state.filter(n => n.id !== action.id);
    default:
      return state;
  }
}

const ResponseEditor: React.FC<ResponseEditorProps> = ({ ddt, translations, lang = 'it' }) => {
  const [selectedStep, setSelectedStep] = useState<string | null>(null);
  const [actionCatalog, setActionCatalog] = useState<any[]>([]);
  const [showLabel, setShowLabel] = useState(false);
  const [activeDragAction, setActiveDragAction] = useState<any>(null);
  const stepKeys = ddt && ddt.steps ? Object.keys(ddt.steps) : [];
  React.useEffect(() => {
    if (stepKeys.length > 0 && !selectedStep) {
      setSelectedStep(stepKeys[0]);
    }
  }, [stepKeys, selectedStep]);

  React.useEffect(() => {
    fetch('/data/actionsCatalog.json')
      .then(res => res.json())
      .then(setActionCatalog)
      .catch(err => {
        setActionCatalog([]);
        console.error('Errore fetch actionsCatalog in ResponseEditor:', err);
      });
  }, []);

  const [nodes, dispatch] = useReducer(nodesReducer, defaultNodes);

  // handleDrop logica semplificata (solo aggiunta root per demo)
  const handleDrop = (targetId: string | null, position: 'before' | 'after' | 'child', item: any) => {
    if (item && item.action) {
      const action = item.action;
      const id = Math.random().toString(36).substr(2, 9);
      const newNode: TreeNodeProps = {
        id,
        text: typeof action.label === 'object' ? action.label.it || action.label.en || action.id : action.label,
        type: 'action',
        icon: item.icon,
        color: item.color,
        label: typeof action.label === 'object' ? action.label.it || action.label.en || action.id : action.label,
        primaryValue: item.primaryValue,
        parameters: item.parameters,
      };
      if (targetId === null) {
        dispatch({ type: 'ADD', node: { ...newNode, level: 0, parentId: undefined } });
      } else {
        const targetNode = nodes.find(n => n.id === targetId);
        if (!targetNode) {
          dispatch({ type: 'ADD', node: { ...newNode, level: 0, parentId: undefined } });
        } else if (position === 'before' || position === 'after') {
          dispatch({
            type: 'ADD',
            node: { ...newNode, level: targetNode.level, parentId: targetNode.parentId },
            insertAt: true,
            targetId,
            position
          });
        } else if (position === 'child') {
          dispatch({ type: 'ADD', node: { ...newNode, level: (targetNode.level || 0) + 1, parentId: targetNode.id } });
        }
      }
      return id;
    }
    // Spostamento nodo esistente: da implementare se serve
    return null;
  };
  const removeNode = (id: string) => dispatch({ type: 'REMOVE', id });

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.toolbar}>
          {stepKeys.map((step) => (
            <ToolbarButton
              key={step}
              label={step}
              active={selectedStep === step}
              onClick={() => setSelectedStep(step)}
            />
          ))}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 13, color: '#555' }}>
              <input type="checkbox" checked={showLabel} onChange={e => setShowLabel(e.target.checked)} style={{ marginRight: 4 }} />
              Mostra label azione
            </label>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'row', height: '100%' }}>
        <div style={{ flex: 2, minWidth: 0, padding: 16 }}>
          <TreeView
            nodes={nodes}
            onDrop={handleDrop}
            onRemove={removeNode}
          />
        </div>
        <div style={{ flex: 1, minWidth: 220, borderLeft: '1px solid #eee', padding: 16, background: '#fafaff' }}>
          <h3 style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>Azioni disponibili</h3>
          <ActionList />
        </div>
      </div>
    </div>
  );
};

export default ResponseEditor;