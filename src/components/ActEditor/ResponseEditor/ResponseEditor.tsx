// REGOLA GLOBALE PER LE CHIAVI DI TRANSLATION DEI DDT (runtime):
// Formato:
//   runtime.<DDT_ID>.<step>[#<n>].<actionInstanceId>.text
// - <DDT_ID>: l'id del DataDialogueTemplate (es: DDT_BirthOfDate)
// - <step>: tipo di step (es: normal, noInput, noMatch, explicitConfirmation, success, ecc.)
// - [#<n>]: numero escalation (opzionale, parte da 1 se ci sono più azioni per step)
// - <actionInstanceId>: es. sayMessage2, askQuestion1, ecc.
// - .text: suffisso fisso per il testo principale
// Esempi:
//   runtime.DDT_BirthOfDate.normal#1.askQuestion1.text
//   runtime.DDT_BirthOfDate.noInput#1.sayMessage1.text
//   runtime.DDT_BirthOfDate.noMatch#2.sayMessageX.text
//   runtime.DDT_BirthOfDate.success#1.sayMessageSuccess.text
// Note: questa regola va rispettata sia negli script di inserimento/aggiornamento che nel codice di lookup delle translations.
//
// ---
// Executive summary: Main entry point for the Response Editor component. Handles layout and orchestration of the response tree.
import React, { useState, useEffect } from 'react';
import ActionItem from '../ActionViewer/ActionItem';
import ActionList from '../ActionViewer/ActionList';
import { Tag, MessageCircle, HelpCircle, Headphones, Shield, PhoneOff, Database, Mail, MessageSquare, FunctionSquare as Function, Music, Eraser, ArrowRight, Clock, ServerCog, Calendar, MapPin, FileText, PlayCircle, MicOff, CheckCircle2, CheckSquare, AlertCircle, Plus } from 'lucide-react';
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

// Funzione di lookup con tipi espliciti
function getTranslationText(
  translations: Record<string, any>,
  ddtId: string,
  step: string,
  escalation: number,
  actionInstanceId: string,
  lang: string
) {
  const key = `runtime.${ddtId}.${step}#${escalation}.${actionInstanceId}.text`;
  const fallbackKey = `runtime.${ddtId}.${step}.${actionInstanceId}.text`;
  const actionsKey = `Actions.${actionInstanceId}.text`;
  if (translations[key] && translations[key][lang]) {
    return translations[key][lang];
  }
  if (translations[fallbackKey] && translations[fallbackKey][lang]) {
    return translations[fallbackKey][lang];
  }
  if (translations[actionsKey] && translations[actionsKey][lang]) {
    return translations[actionsKey][lang];
  }
  return '';
}

// Funzione per numerale ordinale italiano (1° 2° 3° ...)
function ordinalIt(n: number) {
  return n + '°';
}

const estraiNodiDaDDT = (ddt: any, translations: any, lang: string): TreeNodeProps[] => {
  if (!ddt || !ddt.steps) return [];
  const nodes: TreeNodeProps[] = [];
  for (const [stepKey, actions] of Object.entries(ddt.steps)) {
    if (Array.isArray(actions)) {
      if (actions.length > 1 && (stepKey === 'noMatch' || stepKey === 'noInput' || stepKey === 'confirmation' || stepKey === 'notAcquired')) {
        // Step con escalation: crea un nodo escalation per ogni escalation
        actions.forEach((action: any, idx: number) => {
          const escalationId = `${stepKey}_escalation_${idx + 1}`;
          // Nodo escalation (visuale, non azione vera)
          nodes.push({
            id: escalationId,
            text: `${ordinalIt(idx + 1)} recovery`,
            type: 'escalation',
            level: idx + 1, // <-- parte da 1
            // parentId: undefined
          });
          // Nodo azione come figlio
          const actionInstanceId = action.actionInstanceId;
          const ddtId = ddt.id || ddt._id;
          const text = getTranslationText(translations, ddtId, stepKey, idx + 1, actionInstanceId, lang);
          nodes.push({
            id: actionInstanceId,
            text,
            type: stepKey,
            level: idx + 2, // <-- escalation+1
            parentId: escalationId,
          });
        });
      } else {
        // Step senza escalation: azioni root
        actions.forEach((action: any, idx: number) => {
          const actionInstanceId = action.actionInstanceId;
          const ddtId = ddt.id || ddt._id;
          const text = getTranslationText(translations, ddtId, stepKey, 1, actionInstanceId, lang);
          nodes.push({
            id: actionInstanceId,
            text,
            type: stepKey,
            level: 0,
            // parentId: undefined
          });
        });
      }
    }
  }
  // Success step (può essere oggetto)
  if (ddt.steps.success && ddt.steps.success.actions) {
    ddt.steps.success.actions.forEach((action: any, idx: number) => {
      const actionInstanceId = action.actionInstanceId;
      const ddtId = ddt.id || ddt._id;
      const text = getTranslationText(translations, ddtId, 'success', 1 + idx, actionInstanceId, lang);
      nodes.push({
        id: actionInstanceId,
        text,
        type: 'success',
        level: 0,
        // parentId: undefined
      });
    });
  }
  return nodes;
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
  onClose?: () => void;
}

