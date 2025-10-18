import React from 'react';

interface LLMInlineEditorProps {
  onClose: () => void;
}

/**
 * Inline editor for configuring LLM extraction
 * Placeholder for future prompt configuration
 */
export default function LLMInlineEditor({ onClose }: LLMInlineEditorProps) {
  return (
    <div
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        padding: 16,
        background: '#f9fafb',
        animation: 'fadeIn 0.2s ease-in',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
          🪄 Configure LLM
        </h3>
        <button
          onClick={onClose}
          style={{
            background: '#e5e7eb',
            border: 'none',
            borderRadius: 4,
            padding: '6px 12px',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          ❌ Close
        </button>
      </div>

      <div style={{ padding: 16, textAlign: 'center', color: '#666' }}>
        <p>LLM prompt editor coming soon...</p>
        <p style={{ fontSize: 12, marginTop: 8 }}>
          Configure custom prompts for AI extraction
        </p>
      </div>
    </div>
  );
}

