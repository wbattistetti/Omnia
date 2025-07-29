import React from 'react';
import { Calendar } from 'lucide-react';

interface Props {
  detectedType: string | null;
  detectTypeIcon: string | null;
  onCorrect: () => void;
  onWrong: () => void;
  onCancel: () => void;
}

const WizardConfirmTypeStep: React.FC<Props> = ({ detectedType, detectTypeIcon, onCorrect, onWrong, onCancel }) => (
  <div style={{ padding: 32, maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
    <div style={{ fontWeight: 600, fontSize: 18, color: '#fff', marginBottom: 10 }}>
      You want to create a dialogue for:
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 18 }}>
      <span style={{ fontSize: 38, color: '#fff', marginBottom: 6 }}>
        {detectTypeIcon === 'Calendar' && <Calendar size={38} style={{ marginRight: 10, verticalAlign: 'middle' }} />}
      </span>
      <span style={{ fontWeight: 800, fontSize: 28, color: '#a21caf', marginBottom: 0 }}>
        {detectedType}
      </span>
    </div>
    <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', gap: 14, marginBottom: 18 }}>
      <button
        onClick={onCorrect}
        style={{
          background: 'none',
          color: '#22c55e',
          border: 'none',
          fontWeight: 400,
          fontSize: 20,
          cursor: 'pointer',
          padding: '4px 12px',
        }}
      >
        Correct
      </button>
      <button
        onClick={onWrong}
        style={{
          background: 'none',
          color: '#ef4444',
          border: 'none',
          fontWeight: 400,
          fontSize: 20,
          cursor: 'pointer',
          padding: '4px 12px',
        }}
      >
        Wrong
      </button>
      <button
        onClick={onCancel}
        style={{
          background: 'none',
          color: '#3b82f6',
          border: 'none',
          fontWeight: 400,
          fontSize: 18,
          cursor: 'pointer',
          padding: '4px 12px',
        }}
      >
        Cancel
      </button>
    </div>
  </div>
);

export default WizardConfirmTypeStep;