// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React from 'react';
import { useGrammarExport } from '../features/grammar-export/useGrammarExport';
import { useGrammarStore } from '../core/state/grammarStore';
import type { Grammar } from '../types/grammarTypes';

export interface GrammarToolbarProps {
  onSave?: (grammar: Grammar) => void;
  onClose?: () => void;
}

export function GrammarToolbar({ onSave, onClose }: GrammarToolbarProps) {
  const { grammar } = useGrammarStore();
  const { exportToJSON, downloadJSON, copyToClipboard } = useGrammarExport();

  const handleExport = () => {
    const exported = exportToJSON();
    if (exported && onSave) {
      onSave(exported);
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
