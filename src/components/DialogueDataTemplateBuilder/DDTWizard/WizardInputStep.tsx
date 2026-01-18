import React from 'react';
import { Calendar, Bell, ChevronDown } from 'lucide-react';
import { useFontContext } from '../../../context/FontContext';
import { getAllDialogueTemplates } from '../../../services/ProjectDataService';
import IconRenderer from './components/IconRenderer';

interface Props {
  userDesc: string;
  setUserDesc: (v: string) => void;
  onNext: (text?: string) => void; // ✅ MODIFICATO: accetta parametro opzionale per testo combinato
  onCancel: () => void;
  dataNode?: { name?: string; subData?: string[] };
  onAutoDetect?: (userDesc: string) => void; // Nuovo prop per auto-rilevamento
  onTemplateSelect?: (template: any) => void; // Callback quando viene selezionato un template
  taskType?: string; // ✅ Tipo task per filtrare template (DataRequest, ProblemClassification, UNDEFINED)
  taskLabel?: string; // ✅ LOGICA CORRETTA: nello step 'input', dataNode è vuoto, quindi taskLabel è la fonte primaria
}

const WizardInputStep: React.FC<Props> = ({
  userDesc,
  setUserDesc,
  onNext,
  onCancel,
  dataNode,
  onAutoDetect,
  onTemplateSelect,
  taskType,
  taskLabel
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

        // ✅ Filtra template per tipo se Euristica 1 ha trovato un tipo
        let filtered = Array.isArray(allTemplates) ? [...allTemplates] : [];

        if (taskType && taskType !== 'UNDEFINED') {
          // Se Euristica 1 ha trovato un tipo, filtra i template
          if (taskType === 'DataRequest') {
            // DataRequest: mostra solo template DDT normali (non intent)
            filtered = filtered.filter(t => {
              // I template DDT normali non hanno kind === 'intent'
              // Verifica se il template ha kind o se è un template DDT standard
              const kind = t.kind || t.name || t.type || '';
              return kind !== 'intent';
            });
          } else if (taskType === 'ProblemClassification') {
            // ProblemClassification: mostra solo template con kind === 'intent'
            filtered = filtered.filter(t => {
              const kind = t.kind || t.name || t.type || '';
              return kind === 'intent';
            });
          }
          // Altri tipi: mostra tutti (o nessuno, a seconda della logica)
        }
        // Se taskType è UNDEFINED o non specificato, mostra tutti i template

        // Sort templates alphabetically by label
        const sorted = filtered.sort((a, b) => {
          const labelA = (a.label || a.name || '').toLowerCase();
          const labelB = (b.label || b.name || '').toLowerCase();
          return labelA.localeCompare(labelB);
        });

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

    // ✅ FIX: Converti a stringa per evitare errori se dataNode.name è un oggetto
    const nodeLabel = String(dataNode.name || '').toLowerCase().trim();
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
      // ✅ FIX: Assicura che text sia sempre una stringa
      try { setUserDesc(String(text || '')); } catch { }
      if (textareaRef.current) {
        textareaRef.current.value = String(text || '');
      }
    };
    document.addEventListener('ddtWizard:prefillDesc', handler as any);
    return () => {
      document.removeEventListener('ddtWizard:prefillDesc', handler as any);
      console.log('[DDT][WizardInputStep][unmount]');
    };
  }, [setUserDesc, onAutoDetect, userDesc, dataNode?.name]);

  // ✅ FIX: NON inizializzare userDesc con dataNode?.name per evitare duplicazione
  // La textarea deve rimanere vuota per dettagli opzionali
  // La concatenazione avverrà solo quando l'utente clicca "Continua"
  React.useEffect(() => {
    // ✅ Solo assicurarsi che textareaRef.current.value sia una stringa (non un oggetto)
    if (textareaRef.current && typeof textareaRef.current.value !== 'string') {
      textareaRef.current.value = '';
    }
    console.log('[WIZARD_INPUT][INIT] ════════════════════════════════════════');
  }, [dataNode?.name, userDesc]);

  // ✅ Trigger auto-detect when userDesc becomes non-empty for the first time
  // ⚠️ IMPORTANTE: NON triggerare se onAutoDetect è undefined (c'è già un risultato di inferenza)
  const hasAutoDetectedRef = React.useRef<string>('');
  React.useEffect(() => {
    console.log('[WIZARD_INPUT][AUTO_DETECT_TRIGGER] ════════════════════════════════════════');
    console.log('[WIZARD_INPUT][AUTO_DETECT_TRIGGER] 🎯 Checking if should auto-detect', {
      timestamp: new Date().toISOString(),
      userDesc,
      trimmed: (userDesc || '').trim(),
      trimmedLength: (userDesc || '').trim().length,
      hasOnAutoDetect: !!onAutoDetect,
      hasAutoDetected: hasAutoDetectedRef.current,
      dataNodeName: dataNode?.name,
      skipReason: !onAutoDetect ? 'inference result already available' : 'none'
    });

    const trimmed = (userDesc || '').trim();
    // ✅ NON triggerare se onAutoDetect è undefined (significa che c'è già un risultato di inferenza)
    const shouldTrigger = trimmed.length >= 3 && onAutoDetect && trimmed !== hasAutoDetectedRef.current;

    console.log('[WIZARD_INPUT][AUTO_DETECT_TRIGGER] 📊 Conditions check', {
      trimmedLengthOk: trimmed.length >= 3,
      hasOnAutoDetect: !!onAutoDetect,
      notAlreadyDetected: trimmed !== hasAutoDetectedRef.current,
      shouldTrigger
    });

    // Only trigger if text is long enough, callback exists, and we haven't already processed this text
    if (shouldTrigger) {
      console.log('[WIZARD_INPUT][AUTO_DETECT_TRIGGER] ✅ TRIGGERING auto-detect!', {
        trimmed,
        timestamp: new Date().toISOString(),
        delay: '100ms (component mount delay)'
      });
      hasAutoDetectedRef.current = trimmed;

      // Small delay just to ensure component is fully mounted and state is stable
      const timer = setTimeout(() => {
        console.log('[WIZARD_INPUT][AUTO_DETECT_TRIGGER] ⏰ Timer fired, calling onAutoDetect NOW', {
          trimmed,
          timestamp: new Date().toISOString(),
          elapsed: '100ms after mount'
        });
        onAutoDetect(trimmed);
      }, 100);
      return () => {
        console.log('[WIZARD_INPUT][AUTO_DETECT_TRIGGER] 🧹 Cleanup: clearing timer');
        clearTimeout(timer);
      };
    } else {
      console.log('[WIZARD_INPUT][AUTO_DETECT_TRIGGER] ⏭️ NOT triggering auto-detect', {
        reason: !trimmed.length || trimmed.length < 3 ? 'text too short' :
                !onAutoDetect ? 'no callback' :
                trimmed === hasAutoDetectedRef.current ? 'already detected' : 'unknown'
      });
    }
    console.log('[WIZARD_INPUT][AUTO_DETECT_TRIGGER] ════════════════════════════════════════');
  }, [userDesc, onAutoDetect, dataNode?.name]); // Run when userDesc or onAutoDetect changes

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
      {/* ✅ RIMOSSO: Header con didascalia sopra i campi */}

      {/* Template Selection Combobox */}
      <div style={{ marginBottom: 16 }}>
        {/* ✅ RIMOSSO: Label "Scegli il tipo di dato" */}
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
                return <span style={{ color: '#9ca3af' }}>Scegli uno dei data template disponibili ...</span>;
              })() : (
                <span style={{ color: '#9ca3af' }}>Scegli uno dei data template disponibili ...</span>
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
          // ✅ FIX: Assicura che newValue sia sempre una stringa
          setUserDesc(String(newValue || ''));
          // NO auto-detect on typing - only on mount or "Invia" button
        }}
        placeholder="(opzionale) puoi indicare altri dettagli di ciò che vuoi chiedere anche facendo degli esempi"
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
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              // ✅ LOGICA CORRETTA: nello step 'input', dataNode è vuoto, quindi taskLabel è la fonte primaria
              const nodeLabel = String(taskLabel || '').trim();
              const userDetails = String(userDesc || '').trim();
              const combinedText = nodeLabel && userDetails
                ? `${nodeLabel} ${userDetails}`
                : nodeLabel || userDetails;

              if (combinedText && combinedText !== '[object Object]') {
                console.log('[WIZARD_INPUT] ⏎ Enter pressed with combined text:', combinedText);
                try { console.log('[DDT][WizardInputStep][submit][Enter]'); } catch { };
                onNext(combinedText);
              }
            }
          }}
        autoFocus
      />
      {/* ✅ MODIFICATO: Layout pulsanti affiancati */}
      <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: '12px', marginTop: 8 }}>
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
        {/* ✅ MODIFICATO: Pulsante Continua (a sinistra accanto ad Annulla) */}
        <button
          onClick={() => {
            // ✅ LOGICA CORRETTA: nello step 'input', dataNode è vuoto, quindi taskLabel è la fonte primaria
            const nodeLabel = String(taskLabel || '').trim();
            const userDetails = String(userDesc || '').trim();
            const combinedText = nodeLabel && userDetails
              ? `${nodeLabel} ${userDetails}`
              : nodeLabel || userDetails;

            console.log('[WIZARD_INPUT] 🖱️ Continua clicked', {
              nodeLabel,
              userDetails,
              combinedText,
              taskLabel,
              hasTaskLabel: !!taskLabel
            });

            if (combinedText && combinedText !== '[object Object]') {
              try { console.log('[DDT][WizardInputStep][submit][Click]'); } catch { };
              onNext(combinedText);
            } else {
              console.error('[WIZARD_INPUT] ❌ Invalid combinedText:', {
                combinedText,
                nodeLabel,
                userDetails,
                taskLabel
              });
            }
          }}
          disabled={!(String(taskLabel || '').trim() || String(userDesc || '').trim())}
          className={combinedClass}
          style={{
            background: '#22c55e',
            color: '#fff',
            border: '1px solid #22c55e',
            borderRadius: 8,
            fontWeight: 600,
            cursor: (String(taskLabel || '').trim() || String(userDesc || '').trim()) ? 'pointer' : 'not-allowed',
            padding: '8px 28px',
            opacity: (String(taskLabel || '').trim() || String(userDesc || '').trim()) ? 1 : 0.6,
            transition: 'opacity 0.2s',
          }}
        >
          Continua
        </button>
      </div>
    </div>
  );
};

export default WizardInputStep;