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
}

/**
 * Header del nodo: mostra titolo, azioni di editing e delete.
 */
export const NodeHeader: React.FC<NodeHeaderProps> = (props) => {
  const { title, onTitleUpdate, startEditingTitle, leftIcon, bgClass, borderBottom, hasUnchecked, hideUnchecked, onToggleHideUnchecked } = props;
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
  };

  // Annulla editing titolo
  const handleTitleCancel = () => {
    setTempTitle(title);
    setIsEditingTitle(false);
    setShowIntellisense(false);
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
      className={`relative flex items-center justify-between ${bgClass || 'bg-gray-200'} p-2 rounded-t-lg ${borderBottom === false ? '' : 'border-b border-slate-600'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={(e) => {
        try {
          const rtAny = e.relatedTarget as any;
          const isNode = rtAny && typeof rtAny === 'object' && typeof rtAny.nodeType === 'number';
          if (iconBarRef.current && isNode && iconBarRef.current.contains(rtAny as Node)) {
            return;
          }
        } catch {}
        setIsHovered(false);
      }}
      style={{ cursor: isHovered ? 'grab' : 'default' }}
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
              className="min-w-0 bg-slate-600 text-white text-[8px] px-1.5 py-1 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 border-2 border-purple-400 nodrag"
              style={{ width: 'calc(100% - 56px)', maxWidth: 'calc(100% - 56px)' }}
              onFocus={() => {
                if (titleInputRef.current) {
                  const rect = titleInputRef.current.getBoundingClientRect();
                  setIntellisensePosition({ x: rect.left, y: rect.bottom + 2 });
                  // setShowIntellisense(true); // Disabilitato su richiesta
                }
              }}
            />
            <button
              onClick={handleTitleSave}
              className="ml-1 p-1 text-green-400 hover:text-green-300 transition-colors"
              title="Conferma"
            >
              <Check className="w-3 h-3" />
            </button>
            <button
              onClick={handleTitleCancel}
              className="ml-1 p-1 text-red-400 hover:text-red-300 transition-colors"
              title="Annulla"
            >
              <X className="w-3 h-3" />
            </button>
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
            className="text-black text-[8px] font-semibold cursor-text hover:text-purple-300 transition-colors truncate"
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
      {/* Icon bar: appare solo con hover, posizionata FUORI dall'header (sopra, senza gap) */}
      {isHovered && (
        <div
          className="absolute right-0 flex items-center gap-2 z-20"
          style={{ bottom: '100%', background: 'transparent', border: 'none', boxShadow: 'none', height: 16, alignItems: 'center' }}
          ref={iconBarRef}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <button className="p-0" title="Edit" style={{ background: 'none', border: 'none' }}>
            <Edit3 className="w-3 h-3 text-slate-500 hover:text-green-500" />
          </button>
          {hasUnchecked && (
            <button
              className="p-0"
              title={hideUnchecked ? 'Show unchecked rows' : 'Hide unchecked rows'}
              style={{ background: 'none', border: 'none' }}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleHideUnchecked && onToggleHideUnchecked(); }}
            >
              {hideUnchecked ? (
                <Eye className="w-3 h-3 text-slate-500 hover:text-slate-800" />
              ) : (
                <EyeOff className="w-3 h-3 text-slate-500 hover:text-slate-800" />
              )}
            </button>
          )}
          <button
            className="p-0"
            title="Delete"
            style={{ background: 'none', border: 'none' }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              try {
                // Cerca callback nel parent data/onDelete
                const deleteEvent = new CustomEvent('flow:node:delete', { bubbles: true });
                (e.currentTarget as HTMLElement).dispatchEvent(deleteEvent);
              } catch {}
              // Fallback: prova a invocare prop se disponibile (non visibile qui perché destrutturata)
              try { (props as any)?.onDelete?.(); } catch {}
            }}
          >
            <Trash2 className="w-3 h-3 text-slate-500 hover:text-red-500" />
          </button>
          <button className="p-0" title="Play" style={{ background: 'none', border: 'none' }}>
            <Play className="w-3 h-3 text-slate-500 hover:text-emerald-500" />
          </button>
        </div>
      )}

      {/* Anchor handle per drag "rigido" dell'intero cluster */}
      <div title="Drag to move with descendants" className="rigid-anchor" style={{ cursor: 'grab' }}
           onMouseDown={() => {
             try {
               (window as any).__flowDragMode = 'rigid';
               // gated logs removed
             } catch {}
           }}
           onMouseUp={() => {
             try {
               (window as any).__flowDragMode = undefined;
               // gated logs removed
             } catch {}
           }}>
        {isHovered && <Anchor className="w-3 h-3 text-slate-700" />}
      </div>
    </div>
  );
};