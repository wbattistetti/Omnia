// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React, { useEffect } from 'react';
import { useGrammarStore, useGrammarStoreApi } from './core/state/grammarStoreContext';
import { isGrammarEditorDebugEnabled, storeLooksAheadOfInitialProp } from './grammarEditorLoadPolicy';
import { grammarStructuralFingerprint } from './grammarStructureFingerprint';
import { GrammarCanvas } from './components/GrammarCanvas';
import { SemanticPanel } from './components/SemanticPanel';
import { GrammarToolbar } from './components/GrammarToolbar';
import { TestPhrases } from './components/TestPhrases';
import type { Grammar } from './types/grammarTypes';
import type { SemanticSlot, SemanticSet } from './types/grammarTypes';

export interface GrammarEditorProps {
  initialGrammar?: Grammar;
  onSave?: (grammar: Grammar) => void;
  onClose?: () => void;
  slots?: SemanticSlot[];
  semanticSets?: SemanticSet[];
  hideToolbar?: boolean;
  editorMode?: 'text' | 'graph';
  initialTestPhrases?: string[];
  onTestPhrasesChange?: (phrases: string[]) => void;
}

/**
 * Main entry point for the Grammar Editor.
 * Composes toolbar, canvas, and semantic panel.
 *
 * Sync rule: `initialGrammar` from the parent contract is the source of truth. On each change of
 * structural fingerprint, reset this instance's store and load the prop (deterministic reopen).
 * If the in-memory store is strictly ahead of the prop (user edits not yet reflected upstream),
 * skip applying the prop so local work is not wiped.
 */
