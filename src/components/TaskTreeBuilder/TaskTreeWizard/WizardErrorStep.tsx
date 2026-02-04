import React from 'react';

interface Props {
  errorMsg: string | null;
  onRetry: () => void;
  onSupport: () => void;
  onCancel: () => void;
}

const WizardErrorStep: React.FC<Props> = ({ errorMsg, onRetry, onSupport, onCancel }) => (
  <div style={{ padding: 32, maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
    <div style={{ color: '#f87171', fontWeight: 600, fontSize: 17, marginBottom: 12 }}>{errorMsg || 'Errore IA'}</div>
    <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', gap: 14, marginBottom: 18 }}>
      <button
        onClick={onRetry}
        style={{
          background: 'none',
          color: '#f59e42',
          border: 'none',
          fontWeight: 400,
          fontSize: 20,
          cursor: 'pointer',
          padding: '4px 12px',
        }}
      >
        Retry
      </button>
      <button
        onClick={onSupport}
        style={{
          background: 'none',
          color: '#a21caf',
          border: 'none',
          fontWeight: 400,
          fontSize: 20,
          cursor: 'pointer',
          padding: '4px 12px',
        }}
      >
        Support
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
        Annulla
      </button>
    </div>
  </div>
);

export default WizardErrorStep;