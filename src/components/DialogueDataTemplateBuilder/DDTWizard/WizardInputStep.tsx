import React from 'react';
import { Calendar, Bell, ChevronDown } from 'lucide-react';
import { useFontContext } from '../../../context/FontContext';
import { getAllDialogueTemplates } from '../../../services/ProjectDataService';
import IconRenderer from './components/IconRenderer';

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
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Load templates on mount and sort alphabetically
  React.useEffect(() => {
    const loadTemplates = async () => {
      setLoadingTemplates(true);
      try {
        const allTemplates = await getAllDialogueTemplates();
        console.log('[WIZARD_INPUT][LOAD] Raw templates from API:', allTemplates);

        // Sort templates alphabetically by label
        const sorted = Array.isArray(allTemplates)
          ? [...allTemplates].sort((a, b) => {
              const labelA = (a.label || a.name || '').toLowerCase();
              const labelB = (b.label || b.name || '').toLowerCase();
              return labelA.localeCompare(labelB);
            })
          : [];

        console.log('[WIZARD_INPUT][LOAD] Sorted templates:', sorted.map(t => ({
          id: t._id || t.id || t.name,
          label: t.label || t.name,
          hasPatterns: !!t.patterns,
          patternsKeys: t.patterns ? Object.keys(t.patterns) : [],
          patternsIT: t.patterns?.IT,
          patternsEN: t.patterns?.EN,
          patternsPT: t.patterns?.PT
        })));

        setTemplates(sorted);
        console.log('[WIZARD_INPUT][LOAD] Loaded templates:', sorted.length);
      } catch (err) {
        console.error('[WIZARD_INPUT][LOAD] Failed to load templates:', err);
        setTemplates([]);
      } finally {
        setLoadingTemplates(false);
      }
    };
    loadTemplates();
  }, []);

  // Auto-select template based on node label using patterns
  React.useEffect(() => {
    console.log('[WIZARD_INPUT][PATTERN_MATCH] Starting pattern matching', {
      templatesCount: templates.length,
      dataNodeName: dataNode?.name,
      hasDataNode: !!dataNode
    });

    if (templates.length === 0) {
      console.log('[WIZARD_INPUT][PATTERN_MATCH] No templates loaded, skipping');
      return;
    }

    if (!dataNode?.name) {
      console.log('[WIZARD_INPUT][PATTERN_MATCH] No dataNode.name, skipping');
      return;
    }

    const nodeLabel = dataNode.name.toLowerCase().trim();
    if (!nodeLabel) {
      console.log('[WIZARD_INPUT][PATTERN_MATCH] Empty nodeLabel after trim, skipping');
      return;
    }

    console.log('[WIZARD_INPUT][PATTERN_MATCH] Node label to match:', nodeLabel);
    console.log('[WIZARD_INPUT][PATTERN_MATCH] Available templates:', templates.map(t => ({
      id: t._id || t.id || t.name,
      label: t.label || t.name,
      hasPatterns: !!t.patterns,
      patterns: t.patterns
    })));

    // Try to match node label with template patterns
    for (const template of templates) {
      const templateId = template._id || template.id || template.name;
      const templateLabel = template.label || template.name || 'Unknown';

      console.log(`[WIZARD_INPUT][PATTERN_MATCH] Testing template: ${templateLabel} (${templateId})`);

      const patterns = template.patterns;
      if (!patterns || typeof patterns !== 'object') {
        console.log(`[WIZARD_INPUT][PATTERN_MATCH] Template ${templateLabel} has no patterns or invalid patterns object:`, patterns);
        continue;
      }

      console.log(`[WIZARD_INPUT][PATTERN_MATCH] Template ${templateLabel} patterns object:`, patterns);

      // Try IT first (default), then EN, PT
      const langPatterns = patterns.IT || patterns.EN || patterns.PT;
      if (!Array.isArray(langPatterns)) {
        console.log(`[WIZARD_INPUT][PATTERN_MATCH] Template ${templateLabel} has no valid langPatterns array:`, langPatterns);
        continue;
      }

      console.log(`[WIZARD_INPUT][PATTERN_MATCH] Template ${templateLabel} langPatterns (${langPatterns.length} patterns):`, langPatterns);

      // Test each pattern regex
      for (let i = 0; i < langPatterns.length; i++) {
        const patternStr = langPatterns[i];
        console.log(`[WIZARD_INPUT][PATTERN_MATCH] Testing pattern ${i + 1}/${langPatterns.length} for ${templateLabel}:`, patternStr);

        try {
          const regex = new RegExp(patternStr, 'i');
          const testResult = regex.test(nodeLabel);
          console.log(`[WIZARD_INPUT][PATTERN_MATCH] Pattern "${patternStr}" test result:`, testResult, {
            pattern: patternStr,
            nodeLabel: nodeLabel,
            match: testResult
          });

          if (testResult) {
            console.log('[WIZARD_INPUT][PATTERN_MATCH] ✅ MATCH FOUND!', {
              nodeLabel,
              templateLabel,
              templateId,
              pattern: patternStr
            });

            setSelectedTemplateId(templateId);
            // Optionally auto-select the template
            if (onTemplateSelect) {
              console.log('[WIZARD_INPUT][PATTERN_MATCH] Calling onTemplateSelect with:', template);
              onTemplateSelect(template);
            }
            return; // Found match, stop searching
          }
        } catch (e) {
          // Invalid regex, skip
          console.warn(`[WIZARD_INPUT][PATTERN_MATCH] Invalid pattern regex for ${templateLabel}:`, patternStr, e);
          continue;
        }
      }

      console.log(`[WIZARD_INPUT][PATTERN_MATCH] No match found for template ${templateLabel}`);
    }

    console.log('[WIZARD_INPUT][PATTERN_MATCH] ❌ No template pattern match found for:', nodeLabel);
  }, [templates, dataNode?.name, onTemplateSelect]);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  // Handle template selection
  const handleTemplateSelect = React.useCallback((templateId: string) => {
    setSelectedTemplateId(templateId);
    setIsDropdownOpen(false);

    if (templateId && onTemplateSelect) {
      const selectedTemplate = templates.find(t => (t._id || t.id || t.name) === templateId);
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
        <div ref={dropdownRef} style={{ position: 'relative', width: '100%' }}>
          {/* Custom dropdown button */}
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
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
              boxSizing: 'border-box',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
              {selectedTemplateId ? (() => {
                const selected = templates.find(t => (t._id || t.id || t.name) === selectedTemplateId);
                if (selected) {
                  const icon = selected.icon || 'FileText';
                  const label = selected.label || selected.name || 'Unnamed Template';
                  return (
                    <>
                      <IconRenderer name={icon} size={16} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
                    </>
                  );
                }
                return <span style={{ color: '#9ca3af' }}>combo box con i template disponibili</span>;
              })() : (
                <span style={{ color: '#9ca3af' }}>combo box con i template disponibili</span>
              )}
            </div>
            <ChevronDown
              size={16}
              style={{
                transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s',
                flexShrink: 0
              }}
            />
          </button>

          {/* Dropdown menu */}
          {isDropdownOpen && !loadingTemplates && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: '4px',
                borderRadius: 8,
                border: '1px solid #4b5563',
                background: '#111827',
                maxHeight: '300px',
                overflowY: 'auto',
                zIndex: 1000,
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)'
              }}
            >
              {templates.length === 0 ? (
                <div style={{ padding: '12px 16px', color: '#9ca3af', fontSize: 14 }}>
                  Nessun template disponibile
                </div>
              ) : (
                templates.map((template) => {
                  const id = template._id || template.id || template.name;
                  const label = template.label || template.name || 'Unnamed Template';
                  const icon = template.icon || 'FileText';
                  const isSelected = selectedTemplateId === id;

                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => handleTemplateSelect(id)}
                      className={combinedClass}
                      style={{
                        width: '100%',
                        padding: '10px 16px',
                        border: 'none',
                        background: isSelected ? '#1f2937' : 'transparent',
                        color: '#fff',
                        fontSize: 14,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        textAlign: 'left',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.background = '#1f2937';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.background = 'transparent';
                        }
                      }}
                    >
                      <IconRenderer name={icon} size={16} />
                      <span style={{ flex: 1 }}>{label}</span>
                      {isSelected && (
                        <span style={{ color: '#22c55e', fontSize: 12 }}>✓</span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
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