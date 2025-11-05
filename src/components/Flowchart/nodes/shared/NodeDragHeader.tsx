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

  // Log quando isToolbarDrag cambia - RIMOSSO per ridurre rumore console

        // Calcola dimensione icone dinamicamente basata sul font size del nodo (stessa logica delle icone di riga)
        // DEVE usare lo stesso elemento di riferimento delle icone di riga (span.nodrag della prima riga)
        const [iconSize, setIconSize] = useState(16);
        useEffect(() => {
          const updateSize = () => {
            // Cerca lo stesso elemento che usano le icone di riga: span.nodrag della prima riga
            // STESSA LOGICA DI NodeRowActionsOverlay: usa labelRef.current che è lo span.nodrag
            let targetElement: HTMLElement | null = null;
            if (nodeRef?.current) {
              // Priorità 1: Cerca span.nodrag nella prima riga (stesso selettore usato da NodeRowActionsOverlay)
              const firstRow = nodeRef.current.querySelector('.node-row') as HTMLElement;
              if (firstRow) {
                const nodragSpan = firstRow.querySelector('span.nodrag') as HTMLElement;
                if (nodragSpan) {
                  targetElement = nodragSpan;
                } else {
                  // Fallback: qualsiasi span nella prima riga
                  const rowSpan = firstRow.querySelector('span') as HTMLElement;
                  if (rowSpan) {
                    targetElement = rowSpan;
                  }
                }
              }

              // Priorità 2: Se non trovato, cerca qualsiasi span.nodrag nel nodo
              if (!targetElement) {
                const nodragSpan = nodeRef.current.querySelector('span.nodrag') as HTMLElement;
                if (nodragSpan) {
                  targetElement = nodragSpan;
                }
              }

              // Priorità 3: Cerca qualsiasi span con cursor: grab (stile delle righe)
              if (!targetElement) {
                const grabSpan = nodeRef.current.querySelector('span[style*="cursor: grab"]') as HTMLElement;
                if (grabSpan) {
                  targetElement = grabSpan;
                }
              }

              // Fallback: qualsiasi span nel nodo
              if (!targetElement) {
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
              // Icone devono essere 119% del font size (STESSA LOGICA ESATTA delle icone di riga)
              const newSize = Math.max(16, Math.min(32, Math.round(fontSize * 1.19)));
              setIconSize(newSize);
            } else {
              setIconSize(16);
            }
          };

          // Esegui subito e poi ogni volta che cambia
          // Usa requestAnimationFrame per aspettare che il DOM sia renderizzato
          requestAnimationFrame(() => {
            updateSize();
          });

          const observer = new MutationObserver(() => {
            requestAnimationFrame(updateSize);
          });
          if (nodeRef?.current) {
            observer.observe(nodeRef.current, {
              attributes: true,
              attributeFilter: ['style', 'class'],
              subtree: true,
              childList: true // Aggiunto per catturare aggiunta/rimozione righe
            });
            const resizeHandler = () => requestAnimationFrame(updateSize);
            window.addEventListener('resize', resizeHandler);
            return () => {
              observer.disconnect();
              window.removeEventListener('resize', resizeHandler);
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
                    try {
                      (window as any).__flowDragMode = 'rigid';
                    } catch (e) {
                      // Silent fail
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

