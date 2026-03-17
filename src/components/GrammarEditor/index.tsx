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
        <SemanticPanel editorMode={editorMode} />
      </div>
    </div>
  );
}
