/**
 * Floating menu: pick a BackendCall row label to insert as a 🗄️ placeholder at the textarea caret / selection.
 */

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const SURFACE: React.CSSProperties = {
  minWidth: '14rem',
  maxHeight: 340,
  overflowY: 'auto',
  background: '#0b1220',
  color: '#e2e8f0',
  border: '1px solid #475569',
  borderRadius: 6,
  boxShadow: '0 8px 28px rgba(0,0,0,0.45)',
  padding: '4px 0',
  zIndex: 100000,
};

const itemBase: React.CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '7px 12px',
  fontSize: 13,
  border: 'none',
  borderRadius: 2,
  outline: 'none',
  color: '#cbd5e1',
  background: 'transparent',
  cursor: 'pointer',
  userSelect: 'none',
};

export type BackendPathInsertContextMenuProps = {
  isOpen: boolean;
  x: number;
  y: number;
  paths: readonly string[];
  onSelect: (path: string) => void;
  onClose: () => void;
};

export function BackendPathInsertContextMenu({
  isOpen,
  x,
  y,
  paths,
  onSelect,
  onClose,
}: BackendPathInsertContextMenuProps): React.ReactPortal | null {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onMouseDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onMouseDown, false);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onMouseDown, false);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const LEFT = Math.min(x, typeof window !== 'undefined' ? window.innerWidth - 260 : x);
  const TOP = Math.min(y, typeof window !== 'undefined' ? window.innerHeight - 48 : y);

  return createPortal(
    <div
      ref={panelRef}
      role="menu"
      aria-label="Inserisci percorso backend"
      style={{
        ...SURFACE,
        position: 'fixed',
        left: LEFT,
        top: TOP,
      }}
    >
      <div style={{ padding: '8px 12px 4px', fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.06em' }}>
        Backend nel flow attivo
      </div>
      {paths.length === 0 ? (
        <div style={{ padding: '8px 12px', fontSize: 12, color: '#94a3b8' }}>
          Nessun BackendCall etichettato nel canvas attivo.
        </div>
      ) : (
        paths.map((p) => (
          <button
            key={p}
            type="button"
            role="menuitem"
            style={itemBase}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onSelect(p);
            }}
          >
            🗄️ {p}
          </button>
        ))
      )}
    </div>,
    document.body
  );
}
