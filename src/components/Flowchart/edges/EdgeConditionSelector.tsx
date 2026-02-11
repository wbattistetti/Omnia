import React, { useState, useRef, useEffect } from 'react';
import { Link2Off as LinkOff } from 'lucide-react';
import { IntellisenseMenu } from '../../Intellisense/IntellisenseMenu';
import { IntellisenseItem } from '../../Intellisense/IntellisenseTypes';
import { useProjectData } from '../../../context/ProjectDataContext';
// ✅ RIMOSSO: findAgentAct - non esiste più il concetto di Act
import { taskRepository } from '../../../services/TaskRepository';
import { useDynamicFontSizes } from '../../../hooks/useDynamicFontSizes';
import { calculateFontBasedSizes } from '../../../utils/fontSizeUtils';
import { getValuesFromTask, buildConditionName } from '../../TaskEditor/ResponseEditor/utils/getNodeValues';
import { VoiceInput } from '../../common/VoiceInput';

/**
 * Props per EdgeConditionSelector
 * @property position - posizione assoluta {x, y} per il popup
 * @property onSelectCondition - callback quando viene selezionata una condizione
 * @property onSelectUnconditioned - callback per collegamento senza condizione
 * @property onSelectElse - callback per marcare questo collegamento come ELSE (fallback)
 * @property onClose - callback per chiusura del popup
 */
export interface EdgeConditionSelectorProps {
  position: { x: number; y: number };
  onSelectCondition: (item: IntellisenseItem) => void;
  onSelectUnconditioned: () => void;
  onSelectElse?: () => void;
  onClose: () => void;
  onCreateCondition?: (name: string, scope?: 'global' | 'industry') => void;
  seedItems?: IntellisenseItem[];
  extraItems?: IntellisenseItem[];
  sourceNodeId?: string | null;
  sourceRows?: any[];
}

/**
 * Popup per selezionare una condizione (o nessuna) per un collegamento edge.
 */
