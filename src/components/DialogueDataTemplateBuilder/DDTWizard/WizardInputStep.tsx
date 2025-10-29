import React from 'react';
import { Calendar, Bell } from 'lucide-react';

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
  selectedProvider = 'groq',
  setSelectedProvider,
  onAutoDetect
}) => {
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const autoDetectTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const selectRef = React.useRef<HTMLSelectElement | null>(null);
  const [selectWidth, setSelectWidth] = React.useState<number>(120);

  // Calcola la larghezza del select basata sul contenuto
  React.useEffect(() => {
    if (selectRef.current) {
      // Usa un canvas per misurare la larghezza del testo
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (context) {
        context.font = '500 13px system-ui, -apple-system, sans-serif';
        const text = selectedProvider === 'groq' ? 'Groq' : 'OpenAI';
        const metrics = context.measureText(text);
        const textWidth = metrics.width;
        // Aggiungi padding: 12px sinistra + 32px destra (per chevron) + un po' di spazio
        const width = Math.max(textWidth + 44, 120);
        setSelectWidth(width);
      }
    }
  }, [selectedProvider]);

  // Calcola la larghezza quando il select è aperto (per mostrare tutte le opzioni)
  const handleSelectFocus = () => {
    if (selectRef.current) {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (context) {
        context.font = '500 13px system-ui, -apple-system, sans-serif';
        // Calcola la larghezza massima di tutte le opzioni
        const options = selectRef.current.options;
        let maxWidth = 120;

        for (let i = 0; i < options.length; i++) {
          const text = options[i].textContent || '';
          const metrics = context.measureText(text);
          const textWidth = metrics.width + 44; // Padding
          if (textWidth > maxWidth) maxWidth = textWidth;
        }

        setSelectWidth(maxWidth);
      }
    }
  };

  const handleSelectBlur = () => {
    // Quando chiude, torna alla larghezza del valore selezionato
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (context) {
      context.font = '500 13px system-ui, -apple-system, sans-serif';
      const text = selectedProvider === 'groq' ? 'Groq' : 'OpenAI';
      const metrics = context.measureText(text);
      const width = Math.max(metrics.width + 44, 120);
      setSelectWidth(width);
    }
  };

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
      {/* Header: instruction line + Provider Selector + Bell sulla stessa riga */}
      <div style={{
        margin: '0 0 12px 0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px',
        flexWrap: 'wrap' // Responsive: wrap su riga successiva se necessario
      }}>
        <div style={{ fontSize: 15, fontWeight: 500, color: '#cbd5e1', flex: '1 1 auto' }}>
          Describe in detail the data or information the virtual agent must ask to the user:
        </div>

        {/* Provider Selector + Bell - Allineati a destra */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexShrink: 0
        }}>
          {/* Dropdown per AI Provider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: '#9ca3af', whiteSpace: 'nowrap' }}>
              AI Provider:
            </label>
            <select
              ref={selectRef}
              value={selectedProvider}
              onChange={(e) => setSelectedProvider?.(e.target.value as 'openai' | 'groq')}
              onFocus={handleSelectFocus}
              onBlur={handleSelectBlur}
              style={{
                padding: '6px 32px 6px 12px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
                border: '1px solid #4b5563',
                background: '#374151',
                color: '#cbd5e1',
                outline: 'none',
                appearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%239ca3af' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 8px center',
                backgroundSize: '12px',
                width: `${selectWidth}px`,
                transition: 'width 0.2s ease'
              }}
            >
              <option value="openai">OpenAI</option>
              <option value="groq">Groq</option>
            </select>
          </div>

          {/* Bell icon + text */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: '#9ca3af',
            fontSize: '13px',
            whiteSpace: 'nowrap'
          }}>
            <Bell size={16} />
            <span>Ring when completed</span>
          </div>
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