// Rimuovo defaultNodes

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

const ResponseEditor: React.FC<ResponseEditorProps> = ({ ddt, translations, lang = 'it', onClose }) => {
  // LOG: stampa le props ricevute
  // LOG: oggetto translations appena ricevuto
  if (translations) {
    const tObj = translations as Record<string, any>;
  } else {
    // LOG: translations è undefined o null!
  }
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

  // Stato nodi dinamico dal DDT
  const [nodes, setNodes] = useState<TreeNodeProps[]>([]);
  useEffect(() => {
    setNodes(estraiNodiDaDDT(ddt, translations, lang));
  }, [ddt, translations, lang]);

  // Filtro i nodi per lo step selezionato
  let filteredNodes: TreeNodeProps[] = [];
  if (selectedStep) {
    // Step con escalation
    const escalationSteps = ['noMatch', 'noInput', 'confirmation', 'notAcquired'];
    if (escalationSteps.includes(selectedStep)) {
      // Prendi tutti i nodi escalation di questo step e i loro figli
      const escalationNodes = nodes.filter(n => n.type === 'escalation' && n.id.startsWith(`${selectedStep}_escalation_`));
      const escalationIds = escalationNodes.map(n => n.id);
      const childNodes = nodes.filter(n => n.parentId && escalationIds.includes(n.parentId));
      filteredNodes = [...escalationNodes, ...childNodes];
    } else {
      // Step senza escalation: prendi solo le azioni root di questo step
      filteredNodes = nodes.filter(n => n.type === selectedStep && !n.parentId);
    }
  }

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
        // Drop su canvas: aggiungi come root
        setNodes(prev => [...prev, { ...newNode, level: 0, parentId: undefined }]);
      } else {
        const targetNode = nodes.find(n => n.id === targetId);
        if (!targetNode) {
          setNodes(prev => [...prev, { ...newNode, level: 0, parentId: undefined }]);
        } else if (targetNode.type === 'escalation' && position === 'child') {
          // Drop su escalation: aggiungi come figlio
          setNodes(prev => [...prev, { ...newNode, level: (targetNode.level || 0) + 1, parentId: targetNode.id }]);
        } else if (targetNode.type === 'escalation' && (position === 'before' || position === 'after')) {
          // Drop su escalation come before/after: aggiungi come root (stesso livello escalation)
          setNodes(prev => insertNodeAt(prev, { ...newNode, level: targetNode.level, parentId: targetNode.parentId }, targetId, position));
        } else if (targetNode.type === 'action') {
          // Drop su action: aggiungi come fratello (stesso parentId e livello)
          const pos: 'before' | 'after' = position === 'before' ? 'before' : 'after';
          setNodes(prev => insertNodeAt(prev, { ...newNode, level: targetNode.level, parentId: targetNode.parentId }, targetId, pos));
        } else {
          // Fallback: aggiungi come root
          setNodes(prev => [...prev, { ...newNode, level: 0, parentId: undefined }]);
        }
      }
      setTimeout(() => {}, 100);
      return id;
    }
    // Spostamento nodo esistente: da implementare se serve
    return null;
  };
  const removeNode = (id: string) => setNodes(prev => prev.filter(n => n.id !== id));

  // Funzione per aggiungere escalation nello step corrente
  const handleAddEscalation = () => {
    if (!selectedStep) return;
    const escalationNodes = nodes.filter(n => n.type === 'escalation' && n.id.startsWith(`${selectedStep}_escalation_`));
    const newIdx = escalationNodes.length + 1;
    const escalationId = `${selectedStep}_escalation_${newIdx}`;
    setNodes(prev => [
      ...prev,
      {
        id: escalationId,
        text: `${ordinalIt(newIdx)} recovery`,
        type: 'escalation',
        level: newIdx,
      }
    ]);
  };

  // Header DDT con icona e label
  const getDDTIcon = (type: string) => {
    if (!type) return <FileText className="w-5 h-5 text-fuchsia-100 mr-2" />;
    const t = type.toLowerCase();
    if (t === 'date') return <Calendar className="w-5 h-5 text-fuchsia-100 mr-2" />;
    if (t === 'email') return <Mail className="w-5 h-5 text-fuchsia-100 mr-2" />;
    if (t === 'address') return <MapPin className="w-5 h-5 text-fuchsia-100 mr-2" />;
    return <FileText className="w-5 h-5 text-fuchsia-100 mr-2" />;
  };

  // Mapping step -> icona, colore, label user-friendly
  const stepMeta: Record<string, { icon: JSX.Element; label: string; border: string; bg: string; color: string; bgActive: string }> = {
    start:        { icon: <PlayCircle size={17} />,        label: 'Chiede il dato',      border: '#3b82f6', bg: 'rgba(59,130,246,0.08)', color: '#3b82f6', bgActive: 'rgba(59,130,246,0.18)' },
    noMatch:      { icon: <HelpCircle size={17} />,        label: 'Non ha capito',       border: '#ef4444', bg: 'rgba(239,68,68,0.08)', color: '#ef4444', bgActive: 'rgba(239,68,68,0.18)' },
    noInput:      { icon: <MicOff size={17} />,            label: 'Non ha sentito',      border: '#6b7280', bg: 'rgba(107,114,128,0.08)', color: '#6b7280', bgActive: 'rgba(107,114,128,0.18)' },
    confirmation: { icon: <CheckCircle2 size={17} />,      label: 'Deve confermare',     border: '#eab308', bg: 'rgba(234,179,8,0.08)', color: '#eab308', bgActive: 'rgba(234,179,8,0.18)' },
    success:      { icon: <CheckSquare size={17} />,       label: 'Ha capito!',          border: '#22c55e', bg: 'rgba(34,197,94,0.08)', color: '#22c55e', bgActive: 'rgba(34,197,94,0.18)' },
    notAcquired:  { icon: <AlertCircle size={17} />,       label: 'Dato non acquisito',  border: '#f59e42', bg: 'rgba(245,158,66,0.08)', color: '#f59e42', bgActive: 'rgba(245,158,66,0.18)' },
  };

  return (
    <div className={styles.responseEditorRoot}>
      {/* Header DDT con icona e label */}
      <div
        style={{
          background: '#a21caf',
          color: '#fff',
          padding: '10px 0 10px 32px',
          textAlign: 'left',
          fontWeight: 700,
          fontSize: 18,
          borderTopLeftRadius: 10,
          borderTopRightRadius: 10,
          marginBottom: 12,
          letterSpacing: 0.2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: 12
        }}
      >
        {getDDTIcon(ddt?.dataType?.type)}
        <span style={{ fontWeight: 700, fontSize: 18, color: '#fff', letterSpacing: 0.2 }}>
          {ddt?.label || ddt?.name || '—'}
        </span>
      </div>
      {/* Bottone di chiusura in alto a destra */}
      {onClose && (
        <button
          style={{ position: 'absolute', top: 8, right: 8, zIndex: 10 }}
          onClick={onClose}
          title="Chiudi editor"
        >
          ✕
        </button>
      )}
      <div className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <span style={{ fontWeight: 600, color: '#fff', fontSize: 15, marginRight: 8 }}>Il Bot:</span>
          <span style={{ display: 'inline-flex', gap: 8 }}>
            {stepKeys.filter(step => step !== 'notAcquired').map((step) => {
              const meta = stepMeta[step] || { icon: <PlayCircle size={17} />, label: step, border: '#888', bg: 'rgba(100,100,100,0.08)', color: '#888', bgActive: 'rgba(100,100,100,0.18)' };
              const isActive = selectedStep === step;
              return (
                <button
                  key={step}
                  onClick={() => setSelectedStep(step)}
                  style={{
                    border: `1.5px solid ${meta.border}`,
                    background: isActive ? meta.bgActive : meta.bg,
                    color: meta.color,
                    borderRadius: 999,
                    padding: '3px 16px',
                    fontWeight: 700,
                    fontSize: 15,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer',
                    boxShadow: isActive ? `0 0 0 2px ${meta.border}33` : undefined,
                    outline: 'none',
                    transition: 'background 0.15s, box-shadow 0.15s',
                  }}
                >
                  {meta.icon}
                  {meta.label}
                </button>
              );
            })}
          </span>
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 13, color: '#555' }}>
              <input type="checkbox" checked={showLabel} onChange={e => setShowLabel(e.target.checked)} style={{ marginRight: 4 }} />
              Mostra label azione
            </label>
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'row', height: '100%' }}>
        <div style={{ flex: 2, minWidth: 0, padding: 16 }}>
          <TreeView
            nodes={filteredNodes}
            onDrop={handleDrop}
            onRemove={removeNode}
            onAddEscalation={handleAddEscalation}
          />
          {/* Bottone aggiungi escalation in fondo alla lista escalation */}
          {selectedStep && ['noMatch', 'noInput', 'confirmation'].includes(selectedStep) && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
              <button
                onClick={() => {
                  // Trova quanti escalation ci sono già
                  const escalationNodes = nodes.filter(n => n.type === 'escalation' && n.id.startsWith(`${selectedStep}_escalation_`));
                  const newIdx = escalationNodes.length + 1;
                  const escalationId = `${selectedStep}_escalation_${newIdx}`;
                  setNodes(prev => [
                    ...prev,
                    {
                      id: escalationId,
                      text: `${ordinalIt(newIdx)} recovery`,
                      type: 'escalation',
                      level: newIdx,
                    }
                  ]);
                }}
                style={{
                  color: '#ef4444',
                  border: '1.5px solid #ef4444',
                  background: 'rgba(239,68,68,0.08)',
                  borderRadius: 999,
                  padding: '5px 18px',
                  fontWeight: 700,
                  fontSize: 15,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  marginTop: 8
                }}
              >
                <Plus size={18} style={{ marginRight: 6 }} />
                Aggiungi recovery
              </button>
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