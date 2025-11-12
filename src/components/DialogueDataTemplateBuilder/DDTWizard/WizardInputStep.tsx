import React from 'react';
import { Calendar, Bell } from 'lucide-react';
import { useFontContext } from '../../../context/FontContext';
import { getAllDialogueTemplates } from '../../../services/ProjectDataService';

interface Props {
  userDesc: string;
  setUserDesc: (v: string) => void;
  onNext: () => void;
  onCancel: () => void;
  dataNode?: { name?: string; subData?: string[] };
  onAutoDetect?: (userDesc: string) => void; // Nuovo prop per auto-rilevamento
  onTemplateSelect?: (template: any) => void; // Callback quando viene selezionato un template
}

const WizardInputStep: React.FC<Props> = ({
  userDesc,
  setUserDesc,
  onNext,
  onCancel,
  dataNode,
  onAutoDetect,
  onTemplateSelect
}) => {
  const { combinedClass } = useFontContext();
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const autoDetectTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const [templates, setTemplates] = React.useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<string>('');
  const [loadingTemplates, setLoadingTemplates] = React.useState(false);

  // Load templates on mount
  React.useEffect(() => {
    const loadTemplates = async () => {
      setLoadingTemplates(true);
      try {
        const allTemplates = await getAllDialogueTemplates();
        setTemplates(Array.isArray(allTemplates) ? allTemplates : []);
        console.log('[WIZARD_INPUT] Loaded templates:', Array.isArray(allTemplates) ? allTemplates.length : 0);
      } catch (err) {
        console.error('[WIZARD_INPUT] Failed to load templates:', err);
        setTemplates([]);
      } finally {
        setLoadingTemplates(false);
      }
    };
    loadTemplates();
  }, []);

  // Handle template selection
  const handleTemplateChange = React.useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const templateId = e.target.value;
    setSelectedTemplateId(templateId);

    if (templateId && onTemplateSelect) {
      const selectedTemplate = templates.find(t => (t._id || t.id) === templateId);
      if (selectedTemplate) {
        console.log('[WIZARD_INPUT] Template selected:', selectedTemplate.label);
        onTemplateSelect(selectedTemplate);
      }
    } else if (!templateId) {
      // Reset selection
      setSelectedTemplateId('');
    }
  }, [templates, onTemplateSelect]);

  // Auto-detect function - NO DEBOUNCE, called only on mount or explicit trigger
  const handleAutoDetect = React.useCallback((text: string) => {
    const trimmed = text.trim();
    console.log('[WIZARD_INPUT][AUTO_DETECT] Called', { text, trimmed, trimmedLength: trimmed.length, hasOnAutoDetect: !!onAutoDetect });
    if (trimmed.length >= 3 && onAutoDetect) {
      console.log('[WIZARD_INPUT][AUTO_DETECT] Calling onAutoDetect immediately (no debounce)', { trimmed });
      onAutoDetect(trimmed);
    } else {
      console.log('[WIZARD_INPUT][AUTO_DETECT] Skipped', { reason: trimmed.length < 3 ? 'too_short' : !onAutoDetect ? 'no_callback' : 'unknown' });
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
    console.log('[DDT][WizardInputStep][mount]', {
      hasOnAutoDetect: !!onAutoDetect,
      userDesc,
      userDescLength: userDesc?.length || 0,
      dataNodeName: dataNode?.name
    });
    const handler = (e: any) => {
      const text = e?.detail?.text || '';
      console.log('[DDT][WizardInputStep][prefill received]', text);
      try { setUserDesc(text); } catch { }
      if (textareaRef.current) {
        textareaRef.current.value = text;
      }
    };
    document.addEventListener('ddtWizard:prefillDesc', handler as any);
    return () => {
      document.removeEventListener('ddtWizard:prefillDesc', handler as any);
      console.log('[DDT][WizardInputStep][unmount]');
    };
  }, [setUserDesc, onAutoDetect, userDesc, dataNode?.name]);

  // If empty, initialize the textarea with the act label (repeat header title inside textbox)
  React.useEffect(() => {
    const initial = (dataNode?.name || '').trim();
    if (!userDesc || userDesc.trim().length === 0) {
      console.log('[WIZARD_INPUT][INIT] Setting initial value', { initial });
      try { setUserDesc(initial); } catch { }
      if (textareaRef.current) { textareaRef.current.value = initial; }
    }
  }, [dataNode?.name]);

  // ✅ Trigger auto-detect when userDesc becomes non-empty for the first time
  const hasAutoDetectedRef = React.useRef<string>('');
  React.useEffect(() => {
    const trimmed = (userDesc || '').trim();

    console.log('[WIZARD_INPUT][MOUNT_CHECK] Checking if should auto-detect', {
      userDesc,
      trimmed,
      trimmedLength: trimmed.length,
      hasOnAutoDetect: !!onAutoDetect,
      hasAutoDetected: hasAutoDetectedRef.current,
      shouldTrigger: trimmed.length >= 3 && onAutoDetect && trimmed !== hasAutoDetectedRef.current
    });

    // Only trigger if text is long enough, callback exists, and we haven't already processed this text
    if (trimmed.length >= 3 && onAutoDetect && trimmed !== hasAutoDetectedRef.current) {
      console.log('[WIZARD_INPUT][MOUNT_CHECK] ✅ Triggering auto-detect (no debounce)', { trimmed });
      hasAutoDetectedRef.current = trimmed;

      // Small delay just to ensure component is fully mounted and state is stable
      const timer = setTimeout(() => {
        console.log('[WIZARD_INPUT][MOUNT_CHECK] Timer fired, calling onAutoDetect', { trimmed });
        onAutoDetect(trimmed);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [userDesc, onAutoDetect]); // Run when userDesc or onAutoDetect changes

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
        <div className={combinedClass} style={{ fontWeight: 500, color: '#cbd5e1', flex: '1 1 auto' }}>
          Describe in detail the data the virtual agent must ask to the user, specify all the pieces of data you need to retrieve:
        </div>

        {/* Provider Selector + Bell - Allineati a destra */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexShrink: 0
        }}>

          {/* Bell icon + text */}
          <div className={combinedClass} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: '#9ca3af',
            whiteSpace: 'nowrap'
          }}>
            <Bell size={16} />
            <span>Ring when completed</span>
          </div>
        </div>
      </div>

      {/* Template Selection Combobox */}
      <div style={{ marginBottom: 16 }}>
        <label className={combinedClass} style={{
          display: 'block',
          marginBottom: 8,
          color: '#cbd5e1',
          fontWeight: 500,
          fontSize: 14
        }}>
          Scegli il tipo di dato
        </label>
        <select
          value={selectedTemplateId}
          onChange={handleTemplateChange}
          disabled={loadingTemplates}
          className={combinedClass}
          style={{
            width: '100%',
            padding: '10px 16px',
            borderRadius: 8,
            border: '1px solid #4b5563',
            background: '#111827',
            color: '#fff',
            outline: 'none',
            cursor: loadingTemplates ? 'not-allowed' : 'pointer',
            opacity: loadingTemplates ? 0.6 : 1,
            fontSize: 14,
            boxSizing: 'border-box'
          }}
        >
          <option value="">combo box con i template disponibili</option>
          {templates.map((template) => {
            const id = template._id || template.id;
            const label = template.label || template.name || 'Unnamed Template';
            return (
              <option key={id} value={id}>
                {label}
              </option>
            );
          })}
        </select>
      </div>

      {/* Separator */}
      <div style={{
        textAlign: 'center',
        marginBottom: 16,
        color: '#9ca3af',
        fontSize: 14,
        fontWeight: 500
      }}>
        oppure
      </div>

      <textarea
        ref={textareaRef}
        value={userDesc}
        onChange={e => {
          const newValue = e.target.value;
          console.log('[WIZARD_INPUT] 🔤 Text changed:', { newValue, length: newValue.length, trimmedLength: newValue.trim().length });
          setUserDesc(newValue);
          // NO auto-detect on typing - only on mount or "Invia" button
        }}
        placeholder={dataNode?.name || ''}
        rows={2}
        className={combinedClass}
        style={{
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
          className={combinedClass}
          style={{
            background: '#fff',
            color: '#000',
            border: '1px solid #000',
            borderRadius: 8,
            fontWeight: 600,
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
          className={combinedClass}
          style={{
            background: '#22c55e',
            color: '#fff',
            border: '1px solid #22c55e',
            borderRadius: 8,
            fontWeight: 600,
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