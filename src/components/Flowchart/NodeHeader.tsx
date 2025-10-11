import React, { useState, useRef, useEffect } from 'react';
import { Trash2, Edit3, Check, X, Anchor, Play, Eye, EyeOff } from 'lucide-react';
import { IntellisenseMenu } from '../Intellisense/IntellisenseMenu';
import { createPortal } from 'react-dom';

/**
 * Props per NodeHeader
 * @property title - titolo del nodo
 * @property onDelete - callback per eliminare il nodo
 * @property onToggleEdit - callback per attivare/disattivare la modalità editing
 * @property onTitleUpdate - callback per aggiornare il titolo
 * @property isEditing - true se il nodo è in modalità editing
 */
export interface NodeHeaderProps {
  title: string;
  onDelete: () => void;
  onToggleEdit: () => void;
  onTitleUpdate: (newTitle: string) => void;
  isEditing: boolean;
  onPlay?: () => void; // nuova prop opzionale
  alwaysShowTrash?: boolean;
  startEditingTitle?: boolean; // se true, entra in editing al mount/prop change
  leftIcon?: React.ReactNode;
  bgClass?: string;
  borderBottom?: boolean;
  hasUnchecked?: boolean; // se esistono righe deselezionate
  hideUnchecked?: boolean; // stato corrente: nascondi righe deselezionate
  onToggleHideUnchecked?: () => void; // toggle
  nodeId?: string; // per indirizzare eventi esterni (toolbar)
}

/**
 * Header del nodo: mostra titolo, azioni di editing e delete.
 */
