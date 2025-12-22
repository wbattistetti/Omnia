import React, { useState, useRef, useEffect } from 'react';
import { Trash2, Edit3, Check, X, Anchor, Play, Eye, EyeOff } from 'lucide-react';
import { IntellisenseMenu } from '../../../Intellisense/IntellisenseMenu';
import { createPortal } from 'react-dom';
import { useDynamicFontSizes } from '../../../../hooks/useDynamicFontSizes';

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
  const headerContainerRef = useRef<HTMLDivElement>(null);
  const [showIntellisense, setShowIntellisense] = useState(false);
  const [intellisensePosition, setIntellisensePosition] = useState({ x: 0, y: 0 });
  const iconBarRef = useRef<HTMLDivElement>(null);
  // Caret target when switching to edit, computed from click position on title
  const wantedCaretRef = useRef<number | null>(null);
  // Extended hover area for editing (include icons outside border)
  const [extendedRect, setExtendedRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  // ✅ Font sizes dinamici dallo store globale
  const fontSizes = useDynamicFontSizes();

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
        } catch { }
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
    try { props.onToggleEdit && props.onToggleEdit(); } catch { }
  };

  // Annulla editing titolo
  const handleTitleCancel = () => {
    setTempTitle(title);
    setIsEditingTitle(false);
    setShowIntellisense(false);
    try { props.onToggleEdit && props.onToggleEdit(); } catch { }
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

  // Calcola area estesa quando entra in editing (per hover robusto)
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      const updateRect = () => {
        if (!titleInputRef.current) return;

        const inputRect = titleInputRef.current.getBoundingClientRect();

        // Area estesa per hover (include spazio per icone a destra)
        setExtendedRect({
          top: inputRect.top - 7,
          left: inputRect.left - 7,
          width: inputRect.width + 47 + 14, // +47 per le icone, +7*2 per padding
          height: inputRect.height + 14,
        });
      };

      updateRect();
      window.addEventListener('resize', updateRect);
      window.addEventListener('scroll', updateRect, true);
      return () => {
        window.removeEventListener('resize', updateRect);
        window.removeEventListener('scroll', updateRect, true);
      };
    } else {
      setExtendedRect(null);
    }
  }, [isEditingTitle]);

  // Gestione selezione intellisense
  const handleIntellisenseSelect = (item: any) => {
    setTempTitle(item.name);
    setShowIntellisense(false);
    if (titleInputRef.current) titleInputRef.current.focus();
  };

  return (
    <div
      className="relative flex items-center text-white px-2 py-2 rounded-t-lg border-b"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)', // Arancione pastello
        borderBottom: '1px solid rgba(0,0,0,0.1)',
        width: '100%',
        userSelect: 'none',
        overflow: 'visible' // ✅ Permette alle icone di uscire dal bordo
      }}
    >
      {/* No transparent bridges: keep header clean for text events */}
      {/* Area hover estesa - area di puntamento robusta per icone */}
      {/* MODALE: NON chiude automaticamente, solo Enter/ESC */}
      {extendedRect && isEditingTitle && createPortal(
        <div
          style={{
            position: 'fixed',
            top: extendedRect.top,
            left: extendedRect.left,
            width: extendedRect.width,
            height: extendedRect.height,
            zIndex: 499, // Sotto le icone ma sopra il contenuto normale
            pointerEvents: 'auto',
            background: 'transparent',
            // Debug: mostra l'area (commentare in produzione)
            // border: '1px dashed rgba(0, 255, 0, 0.3)',
          }}
          onMouseEnter={() => {
            // Mantieni area attiva
          }}
          onMouseLeave={() => {
            // NON chiude: editing è modale, esce solo con Enter/ESC
          }}
        />,
        document.body
      )}

      {/* Titolo + editing */}
      <div className="flex items-center min-w-0 flex-1" style={{ position: 'relative' }}>
        {isEditingTitle ? (
          <div ref={headerContainerRef} className="flex items-center min-w-0 flex-1" style={{ position: 'relative' }}>
            {leftIcon && <span className="mr-1 flex-shrink-0">{leftIcon}</span>}
            <input
              ref={titleInputRef}
              type="text"
              value={tempTitle}
              onChange={(e) => setTempTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => {
                // Salva automaticamente se ho modificato, altrimenti annulla
                if (tempTitle.trim() !== title) {
                  handleTitleSave();
                } else {
                  handleTitleCancel();
                }
              }}
              autoFocus
              className="node-title-input flex-1 min-w-0 bg-white text-slate-900 px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-amber-500 border border-amber-400 nodrag"
              data-node-id={nodeId || ''}
              style={{ width: '100%', fontSize: fontSizes.nodeTitle }}
              onFocus={() => {
                if (titleInputRef.current) {
                  const rect = titleInputRef.current.getBoundingClientRect();
                  setIntellisensePosition({ x: rect.left, y: rect.bottom + 2 });
                  // setShowIntellisense(true); // Disabilitato su richiesta
                }
              }}
            />
            {/* Icone editing - position absolute, fuori dal bordo */}
            <div style={{
              position: 'absolute',
              right: -30, // Fuori dal bordo: compensa padding + spazio
              top: '50%',
              transform: 'translateY(-50%)',
              display: 'flex',
              gap: 4,
              zIndex: 1000,
              pointerEvents: 'auto'
            }}>
              {/* X rossa - appare SEMPRE durante l'editing */}
              {isEditingTitle && (
                <button
                  onClick={handleTitleCancel}
                  className="p-0 text-red-500 hover:text-red-400 nodrag hover:opacity-100 hover:scale-110"
                  title="Annulla (ESC)"
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 2,
                    cursor: 'pointer',
                    opacity: 0.9,
                    transition: 'opacity 120ms linear, transform 120ms ease',
                    width: 16,
                    height: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <X className="w-3 h-3" style={{ filter: 'drop-shadow(0 0 2px rgba(239, 68, 68, 0.6))' }} />
                </button>
              )}

              {/* Check verde - appare appena comincio a scrivere */}
              {isEditingTitle && tempTitle.trim().length > 0 && (
                <button
                  onClick={handleTitleSave}
                  className="p-0 text-green-500 hover:text-green-400 nodrag hover:opacity-100 hover:scale-110"
                  title="Conferma (Enter)"
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 2,
                    cursor: 'pointer',
                    opacity: 0.9,
                    transition: 'opacity 120ms linear, transform 120ms ease',
                    width: 16,
                    height: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Check className="w-3 h-3" style={{ filter: 'drop-shadow(0 0 2px rgba(34, 197, 94, 0.6))' }} />
                </button>
              )}
            </div>
            {/* IntellisenseMenu come portale */}
            {showIntellisense &&
              createPortal(
                <div style={{
                  position: 'absolute',
                  left: intellisensePosition.x,
                  top: intellisensePosition.y,
                  zIndex: 9999,
                }}>
                  {console.log("🎯 [NodeHeader] TITLE INTELLISENSE OPENED", {
                    nodeId: nodeId,
                    title: title,
                    timestamp: Date.now()
                  })}
                  <IntellisenseMenu
                    isOpen={showIntellisense}
                    query={tempTitle}
                    position={{ x: 0, y: 0 }}
                    referenceElement={null}
                    onSelect={handleIntellisenseSelect}
                    onClose={() => {
                      console.log("🎯 [NodeHeader] TITLE INTELLISENSE CLOSED", { nodeId: nodeId });
                      setShowIntellisense(false);
                    }}
                    filterCategoryTypes={['macrotasks']}
                  />
                </div>,
                document.body
              )
            }
          </div>
        ) : (
          <h3
            className="text-white font-semibold cursor-text hover:text-amber-100 transition-colors truncate flex-1"
            style={{ fontSize: fontSizes.nodeTitle, display: 'inline-block' }}
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