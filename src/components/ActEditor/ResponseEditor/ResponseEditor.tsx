// Executive summary: Main entry point for the Response Editor component. Handles layout and orchestration of the response tree.
import React, { useState } from 'react';
import ActionItem from '../ActionViewer/ActionItem';
import ActionList from '../ActionViewer/ActionList';
import { Tag, MessageCircle, HelpCircle, Headphones, Shield, PhoneOff, Database, Mail, MessageSquare, FunctionSquare as Function, Music, Eraser, ArrowRight, Clock, ServerCog } from 'lucide-react';
import ToolbarButton from './ToolbarButton';
import TreeView from './TreeView';
import styles from './ResponseEditor.module.css';
import { TreeNodeProps } from './types';

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
  console.log('[estraiParametroPrincipale] Azione:', action);
  console.log('[estraiParametroPrincipale] Catalogo trovato:', catalog);
  if (!catalog || !catalog.params) {
    console.log('[estraiParametroPrincipale] Nessun catalogo o params', { action, catalog });
    return '[catalogo non trovato]';
  }
  const paramKey = Object.keys(catalog.params).find(k => catalog.params[k].type === 'string');
  console.log('[estraiParametroPrincipale] Parametro principale scelto:', paramKey, { action, catalog });
  if (!paramKey) {
    console.log('[estraiParametroPrincipale] Nessun parametro principale trovato', { action, catalog });
    return '[parametro principale non trovato]';
  }
  const translationKey = action[paramKey];
  console.log('[estraiParametroPrincipale] Chiave di traduzione cercata:', translationKey, { action, paramKey });
  if (!translationKey) {
    console.log('[estraiParametroPrincipale] Nessuna chiave di traduzione trovata', { action, paramKey });
    return '[chiave di traduzione mancante]';
  }
  if (!translations) {
    console.log('[estraiParametroPrincipale] Translations non fornito', { action, paramKey, translationKey });
    return `[${translationKey}] [translations mancante]`;
  }
  let value = translationKey;
  let found = false;
  if (Array.isArray(translations)) {
    const t = translations.find((t: any) => t.key === translationKey);
    if (t && t.value && t.value[lang]) {
      value = t.value[lang];
      found = true;
      console.log('[estraiParametroPrincipale] Traduzione trovata (array)', { translationKey, value, lang });
    } else {
      console.log('[estraiParametroPrincipale] Traduzione NON trovata (array)', { translationKey, lang });
    }
  } else if (typeof translations === 'object') {
    if (translations[translationKey] && translations[translationKey][lang]) {
      value = translations[translationKey][lang];
      found = true;
      console.log('[estraiParametroPrincipale] Traduzione trovata (object)', { translationKey, value, lang });
    } else {
      console.log('[estraiParametroPrincipale] Traduzione NON trovata (object)', { translationKey, lang });
    }
  }
  if (!found) {
    value = `[${translationKey}] non trovato!`;
    console.log('[estraiParametroPrincipale] Valore finale mostrato:', value);
  } else {
    console.log('[estraiParametroPrincipale] Valore finale mostrato:', value);
  }
  return value;
};

const estraiValoreTradotto = (key: string, translations: any, lang: string) => {
  if (!key) {
    console.log('[estraiValoreTradotto] Chiave mancante');
    return '';
  }
  if (!translations) {
    console.log('[estraiValoreTradotto] Translations non fornito', { key });
    return '';
  }
  let value = '';
  if (Array.isArray(translations)) {
    const t = translations.find((t: any) => t.key === key);
    if (t && t.value && t.value[lang]) {
      value = t.value[lang];
    } else {
      console.log('[estraiValoreTradotto] Traduzione NON trovata (array)', { key, lang });
    }
  } else if (typeof translations === 'object') {
    if (translations[key] && translations[key][lang]) {
      value = translations[key][lang];
    } else {
      console.log('[estraiValoreTradotto] Traduzione NON trovata (object)', { key, lang });
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
  console.log('[ResponseEditor] props', { ddt, translations, lang });
  const [selectedStep, setSelectedStep] = useState<string | null>(null);
  const [actionCatalog, setActionCatalog] = useState<any[]>([]);
  const [showLabel, setShowLabel] = useState(false);
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

  const initialNodes = estraiNodiDaDDT(ddt);
  const actions = ddt && selectedStep && ddt.steps && ddt.steps[selectedStep]
    ? Array.isArray(ddt.steps[selectedStep])
      ? ddt.steps[selectedStep]
      : ddt.steps[selectedStep].actions || []
    : [];
  console.log('[ResponseEditor] actions for step', selectedStep, actions);

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
          {actions.length === 0 ? (
            <div style={{ color: '#888' }}>Nessuna azione per questo step</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {actions.map((action: any, idx: number) => {
                const catalog = actionCatalog.find(a => a.id === action.actionType);
                const bg = stepBg[selectedStep!] || '#eaf6ff';
                const indent = stepIndent[selectedStep!] || 12;
                const paramValue = estraiParametroPrincipale(action, catalog, translations, lang);
                if (!paramValue || paramValue === action.text || paramValue === action.label) {
                  console.log('[ResponseEditor] Nessuna traduzione trovata per', { action, catalog, lang, paramValue });
                } else {
                  console.log('[ResponseEditor] Valore tradotto', { action, catalog, lang, paramValue });
                }
                // Primary parameter (for now always 'text')
                const primaryParam = 'text';
                const primaryKey = action[primaryParam];
                let primaryValue = estraiValoreTradotto(primaryKey, translations, lang);
                if (!primaryValue) primaryValue = 'Scrivi messaggio qui...';
                // Label azione
                const actionLabel = estraiLabelAzione(action.actionType, translations, lang);
                // Altri parametri
                const otherParams = catalog && catalog.params ? Object.keys(catalog.params).filter(p => p !== primaryParam) : [];
                return (
                  <div key={action.actionInstanceId || idx} style={{ background: bg, borderRadius: 8, padding: '10px 16px', marginLeft: indent, boxShadow: '0 1px 2px #0001', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span>{catalog ? iconMap[catalog.icon] : <Tag size={24} />}</span>
                      {actionLabel && (
                        <span style={{ fontSize: 12, color: '#888', opacity: 0.7, textShadow: '0 1px 4px #fff', marginRight: 8 }}>
                          {actionLabel}
                        </span>
                      )}
                      <span style={{ fontWeight: 500, fontSize: 15 }}>{primaryValue}</span>
                    </div>
                    {/* Altri parametri come figli indentati */}
                    <div style={{ marginLeft: 32, marginTop: 2 }}>
                      {otherParams.map(paramKey => {
                        const chiave = action[paramKey];
                        const valore = estraiValoreTradotto(chiave, translations, lang);
                        return (
                          <div key={paramKey} style={{ fontSize: 14, color: '#333', marginBottom: 2 }}>
                            <b>{paramKey}:</b> {valore}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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