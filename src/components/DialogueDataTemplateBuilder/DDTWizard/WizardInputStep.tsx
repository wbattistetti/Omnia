import React from 'react';
import { Calendar } from 'lucide-react';

interface Props {
  userDesc: string;
  setUserDesc: (v: string) => void;
  onNext: () => void;
  onCancel: () => void;
  dataNode?: { name?: string; subData?: string[] };
}

const WizardInputStep: React.FC<Props> = ({ userDesc, setUserDesc, onNext, onCancel, dataNode }) => (
  <div
    style={{
      background: 'var(--sidebar-content-bg, #181825)',
      border: '2px solid #a21caf',
      borderRadius: 16,
      padding: 24,
      maxWidth: 480,
      margin: '32px auto',
      boxSizing: 'border-box',
    }}
  >
    <div style={{ textAlign: 'center', marginTop: 8, marginBottom: 8 }}>
      <div style={{ fontSize: 18, fontWeight: 600, color: '#fff', marginBottom: 8 }}>
        Describe the data dialogue you want to create:
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 0 }}>
        {dataNode?.name && <Calendar size={22} style={{ color: '#a21caf' }} />}
        <span style={{ fontSize: 20, fontWeight: 700, color: '#a21caf' }}>{dataNode?.name || ''}</span>
      </div>
      
      {/* Mostra i subData se presenti */}
      {dataNode?.subData && dataNode.subData.length > 0 && (
        <div style={{ 
          marginTop: 8,
          padding: '6px 10px', 
          backgroundColor: 'rgba(162,28,175,0.1)', 
          borderRadius: 6,
          fontSize: 14,
          color: '#e5e7eb',
          border: '1px solid rgba(162,28,175,0.3)'
        }}>
          <div style={{ fontWeight: 500 }}>
            Structure: ({dataNode.subData.join(', ')})
          </div>
        </div>
      )}
    </div>
    
    <div style={{ marginBottom: 12, fontSize: 14, color: '#9ca3af' }}>
      {dataNode?.name ? 
        "Modify the description to change the data type or structure:" : 
        "Describe the data you want to collect:"
      }
    </div>
    
    <input
      type="text"
      value={userDesc}
      onChange={e => setUserDesc(e.target.value)}
      placeholder="e.g., date of birth, email, phone number..."
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
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
      <button
        onClick={onCancel}
        style={{
          background: 'none',
          color: '#a21caf',
          border: 'none',
          fontWeight: 600,
          fontSize: 16,
          cursor: 'pointer',
          padding: '6px 18px',
        }}
      >
        Annulla
      </button>
      <button
        onClick={onNext}
        disabled={!userDesc.trim()}
        style={{
          background: '#a21caf',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          fontWeight: 600,
          fontSize: 16,
          cursor: userDesc.trim() ? 'pointer' : 'not-allowed',
          padding: '8px 28px',
          opacity: userDesc.trim() ? 1 : 0.6,
          transition: 'opacity 0.2s',
        }}
      >
        Invia
      </button>
    </div>
  </div>
);

export default WizardInputStep;