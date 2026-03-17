// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, Plus } from 'lucide-react';
import { useNodeEditing } from '../features/node-editing/useNodeEditing';

interface WordsEditorProps {
  /** ID of the grammar node whose synonyms are being edited. */
  nodeId: string;
  /** Current list of synonyms for the node. */
  synonyms: string[];
  /** Callback to close the editor. */
  onClose: () => void;
}

/**
 * Floating editor for managing node synonyms (words).
 *
 * Rendered via ReactDOM.createPortal directly into document.body so that
 * `position: fixed` coordinates resolve against the true viewport rather than
 * ReactFlow's CSS-transformed container (where fixed behaves like absolute).
 *
 * Position is computed from the actual DOM bounding rect of the node element
 * identified by `[data-node-id]`, so it stays anchored correctly even when
 * the canvas is zoomed or panned.
 */
export function WordsEditor({ nodeId, synonyms, onClose }: WordsEditorProps) {
  const { addNodeSynonym, removeNodeSynonym } = useNodeEditing();
  const [newWord, setNewWord] = useState('');
  const [coords, setCoords] = useState<{ x: number; y: number; placeAbove: boolean } | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // --- Position calculation ---
  useEffect(() => {
    const ESTIMATED_H = 280;

    const compute = () => {
      // Primary: the inner wrapper that carries data-node-id
      const el =
        (document.querySelector(`[data-node-id="${nodeId}"]`) as HTMLElement | null) ??
        (document.querySelector(`[data-id="${nodeId}"]`) as HTMLElement | null);

      if (!el) return;

      const rect = el.getBoundingClientRect();
      const placeAbove =
        window.innerHeight - rect.bottom < ESTIMATED_H && rect.top >= ESTIMATED_H;

      setCoords({
        x: rect.left + rect.width / 2,
        y: placeAbove ? rect.top : rect.bottom,
        placeAbove,
      });
    };

    compute();

    // Re-compute when ReactFlow's transformation pane changes (zoom / pan)
    const pane = document.querySelector('.react-flow__transformationpane') as HTMLElement | null;
    let mo: MutationObserver | null = null;
    if (pane) {
      mo = new MutationObserver(compute);
      mo.observe(pane, { attributes: true, attributeFilter: ['style'] });
    }

    window.addEventListener('resize', compute);

    return () => {
      mo?.disconnect();
      window.removeEventListener('resize', compute);
    };
  }, [nodeId]);

  // --- Focus input on mount ---
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // --- Close on ESC ---
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // --- Close on outside click ---
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (editorRef.current && !editorRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // --- Word management ---
  const handleAddWord = () => {
    const trimmed = newWord.trim();
    if (!trimmed) return;
    const isDuplicate = synonyms.some(s => s.toLowerCase() === trimmed.toLowerCase());
    if (isDuplicate) {
      setNewWord('');
      return;
    }
    addNodeSynonym(nodeId, trimmed);
    setNewWord('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddWord();
    }
  };

  // Wait until position is known before rendering
  if (!coords) return null;

  const panelStyle: React.CSSProperties = {
    position: 'fixed',
    left: `${coords.x}px`,
    ...(coords.placeAbove
      ? { bottom: `${window.innerHeight - coords.y + 8}px` }
      : { top: `${coords.y + 8}px` }),
    transform: 'translateX(-50%)',
    zIndex: 99999,
    minWidth: '250px',
    maxWidth: '400px',
    backgroundColor: '#1a1f2e',
    border: '1px solid #4a5568',
    borderRadius: '6px',
    padding: '8px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
  };

  const panel = (
    <div
      ref={editorRef}
      style={panelStyle}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div style={headerStyle}>
        <span style={titleStyle}>Edit Words</span>
        <button style={iconBtnStyle} onClick={onClose} title="Close (ESC)">
          <X size={14} />
        </button>
      </div>

      {/* Input row — first interactive element */}
      <div style={addRowStyle}>
        <input
          ref={inputRef}
          type="text"
          value={newWord}
          onChange={(e) => setNewWord(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add new word..."
          style={inputStyle}
        />
        <button
          style={iconBtnStyle}
          onClick={handleAddWord}
          disabled={!newWord.trim()}
          title="Add word (Enter)"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Synonyms list */}
      <div style={listStyle}>
        {synonyms.length === 0 ? (
          <div style={emptyStyle}>No words added yet</div>
        ) : (
          synonyms.map((syn, i) => (
            <div key={i} style={wordRowStyle}>
              <span style={wordTextStyle}>{syn}</span>
              <button
                style={iconBtnStyle}
                onClick={() => removeNodeSynonym(nodeId, syn)}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#dc2626'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#6b7280'; }}
                title="Remove word"
              >
                <X size={12} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );

  // Portal to document.body escapes ReactFlow's CSS transform context,
  // making position: fixed resolve against the true viewport.
  return ReactDOM.createPortal(panel, document.body);
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '8px',
  paddingBottom: '6px',
  borderBottom: '1px solid #4a5568',
};

const titleStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: '600',
  color: '#c9d1d9',
  fontFamily: 'sans-serif',
};

const addRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '4px',
  alignItems: 'center',
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: '4px 8px',
  fontSize: '12px',
  color: '#c9d1d9',
  backgroundColor: '#2d3448',
  border: '1px solid #4a5568',
  borderRadius: '4px',
  outline: 'none',
  fontFamily: 'sans-serif',
};

const listStyle: React.CSSProperties = {
  maxHeight: '200px',
  overflowY: 'auto',
  marginTop: '8px',
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
};

const emptyStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#6b7280',
  fontStyle: 'italic',
  textAlign: 'center',
  padding: '8px',
};

const wordRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '4px 6px',
  backgroundColor: '#2d3448',
  borderRadius: '4px',
  gap: '6px',
};

const wordTextStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#c9d1d9',
  fontFamily: 'sans-serif',
  flex: 1,
};

const iconBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  padding: '2px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#6b7280',
  borderRadius: '3px',
  flexShrink: 0,
};
