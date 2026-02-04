import React from 'react';

interface Props {
  onOk: () => void;
}

const WizardSupportModal: React.FC<Props> = ({ onOk }) => (
  <div style={{ padding: 32, maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
    <div style={{ color: '#a21caf', fontWeight: 700, fontSize: 22, marginBottom: 18 }}>Supporto</div>
    <div style={{ color: '#fff', fontSize: 17, marginBottom: 24 }}>Placeholder: qui puoi chiedere supporto.</div>
    <button
      onClick={onOk}
      style={{
        background: '#a21caf',
        color: '#fff',
        border: 'none',
        borderRadius: 8,
        padding: '8px 24px',
        fontWeight: 600,
        fontSize: 16,
        cursor: 'pointer',
      }}
    >
      OK
    </button>
  </div>
);

export default WizardSupportModal;