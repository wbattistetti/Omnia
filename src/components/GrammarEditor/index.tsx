// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React, { useEffect } from 'react';
import { useGrammarStore } from './core/state/grammarStore';
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

  // CRITICAL: Load grammar immediately on mount if initialGrammar is available
  // This ensures grammar is in store before canvas renders
  React.useEffect(() => {
    if (initialGrammar && (!currentGrammar || currentGrammar.id !== initialGrammar.id)) {
      console.log('[GrammarEditor] 🚀 IMMEDIATE: Loading grammar on mount', {
        grammarId: initialGrammar.id,
        nodesCount: initialGrammar.nodes?.length || 0,
        edgesCount: initialGrammar.edges?.length || 0,
        slotsCount: initialGrammar.slots?.length || 0,
        semanticSetsCount: initialGrammar.semanticSets?.length || 0,
        currentGrammarId: currentGrammar?.id,
      });
      loadGrammar(initialGrammar);
      lastGrammarIdRef.current = initialGrammar.id;
    } else if (!initialGrammar && !currentGrammar) {
      console.log('[GrammarEditor] 🚀 IMMEDIATE: No initialGrammar, creating new grammar');
      createGrammar('New Grammar');
      lastGrammarIdRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only on mount

  // Watch for changes to initialGrammar
  useEffect(() => {
    console.log('[GrammarEditor] 🔍 useEffect triggered', {
      hasInitialGrammar: !!initialGrammar,
      initialGrammarId: initialGrammar?.id,
      currentGrammarId: currentGrammar?.id,
      lastLoadedId: lastGrammarIdRef.current,
    });

    if (initialGrammar) {
      // Always load if grammar is null or ID changed
      if (!currentGrammar || lastGrammarIdRef.current !== initialGrammar.id) {
        console.log('[GrammarEditor] 🔄 Loading grammar (new or changed)', {
          grammarId: initialGrammar.id,
          nodesCount: initialGrammar.nodes?.length || 0,
          edgesCount: initialGrammar.edges?.length || 0,
          slotsCount: initialGrammar.slots?.length || 0,
          semanticSetsCount: initialGrammar.semanticSets?.length || 0,
          previousGrammarId: lastGrammarIdRef.current,
          currentGrammarId: currentGrammar?.id,
          nodes: initialGrammar.nodes?.map(n => ({ id: n.id, label: n.label })).slice(0, 3),
          slots: initialGrammar.slots?.map(s => ({ id: s.id, name: s.name })).slice(0, 3),
        });
        loadGrammar(initialGrammar);
        lastGrammarIdRef.current = initialGrammar.id;
      } else {
        // Same grammar ID but might have been updated - check if structure changed
        const structureChanged =
          currentGrammar.nodes?.length !== initialGrammar.nodes?.length ||
          currentGrammar.edges?.length !== initialGrammar.edges?.length ||
          currentGrammar.slots?.length !== initialGrammar.slots?.length ||
          currentGrammar.semanticSets?.length !== initialGrammar.semanticSets?.length;

        if (structureChanged) {
          console.log('[GrammarEditor] 🔄 Grammar updated (structure changed), reloading', {
            grammarId: initialGrammar.id,
            oldNodesCount: currentGrammar?.nodes?.length || 0,
            newNodesCount: initialGrammar.nodes?.length || 0,
            oldEdgesCount: currentGrammar?.edges?.length || 0,
            newEdgesCount: initialGrammar.edges?.length || 0,
            oldSlotsCount: currentGrammar?.slots?.length || 0,
            newSlotsCount: initialGrammar.slots?.length || 0,
            oldSemanticSetsCount: currentGrammar?.semanticSets?.length || 0,
            newSemanticSetsCount: initialGrammar.semanticSets?.length || 0,
          });
          loadGrammar(initialGrammar);
        } else {
          console.log('[GrammarEditor] ✅ Grammar already loaded and up-to-date', {
            grammarId: initialGrammar.id,
            nodesCount: currentGrammar.nodes?.length || 0,
          });
        }
      }
    } else {
      // No initialGrammar - create new grammar if we don't have one
      if (!currentGrammar) {
        console.log('[GrammarEditor] ➕ No initialGrammar and no currentGrammar, creating new grammar');
        createGrammar('New Grammar');
        lastGrammarIdRef.current = null;
      } else if (lastGrammarIdRef.current !== null) {
        console.log('[GrammarEditor] ⚠️ No initialGrammar but have currentGrammar, clearing ref');
        lastGrammarIdRef.current = null;
      }
    }
  }, [initialGrammar, loadGrammar, createGrammar, currentGrammar]);

  // Debug: Log grammar state before render
  React.useEffect(() => {
    console.log('[GrammarEditor] 🎨 Render state', {
      hasInitialGrammar: !!initialGrammar,
      initialGrammarId: initialGrammar?.id,
      hasCurrentGrammar: !!currentGrammar,
      currentGrammarId: currentGrammar?.id,
      grammarMatch: initialGrammar?.id === currentGrammar?.id,
    });
  });

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
