import React, { useEffect, useRef, useState } from 'react';
import { Move, Edit3, Trash2, Anchor, Eye, EyeOff } from 'lucide-react';
import SmartTooltip from '../../../SmartTooltip';

interface NodeDragHeaderProps {
  onEditTitle: () => void;
  onDelete: () => void;
  compact?: boolean;
  showDragHandle?: boolean; // Se true, mostra icona grip e testo "Drag"
  fullWidth?: boolean; // Se true, toolbar larga quanto il nodo
  isToolbarDrag?: boolean; // Se true, nasconde Anchor e destra
  onDragStart?: () => void; // Callback per attivare isDragging
  // Eye icon props
  showUnchecked?: boolean; // Se true, mostra righe unchecked
  onToggleUnchecked?: () => void; // Callback per toggle visibilità righe unchecked
  hasUncheckedRows?: boolean; // Se true, ci sono righe unchecked nel nodo
  nodeRef?: React.RefObject<HTMLElement>; // Ref del nodo per calcolare il font size
}

/**
 * Header temporaneo semi-trasparente che appare al hover su nodi senza titolo.
 * Serve come area drag per spostare il nodo intero.
 * NON ha classe 'nodrag' quindi è draggable.
 */
export const NodeDragHeader: React.FC<NodeDragHeaderProps> = ({ onEditTitle, onDelete, compact, showDragHandle = true, fullWidth = false, isToolbarDrag = false, onDragStart, showUnchecked = true, onToggleUnchecked, hasUncheckedRows = false, nodeRef }) => {
  // Quando compact=true, è usato come toolbar sopra il nodo (no border radius, più piccolo)
  const isToolbar = compact === true;
  // showDragHandle controlla se mostrare l'area drag (grip + testo)

  // Log solo quando isToolbarDrag cambia
  const prevIsToolbarDrag = useRef(isToolbarDrag);
  useEffect(() => {
    if (prevIsToolbarDrag.current !== isToolbarDrag) {
      console.log('🎯 [NodeDragHeader] isToolbarDrag changed:', prevIsToolbarDrag.current, '→', isToolbarDrag);
      prevIsToolbarDrag.current = isToolbarDrag;
    }
  }, [isToolbarDrag]);

  // Calcola dimensione icone dinamicamente basata sul font size del nodo (stessa logica delle icone di riga)
  const [iconSize, setIconSize] = useState(16);
  useEffect(() => {
    const updateSize = () => {
      // Cerca un elemento con testo nel nodo per ottenere il font size
      let targetElement: HTMLElement | null = null;
      if (nodeRef?.current) {
        // Cerca la prima riga di testo nel nodo (span con classe nodrag o dentro .node-row)
        const rowLabel = nodeRef.current.querySelector('span.nodrag, .node-row span, span[style*="cursor: grab"]') as HTMLElement;
        if (rowLabel) {
          targetElement = rowLabel;
        } else {
          // Fallback: cerca qualsiasi span con testo nel nodo
          const anySpan = nodeRef.current.querySelector('span') as HTMLElement;
          if (anySpan) {
            targetElement = anySpan;
          } else {
            // Ultimo fallback: usa il nodo stesso
            targetElement = nodeRef.current;
          }
        }
      }

      if (targetElement) {
        const computedStyle = window.getComputedStyle(targetElement);
        const fontSize = parseFloat(computedStyle.fontSize) || 12;
        // Icone devono essere 119% del font size (stessa logica delle icone di riga)
        const newSize = Math.max(16, Math.min(32, Math.round(fontSize * 1.19)));
        setIconSize(newSize);
      } else {
        setIconSize(16);
      }
    };

    updateSize();

    const observer = new MutationObserver(updateSize);
    if (nodeRef?.current) {
      observer.observe(nodeRef.current, {
        attributes: true,
        attributeFilter: ['style', 'class'],
        subtree: true
      });
      window.addEventListener('resize', updateSize);
      return () => {
        observer.disconnect();
        window.removeEventListener('resize', updateSize);
      };
    }
  }, [nodeRef]);



  // DEBUG: Log per verificare la struttura (rimosso per ridurre rumore)

  return (
    <div
      className="flex items-center justify-between px-2"
      style={{
        background: isToolbar ? 'transparent' : 'rgba(17, 24, 39, 0.85)',
        backdropFilter: isToolbar ? 'none' : 'blur(4px)',
        WebkitBackdropFilter: isToolbar ? 'none' : 'blur(4px)',
        borderBottom: isToolbar ? 'none' : '1px solid rgba(251, 191, 36, 0.3)',
        borderTopLeftRadius: isToolbar ? 0 : '0.5rem',
        borderTopRightRadius: isToolbar ? 0 : '0.5rem',
        cursor: isToolbar ? 'default' : 'grab',
        userSelect: 'none',
        height: isToolbar ? 'auto' : '28px',
        width: '100%', // Sempre larga quanto il nodo
        minWidth: '100%', // Forza larghezza minima
        padding: isToolbar ? '4px 8px' : '6px 8px',
        // DEBUG: Bordo rimosso - problema risolto
        boxSizing: 'border-box'
      }}
    >
      {/* LEFT: Drag buttons */}
      <div
        className="flex items-center gap-1.5"
        style={{
          flexShrink: 0 // Impedisce che si restringa
        }}
      >
        {/* Move icon (4 frecce) - DRAG AREA (not a button) */}
        <SmartTooltip text="Drag to move node" tutorId="drag_node_help" placement="bottom">
          <div
            style={{
              cursor: 'move',
              display: 'flex',
              alignItems: 'center',
              opacity: 0.85,
              transition: 'opacity 120ms linear, transform 120ms ease'
            }}
            className="hover:opacity-100 hover:scale-110 nodrag"
            onMouseDown={(e) => {
              // ✅ Previeni comportamento di default e avvia drag personalizzato
              e.preventDefault();
              e.stopPropagation();
              console.log('🚀 [DRAG DEBUG] MOVE ICON - Starting custom node drag');
              onDragStart?.();
            }}
          >
            <Move style={{ width: iconSize, height: iconSize }} className="text-amber-300 drop-shadow" />
          </div>
        </SmartTooltip>

        {/* Anchor icon - RIGID DRAG AREA (not a button) */}
        <SmartTooltip text="Drag to move with descendants" tutorId="drag_descendants_help" placement="bottom">
          <div
            className="rigid-anchor hover:opacity-100 hover:scale-110"
            style={{
              cursor: 'move',
              opacity: isToolbarDrag ? 0 : 0.85,
              transition: 'opacity 120ms linear, transform 120ms ease',
              display: 'flex',
              alignItems: 'center'
            }}
            onPointerDownCapture={() => {
              console.log('🚀 [DRAG DEBUG] ANCHOR ICON - Setting rigid mode');
              try {
                (window as any).__flowDragMode = 'rigid';
                console.log('🚀 [DRAG DEBUG] __flowDragMode set to:', (window as any).__flowDragMode);
              } catch (e) {
                console.error('🚀 [DRAG DEBUG] Error setting __flowDragMode:', e);
              }
              onDragStart?.();
            }}
          >
            <Anchor style={{ width: iconSize, height: iconSize }} className="text-slate-200 hover:text-amber-300 drop-shadow" />
          </div>
        </SmartTooltip>
      </div>

      {/* SPACER: Spazio fisso tra i due gruppi */}
      <div style={{ flex: 1, minWidth: '20px' }} />

      {/* RIGHT: Action buttons - Invisibili durante toolbar drag */}
      <div
        className="flex items-center gap-1.5"
        style={{
          opacity: isToolbarDrag ? 0 : 1,
          transition: 'opacity 200ms ease',
          flexShrink: 0 // Impedisce che si restringa
        }}
      >
        {/* Eye icon - Toggle visibility of unchecked rows - Only show if there are unchecked rows */}
        {onToggleUnchecked && hasUncheckedRows && (
          <SmartTooltip text={showUnchecked ? "Hide unchecked rows" : "Show unchecked rows"} tutorId="toggle_unchecked_help" placement="bottom">
            <button
              className="p-0 hover:opacity-100 transition transform hover:scale-110 nodrag"
              style={{ background: 'none', border: 'none', opacity: 0.85, transition: 'opacity 120ms linear' }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleUnchecked();
              }}
            >
              {showUnchecked ? (
                <Eye style={{ width: iconSize, height: iconSize }} className="text-slate-200 hover:text-blue-400 drop-shadow hover:drop-shadow-lg transition-colors" />
              ) : (
                <EyeOff style={{ width: iconSize, height: iconSize }} className="text-slate-200 hover:text-blue-400 drop-shadow hover:drop-shadow-lg transition-colors" />
              )}
            </button>
          </SmartTooltip>
        )}

        {/* DEBUG: Log rimosso per ridurre rumore */}

        <SmartTooltip text="Edit title" tutorId="edit_title_help" placement="bottom">
          <button
            className="p-0 hover:opacity-100 transition transform hover:scale-110 nodrag"
            style={{ background: 'none', border: 'none', opacity: 0.85, transition: 'opacity 120ms linear' }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onEditTitle();
            }}
          >
            <Edit3 style={{ width: iconSize, height: iconSize }} className="text-slate-200 hover:text-amber-300 drop-shadow hover:drop-shadow-lg transition-colors" />
          </button>
        </SmartTooltip>

        <SmartTooltip text="Delete node" tutorId="delete_node_help" placement="bottom">
          <button
            className="p-0 hover:opacity-100 transition transform hover:scale-110 nodrag"
            style={{ background: 'none', border: 'none', opacity: 0.85, transition: 'opacity 120ms linear' }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 style={{ width: iconSize, height: iconSize }} className="text-slate-200 hover:text-red-400 drop-shadow hover:drop-shadow-lg transition-colors" />
          </button>
        </SmartTooltip>
      </div>
    </div>
  );
};

