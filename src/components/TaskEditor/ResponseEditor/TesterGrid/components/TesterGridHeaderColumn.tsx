import React, { useEffect, useRef } from 'react';
import { Wand2, TypeIcon, Plus, X } from 'lucide-react';
import SmartTooltip from '../../../../SmartTooltip';
import { getEditorTypeFromContractType } from '../helpers/contractTypeMapper';

interface TesterGridHeaderColumnProps {
  type: 'regex' | 'deterministic' | 'ner' | 'llm' | 'embeddings';
  contractType: 'regex' | 'rules' | 'ner' | 'llm' | 'embeddings'; // ✅ Original contract type from DataContract
  mainLabel: string;
  techLabel: string;
  tooltip: string;
  backgroundColor: string;
  enabled: boolean;
  activeEditor: 'regex' | 'extractor' | 'ner' | 'llm' | 'post' | 'embeddings' | null;
  onToggleMethod: () => void;
  onToggleEditor: (type: 'regex' | 'extractor' | 'ner' | 'llm' | 'embeddings') => void;
  showPostProcess?: boolean;
  onAddContract?: () => void; // ✅ STEP 7: Callback per aprire dropdown
  availableMethods?: Array<'regex' | 'rules' | 'ner' | 'llm' | 'embeddings'>; // ✅ STEP 8: Methods disponibili
  isDropdownOpen?: boolean; // ✅ STEP 8: Se il dropdown è aperto
  onSelectMethod?: (method: 'regex' | 'rules' | 'ner' | 'llm' | 'embeddings') => void; // ✅ STEP 8: Callback per selezionare method
  columnWidth?: number; // ✅ FIX: Explicit column width to prevent overlapping
  onRemoveContract?: () => void; // ✅ NUOVO: Callback per rimuovere contract
}

/**
 * Reusable header column component for extractor columns
 */