export function GrammarEditor({
  initialGrammar,
  onSave,
  onClose,
  slots = [],
  semanticSets = [],
  hideToolbar = false,
  editorMode = 'text',
  initialTestPhrases = [],
  onTestPhrasesChange,
}: GrammarEditorProps) {
  const { loadGrammar, createGrammar, grammar: currentGrammar, reset } = useGrammarStore();
  const storeApi = useGrammarStoreApi();

  // ✅ State for SemanticPanel width
  const [semanticPanelWidth, setSemanticPanelWidth] = React.useState(300);
  const [isResizingSemanticPanel, setIsResizingSemanticPanel] = React.useState(false);
  const semanticResizeStartRef = React.useRef<{ x: number; width: number } | null>(null);

  // ✅ Load saved width from localStorage
  React.useEffect(() => {
    const savedWidth = localStorage.getItem('grammar-semantic-panel-width');
    if (savedWidth) {
      const width = parseInt(savedWidth, 10);
      if (width >= 200 && width <= 600) {
        setSemanticPanelWidth(width);
      }
    }
  }, []);

  // ✅ Handle SemanticPanel splitter mouse down
  const handleSemanticPanelSplitterMouseDown = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('[GrammarEditor] 🎯 SemanticPanel splitter mouse down', { clientX: e.clientX, semanticPanelWidth });
    setIsResizingSemanticPanel(true);
    semanticResizeStartRef.current = {
      x: e.clientX,
      width: semanticPanelWidth,
    };
  }, [semanticPanelWidth]);

  // ✅ Handle SemanticPanel resize
  React.useEffect(() => {
    if (!isResizingSemanticPanel) {
      // Remove no-pan class when not resizing
      document.body.classList.remove('grammar-editor-resizing');
      return;
    }

    // ✅ Add class to disable ReactFlow pan during resize
    document.body.classList.add('grammar-editor-resizing');

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation(); // ✅ Stop propagation to prevent ReactFlow from intercepting
      if (!semanticResizeStartRef.current) return;

      const delta = semanticResizeStartRef.current.x - e.clientX; // Inverted: dragging left increases width
      const newWidth = Math.max(200, Math.min(600, semanticResizeStartRef.current.width + delta));

      console.log('[GrammarEditor] 🔄 SemanticPanel resizing', {
        delta,
        oldWidth: semanticResizeStartRef.current.width,
        newWidth,
        clientX: e.clientX,
        startX: semanticResizeStartRef.current.x
      });

      setSemanticPanelWidth(newWidth);
      localStorage.setItem('grammar-semantic-panel-width', newWidth.toString());
    };

    const handleMouseUp = () => {
      setIsResizingSemanticPanel(false);
      semanticResizeStartRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.body.classList.remove('grammar-editor-resizing');
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    // ✅ Use capture phase to intercept events before ReactFlow
    document.addEventListener('mousemove', handleMouseMove, { passive: false, capture: true });
    document.addEventListener('mouseup', handleMouseUp, { capture: true });

    return () => {
      document.removeEventListener('mousemove', handleMouseMove, { capture: true });
      document.removeEventListener('mouseup', handleMouseUp, { capture: true });
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.body.classList.remove('grammar-editor-resizing');
    };
  }, [isResizingSemanticPanel]);

  const dbg = isGrammarEditorDebugEnabled();

  /** Content fingerprint of the prop — single dependency for syncing from parent contract. */
  const fpFromProp = initialGrammar ? grammarStructuralFingerprint(initialGrammar) : '';

  useEffect(() => {
    if (!initialGrammar) {
      if (!storeApi.getState().grammar) {
        createGrammar('New Grammar');
      }
      return;
    }

    const stored = storeApi.getState().grammar;
    if (stored && storeLooksAheadOfInitialProp(initialGrammar, stored)) {
      if (dbg) {
        console.log('[GrammarEditor] skip sync (store ahead of prop — parent not updated yet)', {
          grammarId: initialGrammar.id,
        });
      }
      return;
    }
    if (stored && grammarStructuralFingerprint(initialGrammar) === grammarStructuralFingerprint(stored)) {
      return;
    }

    if (dbg) {
      console.log('[GrammarEditor] sync from prop (reset + loadGrammar)', { grammarId: initialGrammar.id });
    }
    reset();
    loadGrammar(initialGrammar);
  }, [fpFromProp, initialGrammar, loadGrammar, createGrammar, reset, dbg, storeApi]);

  React.useEffect(() => {
    if (!dbg) return;
    console.log('[GrammarEditor] grammar ids', {
      initialGrammarId: initialGrammar?.id,
      currentGrammarId: currentGrammar?.id,
    });
  }, [dbg, initialGrammar?.id, currentGrammar?.id]);

  const containerBackground = editorMode === 'graph' ? '#121621' : 'transparent';
  const canvasBackground = editorMode === 'graph' ? '#1a1f2e' : '#ffffff';

  return (
    <div
      className="grammar-editor"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        backgroundColor: containerBackground,
        position: 'relative',
        minHeight: 0,
        minWidth: 0,
      }}
    >
      {!hideToolbar && <GrammarToolbar onSave={onSave} onClose={onClose} />}
      <div
        style={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden',
          backgroundColor: containerBackground,
          minHeight: 0,
          minWidth: 0,
          position: 'relative',
        }}
      >
        <div
          style={{
            flex: 1,
            position: 'relative',
            minHeight: 0,
            minWidth: 0,
            overflow: 'hidden',
            backgroundColor: canvasBackground,
            isolation: 'isolate',
            contain: 'layout style paint',
            zIndex: 1,
          }}
        >
          <GrammarCanvas />
          {/* TestPhrases panel at bottom - centered relative to canvas */}
          <TestPhrases
            initialPhrases={initialTestPhrases}
            onPhrasesChange={onTestPhrasesChange}
          />
        </div>

        {/* ✅ Horizontal splitter for SemanticPanel */}
        <div
          onMouseDown={handleSemanticPanelSplitterMouseDown}
          style={{
            width: '6px',
            backgroundColor: isResizingSemanticPanel ? '#3b82f6' : 'rgba(59, 130, 246, 0.3)',
            cursor: 'col-resize',
            flexShrink: 0,
            transition: isResizingSemanticPanel ? 'none' : 'background-color 0.2s',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            touchAction: 'none',
            zIndex: 10,
            position: 'relative',
            pointerEvents: 'auto',
          }}
          onMouseEnter={(e) => {
            if (!isResizingSemanticPanel) {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(59, 130, 246, 0.6)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isResizingSemanticPanel) {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(59, 130, 246, 0.3)';
            }
          }}
        />

        {/* ✅ SemanticPanel with fixed width */}
        <div style={{ width: `${semanticPanelWidth}px`, flexShrink: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <SemanticPanel editorMode={editorMode} />
        </div>
      </div>
    </div>
  );
}
