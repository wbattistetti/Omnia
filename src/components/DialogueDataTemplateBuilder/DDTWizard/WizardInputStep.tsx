import React from 'react';

interface Props {
  userDesc: string;
  setUserDesc: (v: string) => void;
  onNext: () => void;
  onCancel: () => void;
}

const WizardInputStep: React.FC<Props> = ({ userDesc, setUserDesc, onNext, onCancel }) => (
  <div style={{ padding: 32, maxWidth: 480, margin: '0 auto' }}>
    <div style={{ color: '#fff', fontWeight: 700, fontSize: 20, marginBottom: 2, textAlign: 'center' }}>Che dato vuoi acquisire?</div>
    <div style={{ color: '#d1d5db', fontSize: 15, marginBottom: 18, textAlign: 'center' }}>(es: data di nascita, email, ecc)</div>
    <input
      type="text"
      value={userDesc}
      onChange={e => setUserDesc(e.target.value)}
      placeholder="Describe the data..."
      style={{
        fontSize: 17,
        padding: '10px 16px',
        width: '100%',
        borderRadius: 8,
        border: '2px solid #a21caf',
        outline: 'none',
        marginBottom: 22,
        background: '#23232b',
        color: '#fff',
        boxSizing: 'border-box',
      }}
      onKeyDown={e => { if (e.key === 'Enter' && userDesc.trim()) onNext(); }}
      autoFocus
    />
    <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', gap: 16 }}>
      <button
        onClick={onCancel}
        style={{
          background: 'transparent',
          color: '#a21caf',
          border: 'none',
          borderRadius: 8,
          padding: '8px 24px',
          fontWeight: 600,
          fontSize: 16,
          cursor: 'pointer',
        }}
      >
        Annulla
      </button>
      <button
        onClick={onNext}
        style={{
          background: '#a21caf',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          padding: '8px 24px',
          fontWeight: 600,
          fontSize: 16,
          cursor: userDesc.trim() ? 'pointer' : 'not-allowed',
          opacity: userDesc.trim() ? 1 : 0.6,
        }}
        disabled={!userDesc.trim()}
      >
        Invia
      </button>
    </div>
  </div>
);

export default WizardInputStep;