// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React, { useEffect } from 'react';
import { useGrammarStore } from './core/state/grammarStore';
import { GrammarCanvas } from './components/GrammarCanvas';
import { SemanticPanel } from './components/SemanticPanel';
import { GrammarToolbar } from './components/GrammarToolbar';
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
}: GrammarEditorProps) {
  const { loadGrammar, createGrammar } = useGrammarStore();

  useEffect(() => {
    if (initialGrammar) {
      loadGrammar(initialGrammar);
    } else {
      createGrammar('New Grammar');
    }
  }, [initialGrammar, loadGrammar, createGrammar]);

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
        </div>
        <SemanticPanel editorMode={editorMode} />
      </div>
    </div>
  );
}
