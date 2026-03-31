// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React, { useEffect } from 'react';
import { useGrammarStore } from './core/state/grammarStore';
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
  const { loadGrammar, createGrammar, grammar: currentGrammar } = useGrammarStore();

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

  // Track last loaded grammar ID to detect changes
  const lastGrammarIdRef = React.useRef<string | null>(null);

  const dbg = isGrammarEditorDebugEnabled();

  // Mount: ensure store has grammar before first paint
  React.useEffect(() => {
    if (initialGrammar && (!currentGrammar || currentGrammar.id !== initialGrammar.id)) {
      if (dbg) {
        console.log('[GrammarEditor] mount load', { grammarId: initialGrammar.id });
      }
      loadGrammar(initialGrammar);
      lastGrammarIdRef.current = initialGrammar.id;
    } else if (!initialGrammar && !currentGrammar) {
      if (dbg) {
        console.log('[GrammarEditor] mount create empty');
      }
      createGrammar('New Grammar');
      lastGrammarIdRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Prop-driven reload: initialGrammar identity changes from parent (e.g. contract sync)
  useEffect(() => {
    if (initialGrammar) {
      if (!currentGrammar) {
        if (dbg) {
          console.log('[GrammarEditor] load (no store)', { grammarId: initialGrammar.id });
        }
        loadGrammar(initialGrammar);
        lastGrammarIdRef.current = initialGrammar.id;
        return;
      }

      if (lastGrammarIdRef.current !== initialGrammar.id) {
        if (storeLooksAheadOfInitialProp(initialGrammar, currentGrammar)) {
          if (dbg) {
            console.log('[GrammarEditor] skip stale initial (store ahead of prop)', {
              initialId: initialGrammar.id,
              storeId: currentGrammar.id,
            });
          }
          lastGrammarIdRef.current = currentGrammar.id;
          return;
        }
        if (
          grammarStructuralFingerprint(initialGrammar) === grammarStructuralFingerprint(currentGrammar)
        ) {
          if (dbg) {
            console.log('[GrammarEditor] skip load (same structure, id-only churn)', {
              propId: initialGrammar.id,
              storeId: currentGrammar.id,
            });
          }
          lastGrammarIdRef.current = currentGrammar.id;
          return;
        }
        if (dbg) {
          console.log('[GrammarEditor] load (id changed)', {
            grammarId: initialGrammar.id,
            prevRef: lastGrammarIdRef.current,
          });
        }
        loadGrammar(initialGrammar);
        lastGrammarIdRef.current = initialGrammar.id;
        return;
      }

      const shouldReload =
        (initialGrammar.nodes?.length || 0) > (currentGrammar?.nodes?.length || 0) ||
        (initialGrammar.edges?.length || 0) > (currentGrammar?.edges?.length || 0) ||
        (initialGrammar.slots?.length || 0) > (currentGrammar?.slots?.length || 0) ||
        (initialGrammar.semanticSets?.length || 0) > (currentGrammar?.semanticSets?.length || 0);

      if (shouldReload) {
        if (dbg) {
          console.log('[GrammarEditor] reload (external grew)', { grammarId: initialGrammar.id });
        }
        loadGrammar(initialGrammar);
      }
    } else if (!currentGrammar) {
      createGrammar('New Grammar');
      lastGrammarIdRef.current = null;
    } else if (lastGrammarIdRef.current !== null) {
      lastGrammarIdRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialGrammar, loadGrammar, createGrammar]);

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