export default function TesterGridHeaderColumn({
  type,
  contractType, // ✅ Original contract type
  mainLabel,
  techLabel,
  tooltip,
  backgroundColor,
  enabled,
  activeEditor,
  onToggleMethod,
  onToggleEditor,
  showPostProcess = false,
  onAddContract, // ✅ STEP 7: Destructure new prop
  availableMethods = [], // ✅ STEP 8: Destructure new props
  isDropdownOpen = false,
  onSelectMethod,
  columnWidth, // ✅ FIX: Explicit column width
  onRemoveContract,
}: TesterGridHeaderColumnProps) {
  const editorType = getEditorTypeFromContractType(contractType);

  // Editor is active if:
  // 1. activeEditor matches the mapped editor type (e.g., 'extractor' for 'rules' contract)
  // 2. OR it's a 'rules' contract and activeEditor is 'post' (post-process editor)
  const isEditorActive = activeEditor === editorType || (contractType === 'rules' && activeEditor === 'post');
  const shouldHide = activeEditor && ['regex', 'extractor', 'ner', 'llm'].includes(activeEditor) && !isEditorActive;
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ✅ Close dropdown when clicking outside
  useEffect(() => {
    if (!isDropdownOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        // Find the "+" button that opened the dropdown
        const plusButton = (event.target as HTMLElement)?.closest('button');
        if (plusButton && plusButton.querySelector('svg')) {
          // If clicking the "+" button, toggle the dropdown
          onAddContract?.();
        } else {
          // If clicking outside, close the dropdown
          onAddContract?.();
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen, onAddContract]);

  return (
    <th
      style={{
        textAlign: 'left',
        padding: 8,
        background: backgroundColor,
        opacity: enabled ? 1 : 0.4,
        visibility: shouldHide ? 'hidden' : 'visible',
        position: 'relative', // ✅ STEP 8: Per posizionare dropdown
        width: columnWidth ? `${columnWidth}px` : 'auto', // ✅ FIX: Explicit width to prevent overlapping
        minWidth: columnWidth ? `${columnWidth}px` : '200px', // ✅ FIX: Minimum width aumentato per evitare tagli
        maxWidth: columnWidth ? `${columnWidth}px` : 'none', // ✅ FIX: Maximum width
        wordWrap: 'break-word', // ✅ FIX: Permette wrapping del testo
        overflowWrap: 'break-word', // ✅ FIX: Wrapping moderno
        whiteSpace: 'normal', // ✅ FIX: Permette wrapping invece di ellipsis
      }}
      title={tooltip}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={onToggleMethod}
            style={{ cursor: 'pointer', flexShrink: 0 }}
            disabled={type === 'embeddings'}
          />
          <div style={{ minWidth: 0, flex: 1 }}>
            <span style={{ fontWeight: 600, color: enabled ? '#0b0f17' : '#9ca3af', wordBreak: 'break-word' }}>{mainLabel}</span>
            <span style={{ opacity: 0.7, marginLeft: 4, color: enabled ? '#0b0f17' : '#9ca3af', wordBreak: 'break-word' }}>({techLabel})</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {/* ✅ FIX: Matita sempre visibile per tutte le colonne */}
          {type === 'deterministic' && showPostProcess ? (
            <>
              <SmartTooltip text="Configure Extractor" tutorId="configure_extractor_help" placement="bottom">
                <button
                  onClick={() => onToggleEditor('extractor')}
                  style={{
                    background: isEditorActive ? '#3b82f6' : 'rgba(255,255,255,0.3)',
                    border: 'none',
                    borderRadius: 4,
                    padding: '4px 6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    transition: 'all 0.2s',
                    flexShrink: 0,
                  }}
                >
                  <Wand2 size={14} color={isEditorActive ? '#fff' : '#666'} />
                </button>
              </SmartTooltip>
              <SmartTooltip text="Configure Post Process" tutorId="configure_post_help" placement="bottom">
                <button
                  onClick={() => onToggleEditor('post')}
                  style={{
                    background: (contractType === 'rules' && activeEditor === 'post') ? '#10b981' : 'rgba(255,255,255,0.3)',
                    border: 'none',
                    borderRadius: 4,
                    padding: '4px 6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    transition: 'all 0.2s',
                    flexShrink: 0,
                  }}
                >
                  <TypeIcon size={14} color={(contractType === 'rules' && activeEditor === 'post') ? '#fff' : '#666'} />
                </button>
              </SmartTooltip>
            </>
          ) : (
            <SmartTooltip text={`Configure ${techLabel}`} tutorId={`configure_${type}_help`} placement="bottom">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  // ✅ Use contractType to determine editor type directly
                  const editorTypeToOpen = contractType === 'rules' ? 'extractor' : contractType;
                  if (onToggleEditor) {
                    onToggleEditor(editorTypeToOpen);
                  }
                }}
                title={`Configure ${techLabel}`}
                style={{
                  background: isEditorActive ? '#3b82f6' : 'rgba(255,255,255,0.3)',
                  border: 'none',
                  borderRadius: 4,
                  padding: '4px 6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'all 0.2s',
                  flexShrink: 0,
                }}
              >
                <Wand2 size={14} color={isEditorActive ? '#fff' : '#666'} />
              </button>
            </SmartTooltip>
          )}

          {/* ✅ FIX: Pulsante + sempre visibile se ci sono metodi disponibili */}
          {onAddContract && availableMethods.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddContract();
              }}
              title="Aggiungi contract a destra"
              style={{
                background: 'rgba(255,255,255,0.3)',
                border: 'none',
                borderRadius: 4,
                padding: '4px 6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                transition: 'all 0.2s',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(59, 130, 246, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.3)';
              }}
            >
              <Plus size={14} color="#666" />
            </button>
          )}

          {/* ✅ NUOVO: Pulsante X per rimuovere colonna */}
          {onRemoveContract && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(`Rimuovere il contratto "${mainLabel} (${techLabel})"?`)) {
                  onRemoveContract();
                }
              }}
              title="Rimuovi contract"
              style={{
                background: 'rgba(239, 68, 68, 0.2)',
                border: 'none',
                borderRadius: 4,
                padding: '4px 6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                transition: 'all 0.2s',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
              }}
            >
              <X size={14} color="#ef4444" />
            </button>
          )}
        </div>
      </div>
      {/* ✅ STEP 8: Dropdown per aggiungere contract a destra - mostra direttamente il menu senza pulsante */}
      {isDropdownOpen && availableMethods.length > 0 && onSelectMethod && (
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            zIndex: 1000,
            marginTop: 4,
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 6,
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            minWidth: 200,
            maxHeight: 300,
            overflowY: 'auto',
          }}
        >
          {availableMethods.map((method) => {
            const METHOD_LABELS: Record<'regex' | 'rules' | 'ner' | 'llm' | 'embeddings', string> = {
              regex: 'Espressione (Regex)',
              rules: 'Logica (Extractor)',
              ner: 'AI Rapida (NER)',
              llm: 'AI Completa (LLM)',
              embeddings: 'Classificazione (Embeddings)',
            };
            return (
              <button
                key={method}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  console.log('[TesterGridHeaderColumn] Selected method:', method, {
                    hasOnSelectMethod: !!onSelectMethod,
                  });
                  if (onSelectMethod) {
                    onSelectMethod(method);
                  } else {
                    console.warn('[TesterGridHeaderColumn] onSelectMethod is not defined');
                  }
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 12px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 13,
                  color: '#0b0f17',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f3f4f6';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                {METHOD_LABELS[method]}
              </button>
            );
          })}
        </div>
      )}
    </th>
  );
}
