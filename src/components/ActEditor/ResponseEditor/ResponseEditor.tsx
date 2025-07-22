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
      .then(setActionCatalog);
  }, []);

  // Hook per aggiungere nodi (canvas drop)
  const { addNode } = useTreeNodes([]); // NB: qui serve solo addNode, lo stato è gestito in TreeView

  // Rimuovi DndContext, DragOverlay e la logica collegata

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
          <TreeView />
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