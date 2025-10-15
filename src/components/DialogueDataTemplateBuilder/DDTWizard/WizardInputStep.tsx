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

  // If empty, initialize the textarea with the act label (repeat header title inside textbox)
  React.useEffect(() => {
    const initial = (dataNode?.name || '').trim();
    if (!userDesc || userDesc.trim().length === 0) {
      try { setUserDesc(initial); } catch {}
      if (textareaRef.current) { textareaRef.current.value = initial; }
    }
  }, [dataNode?.name]);

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
      {/* Header: keep only the instruction line */}
      <div style={{ margin: '0 0 12px 0' }}>
        <div style={{ fontSize: 15, fontWeight: 500, color: '#cbd5e1' }}>
          Describe in detail the data or information the virtual agent must ask to the user:
        </div>
      </div>

      {/* Subtitle removed as requested */}

      <textarea
        ref={textareaRef}
        value={userDesc}
        onChange={e => setUserDesc(e.target.value)}
        placeholder={dataNode?.name || ''}
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