import React from 'react';
import { Calendar } from 'lucide-react';
import DataTypeLabel from './DataTypeLabel';

interface Props {
  detectedType: string | null;
  detectTypeIcon: string | null;
  detectedSubData: string[] | null;
  onCorrect: () => void;
  onWrong: () => void;
  onCancel: () => void;
}

const WizardConfirmTypeStep: React.FC<Props> = ({ detectedType, detectTypeIcon, detectedSubData, onCorrect, onWrong, onCancel }) => (
  <div style={{ padding: '16px 0 12px 0', maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
    <div style={{ fontWeight: 600, fontSize: 18, color: '#fff', marginBottom: 6 }}>
      Create a dialogue for:
    </div>
    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
      <DataTypeLabel
        icon={detectTypeIcon === 'Calendar' ? <Calendar size={18} style={{ color: '#a21caf' }} /> : null}
        label={detectedType || ''}
      />
    </div>
    
    {/* Mostra i subData se presenti */}
    {detectedSubData && detectedSubData.length > 0 && (
      <div style={{ 
        marginBottom: 12, 
        padding: '8px 12px', 
        backgroundColor: 'rgba(255,255,255,0.1)', 
        borderRadius: 6,
        fontSize: 14,
        color: '#e5e7eb'
      }}>
        <div style={{ fontWeight: 500, marginBottom: 4 }}>
          Structure: ({detectedSubData.join(', ')})
        </div>
      </div>
    )}
    
    <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 6 }}>
      <button
        onClick={onCorrect}
        style={{
          background: 'none',
          color: '#22c55e',
          border: '1px solid #22c55e',
          borderRadius: 6,
          fontWeight: 400,
          fontSize: 14,
          cursor: 'pointer',
          padding: '2px 10px',
        }}
      >
        Correct
      </button>
      <button
        onClick={onWrong}
        style={{
          background: 'none',
          color: '#ef4444',
          border: '1px solid #ef4444',
          borderRadius: 6,
          fontWeight: 400,
          fontSize: 14,
          cursor: 'pointer',
          padding: '2px 10px',
        }}
      >
        Wrong
      </button>
      <button
        onClick={onCancel}
        style={{
          background: 'none',
          color: '#3b82f6',
          border: '1px solid #3b82f6',
          borderRadius: 6,
          fontWeight: 400,
          fontSize: 14,
          cursor: 'pointer',
          padding: '2px 10px',
        }}
      >
        Cancel
      </button>
    </div>
  </div>
);

export default WizardConfirmTypeStep;