import React from 'react';
import { Move, Edit3, Trash2, Anchor } from 'lucide-react';

interface NodeDragHeaderProps {
  onEditTitle: () => void;
  onDelete: () => void;
  compact?: boolean;
  showDragHandle?: boolean; // Se true, mostra icona grip e testo "Drag"
  fullWidth?: boolean; // Se true, toolbar larga quanto il nodo
}

/**
 * Header temporaneo semi-trasparente che appare al hover su nodi senza titolo.
 * Serve come area drag per spostare il nodo intero.
 * NON ha classe 'nodrag' quindi è draggable.
 */
export const NodeDragHeader: React.FC<NodeDragHeaderProps> = ({ onEditTitle, onDelete, compact, showDragHandle = true, fullWidth = false }) => {
  // Quando compact=true, è usato come toolbar sopra il nodo (no border radius, più piccolo)
  const isToolbar = compact === true;
  // showDragHandle controlla se mostrare l'area drag (grip + testo)

  return (
    <div
      className="flex items-center justify-between px-2"
      style={{
        background: isToolbar ? (fullWidth ? 'rgba(0, 191, 255, 0.3)' : 'transparent') : 'rgba(17, 24, 39, 0.85)', // Azzurrino per debug quando fullWidth
        backdropFilter: isToolbar ? 'none' : 'blur(4px)',
        WebkitBackdropFilter: isToolbar ? 'none' : 'blur(4px)',
        borderBottom: isToolbar ? 'none' : '1px solid rgba(251, 191, 36, 0.3)',
        borderTopLeftRadius: isToolbar ? 0 : '0.5rem',
        borderTopRightRadius: isToolbar ? 0 : '0.5rem',
        cursor: isToolbar ? 'default' : 'grab',
        userSelect: 'none',
        height: isToolbar ? 'auto' : '28px',
        width: fullWidth ? '100%' : (isToolbar ? 'auto' : '100%'), // Larga quanto il nodo se fullWidth
        minWidth: fullWidth ? '100%' : 'auto', // Forza larghezza minima
        padding: isToolbar ? '4px 8px' : '6px 8px',
      }}
      title={isToolbar ? undefined : "Drag to move node"}
    >
      {/* LEFT: Area vuota per hover quando fullWidth, altrimenti drag areas */}
      {fullWidth ? (
        <div className="flex items-center gap-1.5" style={{ flex: 1 }}>
          {/* Move icon (4 frecce) - DRAG AREA (not a button) */}
          <div
            style={{
              cursor: 'grab',
              display: 'flex',
              alignItems: 'center',
              opacity: 0.85,
              transition: 'opacity 120ms linear, transform 120ms ease'
            }}
            className="hover:opacity-100 hover:scale-110"
            title="Drag to move node"
            onMouseDown={(e) => {
              console.log('[NodeDragHeader] MOVE ICON - Mouse DOWN - DRAG START', {
                button: e.button,
                type: e.type,
                target: (e.target as HTMLElement)?.tagName,
                currentTarget: e.currentTarget.tagName
              });
            }}
          >
            <Move className="w-3 h-3 text-amber-300 drop-shadow" />
          </div>

          {/* Anchor icon - RIGID DRAG AREA (not a button) */}
          <div
            title="Drag to move with descendants"
            className="hover:opacity-100 hover:scale-110 nodrag"
            style={{
              cursor: 'grab',
              opacity: 0.85,
              transition: 'opacity 120ms linear, transform 120ms ease',
              display: 'flex',
              alignItems: 'center'
            }}
            onMouseDown={(e) => {
              console.log('[NodeDragHeader] ANCHOR ICON - Mouse DOWN - RIGID DRAG START', {
                button: e.button,
                type: e.type,
                target: (e.target as HTMLElement)?.tagName
              });
              try {
                (window as any).__flowDragMode = 'rigid';
              } catch { }
            }}
            onMouseUp={() => {
              console.log('[NodeDragHeader] ANCHOR ICON - Mouse UP - RIGID DRAG END');
              try {
                (window as any).__flowDragMode = undefined;
              } catch { }
            }}
          >
            <Anchor className="w-3 h-3 text-slate-200 hover:text-amber-300 drop-shadow" />
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-1.5" style={{ opacity: showDragHandle ? 0.9 : 0 }}>
          {showDragHandle && (
            <>
              {/* Move icon (4 frecce) - DRAG AREA (not a button) */}
              <div
                style={{
                  cursor: 'grab',
                  display: 'flex',
                  alignItems: 'center',
                  opacity: 0.85,
                  transition: 'opacity 120ms linear, transform 120ms ease'
                }}
                className="hover:opacity-100 hover:scale-110"
                title="Drag to move node"
                onMouseDown={(e) => {
                  console.log('[NodeDragHeader] MOVE ICON - Mouse DOWN - DRAG START', {
                    button: e.button,
                    type: e.type,
                    target: (e.target as HTMLElement)?.tagName,
                    currentTarget: e.currentTarget.tagName
                  });
                }}
              >
                <Move className="w-3 h-3 text-amber-300 drop-shadow" />
              </div>

              {/* Anchor icon - RIGID DRAG AREA (not a button) */}
              <div
                title="Drag to move with descendants"
                className="hover:opacity-100 hover:scale-110 nodrag"
                style={{
                  cursor: 'grab',
                  opacity: 0.85,
                  transition: 'opacity 120ms linear, transform 120ms ease',
                  display: 'flex',
                  alignItems: 'center'
                }}
                onMouseDown={(e) => {
                  console.log('[NodeDragHeader] ANCHOR ICON - Mouse DOWN - RIGID DRAG START', {
                    button: e.button,
                    type: e.type,
                    target: (e.target as HTMLElement)?.tagName
                  });
                  try {
                    (window as any).__flowDragMode = 'rigid';
                  } catch { }
                }}
                onMouseUp={() => {
                  console.log('[NodeDragHeader] ANCHOR ICON - Mouse UP - RIGID DRAG END');
                  try {
                    (window as any).__flowDragMode = undefined;
                  } catch { }
                }}
              >
                <Anchor className="w-3 h-3 text-slate-200 hover:text-amber-300 drop-shadow" />
              </div>
            </>
          )}
        </div>
      )}

      {/* RIGHT: ACTION BUTTONS - Always visible */}
      <div className="flex items-center gap-1.5">
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

