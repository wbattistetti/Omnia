import React from 'react';
import EmbeddingEditorShell from '../../../../features/intent-editor/EmbeddingEditorShell';
import { NLPProfile } from '../NLPExtractorProfileEditor';

interface IntentEditorInlineEditorProps {
  onClose: () => void;
  node?: any;
  profile?: NLPProfile;
  onProfileUpdate?: (profile: NLPProfile) => void;
}

/**
 * Inline editor wrapper for EmbeddingEditorShell
 * Adapts EmbeddingEditorShell for use within NLPExtractorProfileEditor
 * Shows intent classifier/embeddings configuration
 */
export default function IntentEditorInlineEditor({
  onClose,
  node,
  profile,
  onProfileUpdate,
  intentSelected,
}: IntentEditorInlineEditorProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 600 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #e5e7eb' }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Intent Classifier (Embeddings)</h3>
        <button
          onClick={onClose}
          style={{
            padding: '6px 12px',
            border: '1px solid #d1d5db',
            borderRadius: 6,
            background: '#fff',
            cursor: 'pointer',
            fontSize: 14
          }}
        >
          Close
        </button>
      </div>

      {/* EmbeddingEditorShell with inlineMode prop and intentSelected */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <EmbeddingEditorShell inlineMode={true} intentSelected={intentSelected} />
      </div>
    </div>
  );
}

