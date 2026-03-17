// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React from 'react';
import { useGrammarExport } from '../features/grammar-export/useGrammarExport';
import { useGrammarStore } from '../core/state/grammarStore';
import type { Grammar } from '../types/grammarTypes';

export interface GrammarToolbarProps {
  onSave?: (grammar: Grammar) => void;
  onClose?: () => void;
  hideExportButtons?: boolean; // ✅ Hide Export/Download/Copy buttons for auto-save mode
}

export function GrammarToolbar({ onSave, onClose, hideExportButtons = false }: GrammarToolbarProps) {
  const { grammar } = useGrammarStore();
  const { exportToJSON, downloadJSON, copyToClipboard } = useGrammarExport();

  const handleExport = () => {
    console.log('[GrammarToolbar] 💾 Export button clicked', {
      hasGrammar: !!grammar,
      hasOnSave: !!onSave,
      grammarNodesCount: grammar?.nodes?.length || 0,
      grammarEdgesCount: grammar?.edges?.length || 0,
    });

    const exported = exportToJSON();
    console.log('[GrammarToolbar] 📦 Grammar exported to JSON', {
      exported: !!exported,
      exportedNodesCount: exported?.nodes?.length || 0,
      exportedEdgesCount: exported?.edges?.length || 0,
      exportedSlotsCount: exported?.slots?.length || 0,
      exportedSemanticSetsCount: exported?.semanticSets?.length || 0,
      hasOnSave: !!onSave,
    });

    if (exported && onSave) {
      console.log('[GrammarToolbar] 📤 Calling onSave callback', {
        exportedNodesCount: exported.nodes?.length || 0,
      });
      onSave(exported);
      console.log('[GrammarToolbar] ✅ onSave callback completed');
    } else {
      console.warn('[GrammarToolbar] ⚠️ Cannot save: missing exported or onSave', {
        hasExported: !!exported,
        hasOnSave: !!onSave,
      });
    }
  };

  const handleDownload = () => {
    downloadJSON();
  };

  const handleCopy = () => {
    copyToClipboard();
  };

  return (
    <div className="grammar-toolbar" style={{
      display: 'flex',
      gap: '8px',
      padding: '8px',
      borderBottom: '1px solid #e5e7eb',
      backgroundColor: '#f9fafb',
    }}>
      {!hideExportButtons && (
        <>
          <button
            onClick={handleExport}
            disabled={!grammar}
            style={{
              padding: '6px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              backgroundColor: '#fff',
              cursor: grammar ? 'pointer' : 'not-allowed',
            }}
          >
            Export
          </button>
          <button
            onClick={handleDownload}
            disabled={!grammar}
            style={{
              padding: '6px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              backgroundColor: '#fff',
              cursor: grammar ? 'pointer' : 'not-allowed',
            }}
          >
            Download JSON
          </button>
          <button
            onClick={handleCopy}
            disabled={!grammar}
            style={{
              padding: '6px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              backgroundColor: '#fff',
              cursor: grammar ? 'pointer' : 'not-allowed',
            }}
          >
            Copy JSON
          </button>
        </>
      )}
      {onClose && (
        <button
          onClick={onClose}
          style={{
            padding: '6px 12px',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            backgroundColor: '#fff',
            cursor: 'pointer',
            marginLeft: 'auto',
          }}
        >
          Close
        </button>
      )}
    </div>
  );
}
