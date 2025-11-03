import React from 'react';
import IntentEditorShell from '../../../../features/intent-editor/IntentEditorShell';
import { NLPProfile } from '../NLPExtractorProfileEditor';

interface IntentEditorInlineEditorProps {
  onClose: () => void;
  node?: any;
  profile?: NLPProfile;
  onProfileUpdate?: (profile: NLPProfile) => void;
}

/**
 * Inline editor wrapper for IntentEditorShell
 * Adapts IntentEditorShell for use within NLPExtractorProfileEditor
 * Shows intent classifier/embeddings configuration
 */
export default function IntentEditorInlineEditor({
  onClose,
  node,
  profile,
  onProfileUpdate,
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

      {/* IntentEditorShell with inlineMode prop */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <IntentEditorShell inlineMode={true} />
      </div>
    </div>
  );
}

