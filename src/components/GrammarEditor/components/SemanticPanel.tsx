// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React from 'react';
import { useSemanticPanel } from '../hooks/useSemanticPanel';
import { useGrammarStore } from '../core/state/grammarStore';

export function SemanticPanel({ editorMode = 'text' }: { editorMode?: 'text' | 'graph' }) {
  const { isOpen, togglePanel, slots, semanticSets } = useSemanticPanel();
  const { selectSlot, selectSet } = useGrammarStore();

  // Styling based on editor mode - matches sidebar when in graph mode
  const panelBackground = editorMode === 'graph' ? '#121621' : '#ffffff';
  const panelBorderColor = editorMode === 'graph' ? '#252a3e' : '#e5e7eb';
  const textColor = editorMode === 'graph' ? '#e5e7eb' : '#000000';
  const itemBackground = editorMode === 'graph' ? 'rgba(156,163,175,0.25)' : '#fff';
  const itemBorderColor = editorMode === 'graph' ? '#334155' : '#d1d5db';
  const itemTextColor = editorMode === 'graph' ? '#e5e7eb' : '#000000';
  const placeholderColor = editorMode === 'graph' ? '#9ca3af' : '#6b7280';

  if (!isOpen) {
    return (
      <div style={{
        width: '40px',
        borderLeft: `1px solid ${panelBorderColor}`,
        backgroundColor: panelBackground,
        cursor: 'pointer',
      }} onClick={togglePanel}>
        <div style={{
          writingMode: 'vertical-rl',
          textAlign: 'center',
          padding: '8px',
          fontSize: '12px',
          color: textColor,
        }}>
          Semantic
        </div>
      </div>
    );
  }

  return (
    <div style={{
      width: '300px',
      borderLeft: `1px solid ${panelBorderColor}`,
      backgroundColor: panelBackground,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      position: 'relative',
      zIndex: 1,
    }}>
      <div style={{
        padding: '12px',
        borderBottom: `1px solid ${panelBorderColor}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: textColor }}>Semantic</h3>
        <button
          onClick={togglePanel}
          style={{
            padding: '4px 8px',
            border: `1px solid ${panelBorderColor}`,
            borderRadius: '4px',
            backgroundColor: itemBackground,
            color: textColor,
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          Hide
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: '600', color: textColor }}>
            Slots
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {slots.map(slot => (
              <div
                key={slot.id}
                onClick={() => selectSlot(slot.id)}
                style={{
                  padding: '8px',
                  border: `1px solid ${itemBorderColor}`,
                  borderRadius: '4px',
                  backgroundColor: itemBackground,
                  color: itemTextColor,
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                {slot.name} ({slot.type})
              </div>
            ))}
            {slots.length === 0 && (
              <div style={{ fontSize: '11px', color: placeholderColor, fontStyle: 'italic' }}>
                No slots defined
              </div>
            )}
          </div>
        </div>

        <div>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: '600', color: textColor }}>
            Semantic Sets
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {semanticSets.map(set => (
              <div
                key={set.id}
                onClick={() => selectSet(set.id)}
                style={{
                  padding: '8px',
                  border: `1px solid ${itemBorderColor}`,
                  borderRadius: '4px',
                  backgroundColor: itemBackground,
                  color: itemTextColor,
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                {set.name} ({set.values.length} values)
              </div>
            ))}
            {semanticSets.length === 0 && (
              <div style={{ fontSize: '11px', color: placeholderColor, fontStyle: 'italic' }}>
                No semantic sets defined
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