export const NodeHeader: React.FC<NodeHeaderProps> = (props) => {
  const { title, onTitleUpdate, startEditingTitle, leftIcon, bgClass, borderBottom, hasUnchecked, hideUnchecked, onToggleHideUnchecked, nodeId } = props;
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(title);
  const [isHovered, setIsHovered] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [showIntellisense, setShowIntellisense] = useState(false);
  const [intellisensePosition, setIntellisensePosition] = useState({ x: 0, y: 0 });
  const iconBarRef = useRef<HTMLDivElement>(null);
  // Caret target when switching to edit, computed from click position on title
  const wantedCaretRef = useRef<number | null>(null);

  // Inizia editing titolo
  const handleTitleEdit = () => {
    setIsEditingTitle(true);
    setTempTitle(title);
    setTimeout(() => {
      if (titleInputRef.current) {
        const rect = titleInputRef.current.getBoundingClientRect();
        setIntellisensePosition({ x: rect.left, y: rect.bottom + 2 });
        // setShowIntellisense(true); // Disabilitato su richiesta
        // Position caret based on previous click location on the static title
        try {
          const idx = wantedCaretRef.current;
          if (typeof idx === 'number') {
            const clamped = Math.max(0, Math.min(String(title).length, idx));
            titleInputRef.current.setSelectionRange(clamped, clamped);
          } else {
            // default: place caret at end
            const len = titleInputRef.current.value.length;
            titleInputRef.current.setSelectionRange(len, len);
          }
        } catch {}
      }
    }, 0);
  };

  // Avvia editing al mount/prop change se richiesto
  useEffect(() => {
    if (startEditingTitle && !isEditingTitle) {
      handleTitleEdit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startEditingTitle]);

  // Salva titolo
  const handleTitleSave = () => {
    onTitleUpdate(tempTitle.trim() || 'Untitled Node');
    setIsEditingTitle(false);
    setShowIntellisense(false);
    try { props.onToggleEdit && props.onToggleEdit(); } catch {}
  };

  // Annulla editing titolo
  const handleTitleCancel = () => {
    setTempTitle(title);
    setIsEditingTitle(false);
    setShowIntellisense(false);
    try { props.onToggleEdit && props.onToggleEdit(); } catch {}
  };

  // Gestione tasti Enter/Escape
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSave();
    } else if (e.key === 'Escape') {
      handleTitleCancel();
    }
  };

  // Se perdi il focus, chiudi intellisense
  useEffect(() => {
    if (!isEditingTitle) setShowIntellisense(false);
  }, [isEditingTitle]);

  // Gestione selezione intellisense
  const handleIntellisenseSelect = (item: any) => {
    setTempTitle(item.name);
    setShowIntellisense(false);
    if (titleInputRef.current) titleInputRef.current.focus();
  };

  return (
    <div 
      className={`relative flex items-center ${bgClass || 'bg-slate-700'} text-white px-2 py-2 rounded-t-lg ${borderBottom === false ? '' : 'border-b border-slate-600'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ cursor: isHovered ? 'grab' : 'default', width: '100%' }}
    >
      {/* No transparent bridges: keep header clean for text events */}
      {/* Titolo + editing */}
      <div className="flex items-center min-w-0 flex-1" style={{ position: 'relative' }}>
        {isEditingTitle ? (
          <div className="flex items-center min-w-0 flex-1">
            {leftIcon && <span className="mr-1 flex-shrink-0">{leftIcon}</span>}
            <input
              ref={titleInputRef}
              type="text"
              value={tempTitle}
              onChange={(e) => setTempTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              className="node-title-input min-w-0 bg-slate-600 text-white text-[10px] px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 border border-purple-400 nodrag"
              data-node-id={nodeId || ''}
              style={{ width: '100%', paddingRight: 8 }}
              onFocus={() => {
                if (titleInputRef.current) {
                  const rect = titleInputRef.current.getBoundingClientRect();
                  setIntellisensePosition({ x: rect.left, y: rect.bottom + 2 });
                  // setShowIntellisense(true); // Disabilitato su richiesta
                }
              }}
            />
            {(() => {
              const hasText = (tempTitle || '').trim().length > 0;
              return (
                <>
                  {/* X sempre visibile: subito fuori dal bordo destro */}
                  <button
                    onClick={handleTitleCancel}
                    className="p-0 text-red-300 hover:text-red-200"
                    title="Annulla"
                    style={{ position: 'absolute', right: -12, top: '50%', transform: 'translateY(-50%)', zIndex: 4 }}
                  >
                    <X className="w-3 h-3" />
                  </button>
                  {/* ✓ solo dopo input: ancora più a destra della X */}
                  {hasText && (
                    <button
                      onClick={handleTitleSave}
                      className="p-0 text-green-300 hover:text-green-200"
                      title="Conferma"
                      style={{ position: 'absolute', right: -28, top: '50%', transform: 'translateY(-50%)', zIndex: 4 }}
                    >
                      <Check className="w-3 h-3" />
                    </button>
                  )}
                </>
              );
            })()}
            {/* IntellisenseMenu come portale */}
            {showIntellisense &&
              createPortal(
                <div style={{
                  position: 'absolute',
                  left: intellisensePosition.x,
                  top: intellisensePosition.y,
                  zIndex: 9999,
                }}>
                  <IntellisenseMenu
                    isOpen={showIntellisense}
                    query={tempTitle}
                    position={{ x: 0, y: 0 }}
                    referenceElement={null}
                    onSelect={handleIntellisenseSelect}
                    onClose={() => setShowIntellisense(false)}
                    filterCategoryTypes={['tasks', 'macroTasks']}
                  />
                </div>,
                document.body
              )
            }
          </div>
        ) : (
          <h3
            className="text-black text-[8px] font-semibold cursor-text hover:text-purple-300 transition-colors truncate flex-1"
            onMouseDown={(e) => {
              // Approximate caret index from click X over title width
              try {
                const el = e.currentTarget as HTMLElement;
                const rect = el.getBoundingClientRect();
                const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
                const text = String(title);
                const ratio = rect.width > 0 ? (x / rect.width) : 0;
                wantedCaretRef.current = Math.round(ratio * text.length);
              } catch { wantedCaretRef.current = null; }
              handleTitleEdit();
            }}
            title="Modifica titolo"
            style={{ display: 'inline-block' }}
          >
            {leftIcon && <span className="mr-1 align-middle inline-flex">{leftIcon}</span>}
            {title}
          </h3>
        )}
      </div>
      {/* Toolbar/anchor non presenti nell'header: la toolbar vive fuori dall'header */}
    </div>
  );
};