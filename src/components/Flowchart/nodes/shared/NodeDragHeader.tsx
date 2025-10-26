import React, { useEffect, useRef } from 'react';
import { Move, Edit3, Trash2, Anchor, Eye, EyeOff } from 'lucide-react';

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
}

/**
 * Header temporaneo semi-trasparente che appare al hover su nodi senza titolo.
 * Serve come area drag per spostare il nodo intero.
 * NON ha classe 'nodrag' quindi è draggable.
 */
export const NodeDragHeader: React.FC<NodeDragHeaderProps> = ({ onEditTitle, onDelete, compact, showDragHandle = true, fullWidth = false, isToolbarDrag = false, onDragStart, showUnchecked = true, onToggleUnchecked, hasUncheckedRows = false }) => {
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
      title={isToolbar ? undefined : "Drag to move node"}
    >
      {/* LEFT: Drag buttons */}
      <div
        className="flex items-center gap-1.5"
        style={{
          flexShrink: 0 // Impedisce che si restringa
        }}
      >
        {/* Move icon (4 frecce) - DRAG AREA (not a button) */}
        <div
          style={{
            cursor: 'move',
            display: 'flex',
            alignItems: 'center',
            opacity: 0.85,
            transition: 'opacity 120ms linear, transform 120ms ease'
          }}
          className="hover:opacity-100 hover:scale-110"
          title="Drag to move node"
          onPointerDownCapture={() => {
            console.log('🎯 [NodeDragHeader] MOVE ICON - Pointer DOWN (capture) - isDragging=true');
            onDragStart?.();
          }}
        >
          <Move className="w-3 h-3 text-amber-300 drop-shadow" />
        </div>

        {/* Anchor icon - RIGID DRAG AREA (not a button) */}
        <div
          title="Drag to move with descendants"
          className="hover:opacity-100 hover:scale-110"
          style={{
            cursor: 'move',
            opacity: isToolbarDrag ? 0 : 0.85,
            transition: 'opacity 120ms linear, transform 120ms ease',
            display: 'flex',
            alignItems: 'center'
          }}
          onPointerDownCapture={() => {
            console.log('🎯 [NodeDragHeader] ANCHOR ICON - Pointer DOWN (capture) - rigid=true, isDragging=true');
            try { (window as any).__flowDragMode = 'rigid'; } catch { }
            onDragStart?.();
          }}
        >
          <Anchor className="w-3 h-3 text-slate-200 hover:text-amber-300 drop-shadow" />
        </div>
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
          <button
            className="p-0 hover:opacity-100 transition transform hover:scale-110 nodrag"
            title={showUnchecked ? "Hide unchecked rows" : "Show unchecked rows"}
            style={{ background: 'none', border: 'none', opacity: 0.85, transition: 'opacity 120ms linear' }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleUnchecked();
            }}
          >
            {showUnchecked ? (
              <Eye className="w-3 h-3 text-slate-200 hover:text-blue-400 drop-shadow hover:drop-shadow-lg transition-colors" />
            ) : (
              <EyeOff className="w-3 h-3 text-slate-200 hover:text-blue-400 drop-shadow hover:drop-shadow-lg transition-colors" />
            )}
          </button>
        )}

        {/* DEBUG: Log rimosso per ridurre rumore */}

        <button
          className="p-0 hover:opacity-100 transition transform hover:scale-110 nodrag"
          title="Edit title"
          style={{ background: 'none', border: 'none', opacity: 0.85, transition: 'opacity 120ms linear' }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onEditTitle();
          }}
        >
          <Edit3 className="w-3 h-3 text-slate-200 hover:text-amber-300 drop-shadow hover:drop-shadow-lg transition-colors" />
        </button>

        <button
          className="p-0 hover:opacity-100 transition transform hover:scale-110 nodrag"
          title="Delete node"
          style={{ background: 'none', border: 'none', opacity: 0.85, transition: 'opacity 120ms linear' }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="w-3 h-3 text-slate-200 hover:text-red-400 drop-shadow hover:drop-shadow-lg transition-colors" />
        </button>
      </div>
    </div>
  );
};

