import React from 'react';
import { Calendar } from 'lucide-react';

interface Props {
  userDesc: string;
  setUserDesc: (v: string) => void;
  onNext: () => void;
  onCancel: () => void;
  dataNode?: { name?: string; subData?: string[] };
  selectedProvider?: 'openai' | 'groq';
  setSelectedProvider?: (provider: 'openai' | 'groq') => void;
  onAutoDetect?: (userDesc: string) => void; // Nuovo prop per auto-rilevamento
}

const WizardInputStep: React.FC<Props> = ({
  userDesc,
  setUserDesc,
  onNext,
  onCancel,
  dataNode,
  selectedProvider = 'openai',
  setSelectedProvider,
  onAutoDetect
}) => {
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const autoDetectTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Auto-detect function
  const handleAutoDetect = React.useCallback((text: string) => {
    const trimmed = text.trim();
    if (trimmed.length >= 3 && onAutoDetect) {
      // Clear existing timer
      if (autoDetectTimerRef.current) {
        clearTimeout(autoDetectTimerRef.current);
      }

      // Set new timer for auto-detection (debounce 1.5 seconds)
      autoDetectTimerRef.current = setTimeout(() => {
        console.log('[AUTO_DETECT] Triggering auto-detection for:', trimmed);
        onAutoDetect(trimmed);
      }, 1500);
    }
  }, [onAutoDetect]);

  // Cleanup timer on unmount
  React.useEffect(() => {
    return () => {
      if (autoDetectTimerRef.current) {
        clearTimeout(autoDetectTimerRef.current);
      }
    };
  }, []);
  React.useEffect(() => {
    try { console.log('[DDT][WizardInputStep][mount]'); } catch { }
    const handler = (e: any) => {
      const text = e?.detail?.text || '';
      try { console.log('[DDT][WizardInputStep][prefill received]', text); } catch { }
      try { setUserDesc(text); } catch { }
      if (textareaRef.current) {
        textareaRef.current.value = text;
      }
    };
    document.addEventListener('ddtWizard:prefillDesc', handler as any);
    return () => {
      document.removeEventListener('ddtWizard:prefillDesc', handler as any);
      try { console.log('[DDT][WizardInputStep][unmount]'); } catch { }
    };
  }, [setUserDesc]);

  // If empty, initialize the textarea with the act label (repeat header title inside textbox)
  React.useEffect(() => {
    const initial = (dataNode?.name || '').trim();
    if (!userDesc || userDesc.trim().length === 0) {
      try { setUserDesc(initial); } catch { }
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

      {/* Provider Selector */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#9ca3af', marginBottom: '8px' }}>
          AI Provider:
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setSelectedProvider?.('openai')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              border: '1px solid',
              background: selectedProvider === 'openai' ? '#3b82f6' : '#374151',
              color: selectedProvider === 'openai' ? '#ffffff' : '#9ca3af',
              borderColor: selectedProvider === 'openai' ? '#3b82f6' : '#4b5563',
              transition: 'all 0.2s ease'
            }}
          >
            OpenAI
          </button>
          <button
            onClick={() => setSelectedProvider?.('groq')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              border: '1px solid',
              background: selectedProvider === 'groq' ? '#10b981' : '#374151',
              color: selectedProvider === 'groq' ? '#ffffff' : '#9ca3af',
              borderColor: selectedProvider === 'groq' ? '#10b981' : '#4b5563',
              transition: 'all 0.2s ease'
            }}
          >
            Groq
          </button>
        </div>
      </div>

      <textarea
        ref={textareaRef}
        value={userDesc}
        onChange={e => {
          const newValue = e.target.value;
          console.log('[WIZARD_INPUT] 🔤 Text changed:', newValue);
          setUserDesc(newValue);
          handleAutoDetect(newValue); // Trigger auto-detection
        }}
        placeholder={dataNode?.name || ''}
        rows={2}
        style={{
          fontSize: 17,
          padding: '10px 16px',
          width: '100%',
          borderRadius: 8,
          border: '1px solid #4b5563',
          outline: 'none',
          marginBottom: 20,
          background: '#111827',
          color: '#fff',
          boxSizing: 'border-box',
          resize: 'vertical',
          whiteSpace: 'pre-wrap',
          wordWrap: 'break-word',
        }}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey && userDesc.trim()) {
            e.preventDefault();
            console.log('[WIZARD_INPUT] ⏎ Enter pressed with text:', userDesc.trim());
            try { console.log('[DDT][WizardInputStep][submit][Enter]'); } catch { };
            onNext();
          }
        }}
        autoFocus
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        {/* 🎨 Pulsante Annulla: sfondo bianco, bordo nero, testo nero */}
        <button
          onClick={onCancel}
          style={{
            background: '#fff',
            color: '#000',
            border: '1px solid #000',
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 14,
            cursor: 'pointer',
            padding: '6px 16px',
            transition: 'all 0.2s ease'
          }}
        >
          Annulla
        </button>
        {/* 🎨 Pulsante Invia: sfondo verde, bordo verde, testo bianco */}
        <button
          onClick={() => {
            console.log('[WIZARD_INPUT] 🖱️ Button clicked with text:', userDesc.trim());
            try { console.log('[DDT][WizardInputStep][submit][Click]'); } catch { };
            onNext();
          }}
          disabled={!userDesc.trim()}
          style={{
            background: '#22c55e',
            color: '#fff',
            border: '1px solid #22c55e',
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