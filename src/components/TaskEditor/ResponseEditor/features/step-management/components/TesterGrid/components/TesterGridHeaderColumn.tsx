import React, { useEffect, useRef, useLayoutEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Wand2, TypeIcon, Plus, X } from 'lucide-react';
import SmartTooltip from '@components/SmartTooltip';
import { getEditorTypeFromContractType } from '@responseEditor/features/step-management/components/TesterGrid/helpers/contractTypeMapper';
import {
  getContractMethodLabel,
  sortContractMethodsByDisplayOrder,
  type ContractMethod,
} from '@responseEditor/ContractSelector/ContractSelector';

interface TesterGridHeaderColumnProps {
  type: 'regex' | 'deterministic' | 'ner' | 'llm' | 'embeddings' | 'grammarflow';
  contractType: 'regex' | 'rules' | 'ner' | 'llm' | 'embeddings' | 'grammarflow'; // ✅ Original contract type from DataContract
  mainLabel: string;
  techLabel: string;
  tooltip: string;
  backgroundColor: string;
  enabled: boolean;
  activeEditor: 'regex' | 'extractor' | 'ner' | 'llm' | 'post' | 'embeddings' | 'grammarflow' | null;
  onToggleMethod: () => void;
  onToggleEditor: (type: 'regex' | 'extractor' | 'ner' | 'llm' | 'embeddings' | 'grammarflow') => void;
  showPostProcess?: boolean;
  onAddContract?: () => void; // ✅ STEP 7: Callback per aprire dropdown
  availableMethods?: Array<'regex' | 'rules' | 'ner' | 'llm' | 'embeddings'>; // ✅ STEP 8: Methods disponibili (grammarflow not included - added manually)
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
  // Note: grammarflow doesn't have an inline editor (uses separate Grammar Editor), so it's never "active"
  const isEditorActive = activeEditor === editorType || (contractType === 'rules' && activeEditor === 'post');
  const shouldHide = activeEditor && ['regex', 'extractor', 'ner', 'llm', 'grammarflow'].includes(activeEditor) && !isEditorActive;
  const thRef = useRef<HTMLTableCellElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuBox, setMenuBox] = useState<{ top: number; right: number; minWidth: number; maxHeight: number } | null>(null);

  const updateMenuPosition = useCallback(() => {
    if (!thRef.current) return;
    const rect = thRef.current.getBoundingClientRect();
    const margin = 8;
    const maxH = Math.max(120, Math.min(320, window.innerHeight - rect.bottom - margin));
    setMenuBox({
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
      minWidth: Math.max(rect.width, 200),
      maxHeight: maxH,
    });
  }, []);

  useLayoutEffect(() => {
    if (!isDropdownOpen) {
      setMenuBox(null);
      return;
    }
    updateMenuPosition();
    window.addEventListener('scroll', updateMenuPosition, true);
    window.addEventListener('resize', updateMenuPosition);
    return () => {
      window.removeEventListener('scroll', updateMenuPosition, true);
      window.removeEventListener('resize', updateMenuPosition);
    };
  }, [isDropdownOpen, updateMenuPosition]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const t = event.target as Node;
      if (thRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      if (isDropdownOpen) onAddContract?.();
    };
    if (isDropdownOpen) {
      document.addEventListener('pointerdown', handlePointerDown);
      return () => document.removeEventListener('pointerdown', handlePointerDown);
    }
  }, [isDropdownOpen, onAddContract]);

  return (
    <th
      ref={thRef}
      style={{
        textAlign: 'left',
        padding: 8,
        background: backgroundColor,
        opacity: enabled ? 1 : 0.4,
        visibility: shouldHide ? 'hidden' : 'visible',
        position: 'relative',
        boxSizing: 'border-box',
        minWidth: columnWidth ? `${Math.max(100, Math.min(columnWidth, 200))}px` : '120px',
        width: 'auto',
        maxWidth: 'none',
        overflow: 'visible',
      }}
      title={tooltip}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          flexWrap: 'nowrap',
          minWidth: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={onToggleMethod}
            style={{ cursor: 'pointer', flexShrink: 0 }}
            disabled={type === 'embeddings'}
          />
          <div
            style={{
              minWidth: 0,
              flex: 1,
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
            }}
          >
            <span style={{ fontWeight: 600, color: enabled ? '#0b0f17' : '#9ca3af' }}>{mainLabel}</span>
            <span style={{ opacity: 0.7, marginLeft: 4, color: enabled ? '#0b0f17' : '#9ca3af' }}>({techLabel})</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center' }}>
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
      {isDropdownOpen &&
        availableMethods.length > 0 &&
        onSelectMethod &&
        menuBox &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: menuBox.top,
              right: menuBox.right,
              minWidth: menuBox.minWidth,
              maxHeight: menuBox.maxHeight,
              overflowY: 'auto',
              overflowX: 'hidden',
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: 6,
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              zIndex: 10050,
              scrollbarGutter: 'stable',
            }}
          >
            {sortContractMethodsByDisplayOrder(availableMethods as ContractMethod[]).map((method) => (
              <button
                key={method}
                type="button"
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onSelectMethod(method);
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
                {getContractMethodLabel(method)}
              </button>
            ))}
          </div>,
          document.body
        )}
    </th>
  );
}