export const EdgeConditionSelector: React.FC<EdgeConditionSelectorProps> = ({
  position,
  onSelectCondition,
  onSelectUnconditioned,
  onSelectElse,
  onClose,
  onCreateCondition,
  seedItems,
  extraItems: extraItemsFromCaller,
  sourceNodeId,
  sourceRows
}) => {

  const [inputValue, setInputValue] = useState('');
  const [navSeq, setNavSeq] = useState(0);
  const [navDir, setNavDir] = useState<1 | -1>(1);
  const [showIntellisense, setShowIntellisense] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: projectData } = useProjectData();
  const [extraItems, setExtraItems] = useState<IntellisenseItem[] | undefined>(undefined);
  const fontSizes = useDynamicFontSizes();

  // Auto-focus input e apri subito l'intellisense quando il componente viene montato
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      // Apri sempre: se seedItems è presente, verranno mostrati anche senza dati globali
      setShowIntellisense(true);
      try { if (localStorage.getItem('debug.condUI') === '1') console.log('[CondUI][mount] focus + showIntellisense', { extraCount: Array.isArray(extraItems) ? extraItems.length : 0 }); } catch { }
    }
  }, [extraItems]);

  // Chiudi il popup se clicchi fuori
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!target.closest('.edge-condition-selector')) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Gestione ESC e intellisense
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (showIntellisense) {
        setShowIntellisense(false);
      } else {
        onClose();
      }
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const dir = e.key === 'ArrowDown' ? 1 : -1;
      setNavDir(dir);
      setNavSeq(s => {
        const next = s + 1;
        try { console.log('[CondUI][nav]', { key: e.key, dir, seq: next }); } catch { }
        return next;
      });
    } else if (e.key === 'Enter') {
      // Se il menu è aperto, conferma l'item selezionato nel menu
      if (showIntellisense) {
        e.preventDefault();
        e.stopPropagation();
        try { document.dispatchEvent(new CustomEvent('intelli-enter')); } catch { }
        return;
      }
      // Altrimenti: crea/usa condizione con la label digitata
      const name = (inputValue || '').trim();
      e.preventDefault();
      e.stopPropagation();
      if (!name) return;
      try { console.log('[CondFlow] enter', { name }); } catch { }
      if (onCreateCondition) onCreateCondition(name, 'industry');
      setShowIntellisense(false);
    }
  };

  // Gestione input e apertura intellisense
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    // mantieni aperto; il provider interno filtrerà i risultati
    setShowIntellisense(true);
    try { console.log('[CondUI][input]', { value: newValue }); } catch { }
  };

  // Selezione da intellisense
  const handleIntellisenseSelect = (item: IntellisenseItem) => {
    try { console.log('[CondUI][select]', item); } catch { }
    // ✅ NUOVO: Se è un valore predefinito, crea condizione completa
    if ((item as any)?.kind === 'value') {
      const conditionName = item.name || item.label; // ✅ Già formattato come "nomeDato === 'valore'"
      if (onCreateCondition && conditionName) {
        onCreateCondition(conditionName, 'industry'); // ✅ Condizione completa
        setShowIntellisense(false);
        return;
      }
    }
    // ✅ Legacy: Mantiene compatibilità con vecchio sistema (kind === 'intent')
    if ((item as any)?.kind === 'intent') {
      const intentName = item.label || item.name;
      if (onCreateCondition && intentName) {
        onCreateCondition(intentName, 'industry');
        setShowIntellisense(false);
        return;
      }
    }
    onSelectCondition(item);
    setShowIntellisense(false);
  };

  const handleIntellisenseClose = () => {
    setShowIntellisense(false);
  };

  // ✅ NUOVO: Build unified extraItems prioritizing values from source node tasks
  useEffect(() => {
    try {
      const out: IntellisenseItem[] = [];
      const rows = Array.isArray(sourceRows) ? sourceRows : [];

      // ✅ NUOVO: 1) Cerca values da sourceNode (non più solo ProblemClassification)
      for (const r of rows) {
        const taskId = r?.taskId || r?.id;
        if (!taskId) continue;

        try {
          const task = taskRepository.getTask(taskId);
          if (!task) continue;

          // ✅ Cerca values[] in data (non più task.intents)
          const values = getValuesFromTask(task);
          if (values.length === 0) continue;

          // ✅ Costruisci items per ogni valore
          const dataLabel = task.label || 'dato';
          const varName = dataLabel.replace(/\s+/g, '_').toLowerCase();

          for (const value of values) {
            const valueLabel = value.label || value.value || value.id;
            const conditionName = buildConditionName(dataLabel, valueLabel);

            out.push({
              id: `value-${taskId}-${valueLabel}`,
              label: valueLabel,
              name: conditionName, // ✅ Condizione completa
              value: valueLabel,
              description: conditionName,
              category: `Valori: ${dataLabel}`,
              categoryType: 'values' as const,
              kind: 'value' as const, // ✅ Non più 'intent'
              payload: {
                taskId,
                dataLabel,
                varName,
                valueLabel,
                conditionName
              }
            });
          }
        } catch (err) {
          // Ignore
        }
      }

      // ✅ Legacy: 2) Fallback a vecchio sistema (mantenuto per compatibilità)
      if (out.length === 0) {
        const pid = (() => { try { return localStorage.getItem('current.projectId') || ''; } catch { return ''; } })();
        // Cerca intents legacy da ProblemClassification
        for (const r of rows) {
          const isPC = String(r?.type || '').toLowerCase() === 'problemclassification';
          if (!isPC) continue;
          const actId = r?.factoryId ?? r?.id;
          if (!actId) continue;
          const key = `problem.${pid}.${actId}`;
          let payload: any = null;
          try { const raw = localStorage.getItem(key); payload = raw ? JSON.parse(raw) : null; } catch { }
          let intentsSrc: any[] = Array.isArray(payload?.intents) ? payload.intents : [];
          if (intentsSrc.length === 0) {
            try {
              const taskId = r?.taskId || r?.id;
              if (taskId) {
                const task = taskRepository.getTask(taskId);
                if (task?.intents && Array.isArray(task.intents)) {
                  intentsSrc = task.intents;
                }
              }
            } catch (err) {
              // Ignore
            }
          }
          const actLabel = String(r?.text || r?.label || 'problem').trim();
          const varName = `${actLabel.replace(/\s+/g, '_').toLowerCase()}.variable`;
          for (const intent of intentsSrc) {
            out.push({
              id: `intent-${actId}-${intent.id || intent.name}`,
              label: intent.name,
              name: intent.name,
              description: intent.name,
              category: 'Problem Intents',
              categoryType: 'conditions',
              kind: 'intent',
              payload: { actId, intentId: intent.id, intent, actVariable: varName }
            });
          }
        }
      }

      setExtraItems(out);
      try {
        const labels = out.map(i => i.label);
        console.log('[CondUI][extraItems]', { count: out.length, labels });
      } catch { }
    } catch { }
  }, [projectData, sourceNodeId, Array.isArray(sourceRows) ? sourceRows.length : 0]);

  // Gestione creazione nuova condizione
  const handleCreateCondition = (name: string, scope?: 'global' | 'industry') => {
    try { console.log('[CondUI][create]', { name, scope }); } catch { }
    if (onCreateCondition) {
      onCreateCondition(name, scope);
      setShowIntellisense(false);
    }
  };

  // Click su collegamento senza condizione
  const handleUnconditionedClick = () => {
    onSelectUnconditioned();
  };


  return (
    <div
      className="edge-condition-selector fixed z-50 bg-white border border-gray-300 rounded-lg shadow-xl p-3"
      style={{
        // allinea il top del popup esattamente al punto, centrato orizzontalmente (nessun gap)
        top: position.y,
        left: position.x,
        transform: 'translate(-50%, 0)',
        width: 520,
        minWidth: 360
      }}
    >
      {/* Arrow anchor (punta il punto di rilascio, dal bordo superiore del popup) */}
      <div
        style={{
          position: 'absolute',
          top: -5,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 0,
          height: 0,
          borderLeft: '7px solid transparent',
          borderRight: '7px solid transparent',
          borderBottom: '7px solid rgba(209,213,219,1)'
        }}
      />
      {/* Header */}
      <div className="text-sm font-medium text-gray-700 mb-2">
        Seleziona condizione
      </div>
      {/* Input e pulsanti */}
      <div className="flex items-center space-x-2">
        {/* ✅ Usa utility centralizzata per dimensioni */}
        {(() => {
          const sizes = calculateFontBasedSizes(fontSizes.nodeRow);

          return (
            <>
              {/* Campo input */}
              <div className="flex-1" style={{ maxWidth: 360, overflow: 'visible', position: 'relative' }}>
                {(() => {
                  console.log('[EdgeConditionSelector] About to render VoiceInput:', {
                    hasRef: !!inputRef,
                    value: inputValue,
                    placeholder: 'Digita per cercare condizioni...',
                    VoiceInputType: typeof VoiceInput,
                    VoiceInputValue: VoiceInput,
                  });

                  try {
                    return (
                      <VoiceInput
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={handleInputChange}
                        onKeyDown={handleInputKeyDown}
                        placeholder="Digita per cercare condizioni..."
                        className="w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        style={{
                          fontSize: fontSizes.nodeRow,
                          paddingTop: `${sizes.inputPaddingV}px`,
                          paddingBottom: `${sizes.inputPaddingV}px`,
                          paddingLeft: `${sizes.inputPaddingH}px`,
                          // paddingRight is managed by VoiceInput when voice is supported
                          height: `${sizes.inputHeight}px`,
                          minHeight: `${sizes.inputHeight}px`,
                          boxSizing: 'border-box'
                        }}
                      />
                    );
                  } catch (error) {
                    console.error('[EdgeConditionSelector] Error rendering VoiceInput:', error);
                    // Fallback to regular input
                    return (
                      <input
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={handleInputChange}
                        onKeyDown={handleInputKeyDown}
                        placeholder="Digita per cercare condizioni..."
                        className="w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        style={{
                          fontSize: fontSizes.nodeRow,
                          paddingTop: `${sizes.inputPaddingV}px`,
                          paddingBottom: `${sizes.inputPaddingV}px`,
                          paddingLeft: `${sizes.inputPaddingH}px`,
                          height: `${sizes.inputHeight}px`,
                          minHeight: `${sizes.inputHeight}px`,
                          boxSizing: 'border-box'
                        }}
                      />
                    );
                  }
                })()}
              </div>
              {/* Pulsante Else accanto alla textbox - proporzionale */}
              <button
                onClick={() => { onSelectElse && onSelectElse(); }}
                className="font-semibold rounded-md border border-purple-600 bg-purple-600 text-white hover:bg-purple-500 flex items-center justify-center"
                style={{
                  fontSize: fontSizes.nodeRow,
                  padding: `${sizes.buttonPaddingV}px ${sizes.buttonPaddingH}px`,
                  height: `${sizes.buttonHeight}px`,
                  minHeight: `${sizes.buttonHeight}px`,
                  boxSizing: 'border-box'
                }}
                title="Else: usa questo collegamento solo se tutte le altre condizioni del nodo sorgente sono false"
              >
                Else
              </button>
              {/* Pulsante collegamento senza condizione - proporzionale */}
              <button
                onClick={handleUnconditionedClick}
                className="flex items-center justify-center bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-md transition-colors"
                style={{
                  width: `${sizes.iconButtonSize}px`,
                  height: `${sizes.iconButtonSize}px`,
                  minWidth: `${sizes.iconButtonSize}px`,
                  minHeight: `${sizes.iconButtonSize}px`,
                  boxSizing: 'border-box'
                }}
                title="Collegamento senza condizione"
              >
                <LinkOff size={sizes.iconSize} className="text-gray-600" style={{ width: `${sizes.iconSize}px`, height: `${sizes.iconSize}px` }} />
              </button>
            </>
          );
        })()}
      </div>
      {/* Help text */}
      <div className="text-xs text-gray-500 mt-2">
        Inizia a digitare per vedere le condizioni disponibili, usa Else per il ramo di fallback, o l'icona per un collegamento incondizionato.
      </div>
      {/* Intellisense Menu */}
      {showIntellisense && (
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', top: 36, left: 0, right: 0, zIndex: 9999 }}>
            <IntellisenseMenu
              isOpen={showIntellisense}
              query={inputValue}
              position={{ x: 0, y: 0 }}
              referenceElement={inputRef.current}
              onSelect={handleIntellisenseSelect}
              onClose={handleIntellisenseClose}
              filterCategoryTypes={[]}
              onCreateNew={handleCreateCondition}
              extraItems={extraItemsFromCaller || extraItems}
              allowedKinds={['condition', 'intent']}
              inlineAnchor={true}
              navSignal={{ seq: navSeq, dir: navDir }}
              onEnterSelected={(sel) => {
                try { console.log('[CondUI][enterSelected]', sel); } catch { }
                if (sel) {
                  // riflette la scelta nella textbox per chiarezza
                  try { setInputValue(sel.label || (sel as any).name || ''); } catch { }
                  handleIntellisenseSelect(sel as any);
                }
              }}
            />
          </div>
        </div>
      )}

    </div>
  );
};