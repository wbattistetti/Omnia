// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React from 'react';
import type { Grammar } from '../types/grammarTypes';

export interface GrammarToolbarProps {
  onSave?: (grammar: Grammar) => void;
  onClose?: () => void;
}

export function GrammarToolbar({ onSave, onClose }: GrammarToolbarProps) {
  return (
    <div className="grammar-toolbar" style={{
      display: 'flex',
      gap: '8px',
      padding: '8px',
      borderBottom: '1px solid #e5e7eb',
      backgroundColor: '#f9fafb',
    }}>
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
