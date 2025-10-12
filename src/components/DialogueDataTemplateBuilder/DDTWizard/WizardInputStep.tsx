import React from 'react';
import { Calendar } from 'lucide-react';

interface Props {
  userDesc: string;
  setUserDesc: (v: string) => void;
  onNext: () => void;
  onCancel: () => void;
  dataNode?: { name?: string; subData?: string[] };
}

const WizardInputStep: React.FC<Props> = ({ userDesc, setUserDesc, onNext, onCancel, dataNode }) => {
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  React.useEffect(() => {
    try { console.log('[DDT][WizardInputStep][mount]'); } catch {}
    const handler = (e: any) => {
      const text = e?.detail?.text || '';
      try { console.log('[DDT][WizardInputStep][prefill received]', text); } catch {}
      try { setUserDesc(text); } catch {}
      if (textareaRef.current) {
        textareaRef.current.value = text;
      }
    };
    document.addEventListener('ddtWizard:prefillDesc', handler as any);
    return () => {
      document.removeEventListener('ddtWizard:prefillDesc', handler as any);
      try { console.log('[DDT][WizardInputStep][unmount]'); } catch {}
    };
  }, [setUserDesc]);

  return (
    <div
      style={{
        // flattened container: use column background, no inner card
        background: 'transparent',
        border: 'none',
        borderRadius: 0,
        padding: '16px 20px',
        maxWidth: 'unset',
        margin: 0,
        boxSizing: 'border-box',
      }}
    >
      <div style={{ margin: '0 0 16px 0', paddingBottom: 10, borderBottom: '1px solid var(--ddt-accent, #a21caf)' }}>
        <div style={{ fontSize: 15, fontWeight: 500, color: '#cbd5e1', marginBottom: 8 }}>
          Describe in detail the data or information the virtual agent must ask to the user:
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {dataNode?.name && <Calendar size={22} style={{ color: 'var(--ddt-accent, #a21caf)' }} />}
          <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--ddt-accent, #a21caf)' }}>{dataNode?.name || ''}</span>
        </div>
        {dataNode?.subData && dataNode.subData.length > 0 && (
          <div style={{
            marginTop: 8,
            padding: '6px 10px',
            backgroundColor: 'color-mix(in oklab, var(--ddt-accent, #a21caf) 12%, transparent)',
            borderRadius: 6,
            fontSize: 14,
            color: '#e5e7eb',
            border: '1px solid color-mix(in oklab, var(--ddt-accent, #a21caf) 28%, transparent)'
          }}>
            <div style={{ fontWeight: 500 }}>Structure: ({dataNode.subData.join(', ')})</div>
          </div>
        )}
      </div>

      <div style={{ marginBottom: 12, fontSize: 14, color: '#9ca3af' }}>
        {dataNode?.name ? 'You can refine the description to change type or structure.' : ''}
      </div>

      <textarea
        ref={textareaRef}
        value={userDesc}
        onChange={e => setUserDesc(e.target.value)}
        placeholder="e.g., date of birth, email, phone number..."
        rows={2}
        style={{
          fontSize: 17,
          padding: '10px 16px',
          width: '100%',
          borderRadius: 8,
          border: '1px solid var(--ddt-accent, #a21caf)',
          outline: 'none',
          marginBottom: 20,
          background: '#111827',
          color: '#fff',
          boxSizing: 'border-box',
          resize: 'vertical',
          whiteSpace: 'pre-wrap',
          wordWrap: 'break-word',
        }}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && userDesc.trim()) { e.preventDefault(); try { console.log('[DDT][WizardInputStep][submit][Enter]'); } catch {}; onNext(); } }}
        autoFocus
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <button
          onClick={onCancel}
          style={{
            background: 'transparent',
            color: '#e2e8f0',
            border: '1px solid var(--ddt-accent, #a21caf)',
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 14,
            cursor: 'pointer',
            padding: '6px 16px',
          }}
        >
          Annulla
        </button>
        <button
          onClick={() => { try { console.log('[DDT][WizardInputStep][submit][Click]'); } catch {}; onNext(); }}
          disabled={!userDesc.trim()}
          style={{
            background: 'var(--ddt-accent, #a21caf)',
            color: '#0b1220',
            border: 'none',
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 14,
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
};

export default WizardInputStep;