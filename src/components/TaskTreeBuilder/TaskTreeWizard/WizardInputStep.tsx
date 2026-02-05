import React from 'react';
import { Calendar, Bell, ChevronDown, Sparkles } from 'lucide-react';
import { useFontContext } from '../../../context/FontContext';
import { getAllDialogueTemplates } from '../../../services/ProjectDataService';
import IconRenderer from './components/IconRenderer';
import { generateFriendlyWizardMessage } from '../../../utils/textTransformers';
import CompactDropdown from './CompactDropdown';

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
  isCompactMode?: boolean; // ✅ NUOVO: Modalità compatta iniziale
  isAIGenerating?: boolean; // ✅ NUOVO: Stato generazione AI
  onCreateWithAI?: () => void; // ✅ NUOVO: Callback per pulsante "Crea" (AI)
  onConfirmTemplate?: () => void; // ✅ NUOVO: Callback per pulsante "Conferma" (template)
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
  taskLabel,
  isCompactMode = false,
  isAIGenerating = false,
  onCreateWithAI,
  onConfirmTemplate
}) => {
  const { combinedClass } = useFontContext();
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const autoDetectTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const [templates, setTemplates] = React.useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<string>('');
  const [loadingTemplates, setLoadingTemplates] = React.useState(false);

  // Load templates on mount and sort alphabetically
  React.useEffect(() => {
    const loadTemplates = async () => {
      setLoadingTemplates(true);
      try {
        const allTemplates = await getAllDialogueTemplates();
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

        setTemplates(sorted);
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
    if (templates.length === 0) {
      return;
    }

    if (!dataNode?.name) {
      return;
    }

    // ✅ FIX: Converti a stringa per evitare errori se dataNode.name è un oggetto
    const nodeLabel = String(dataNode.name || '').toLowerCase().trim();
    if (!nodeLabel) {
      return;
    }

    // Try to match node label with template patterns
    for (const template of templates) {
      const templateId = template._id || template.id || template.name;
      const templateLabel = template.label || template.name || 'Unknown';

      const patterns = template.patterns;
      if (!patterns || typeof patterns !== 'object') {
        continue;
      }

      // Try IT first (default), then EN, PT
      const langPatterns = patterns.IT || patterns.EN || patterns.PT;
      if (!Array.isArray(langPatterns)) {
        continue;
      }

      // Test each pattern regex
      for (let i = 0; i < langPatterns.length; i++) {
        const patternStr = langPatterns[i];

        try {
          const regex = new RegExp(patternStr, 'i');
          const testResult = regex.test(nodeLabel);

          if (testResult) {
            setSelectedTemplateId(templateId);
            // Optionally auto-select the template
            if (onTemplateSelect) {
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
    }
  }, [templates, dataNode?.name, onTemplateSelect]);


  // Handle template selection from CompactDropdown
  const handleTemplateSelect = React.useCallback((templateId: string, template: any) => {
    setSelectedTemplateId(templateId);
    if (onTemplateSelect) {
      onTemplateSelect(template);
    }
  }, [onTemplateSelect]);

  // Auto-detect function - NO DEBOUNCE, called only on mount or explicit trigger
  const handleAutoDetect = React.useCallback((text: string) => {
    const trimmed = text.trim();
    if (trimmed.length >= 3 && onAutoDetect) {
      onAutoDetect(trimmed);
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
    const handler = (e: any) => {
      const text = e?.detail?.text || '';
      // ✅ FIX: Assicura che text sia sempre una stringa
      try { setUserDesc(String(text || '')); } catch { }
      if (textareaRef.current) {
        textareaRef.current.value = String(text || '');
      }
    };
    document.addEventListener('taskWizard:prefillDesc', handler as any);
    return () => {
      document.removeEventListener('taskWizard:prefillDesc', handler as any);
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
  }, [dataNode?.name, userDesc]);

  // ✅ Trigger auto-detect when userDesc becomes non-empty for the first time
  // ⚠️ IMPORTANTE: NON triggerare se onAutoDetect è undefined (c'è già un risultato di inferenza)
  const hasAutoDetectedRef = React.useRef<string>('');
  React.useEffect(() => {
    const trimmed = (userDesc || '').trim();
    // ✅ NON triggerare se onAutoDetect è undefined (significa che c'è già un risultato di inferenza)
    const shouldTrigger = trimmed.length >= 3 && onAutoDetect && trimmed !== hasAutoDetectedRef.current;

    // Only trigger if text is long enough, callback exists, and we haven't already processed this text
    if (shouldTrigger) {
      hasAutoDetectedRef.current = trimmed;

      // Small delay just to ensure component is fully mounted and state is stable
      const timer = setTimeout(() => {
        onAutoDetect(trimmed);
      }, 100);
      return () => {
        clearTimeout(timer);
      };
    }
  }, [userDesc, onAutoDetect, dataNode?.name]); // Run when userDesc or onAutoDetect changes

  // ✅ MODALITÀ COMPATTA: UI completamente riscritta
  if (isCompactMode) {
    const messageParts = taskLabel ? generateFriendlyWizardMessage(taskLabel) : {
      prefix: 'Non sono riuscito a trovare un modulo adatto per',
      boldPart: '',
      suffix: '.\nProva a vedere se tra quelli disponibili qui sotto ce n\'è uno che fa al caso tuo:'
    };
    const showChooseThisButton = selectedTemplateId !== '' && !isAIGenerating;

    // Trova il nome del template selezionato
    const selectedTemplate = selectedTemplateId
      ? templates.find(t => (t._id || t.id || t.name) === selectedTemplateId)
      : null;
    const templateName = selectedTemplate ? (selectedTemplate.label || selectedTemplate.name || 'template') : '';

    return (
      <div
        style={{
          background: 'transparent',
          border: 'none',
          borderRadius: 0,
          padding: '20px 24px',
          maxWidth: 'unset',
          margin: 0,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          justifyContent: 'space-between',
        }}
      >
        <div>
          {/* Messaggio amichevole con parte in grassetto */}
          <p
            style={{
              color: '#e2e8f0',
              fontSize: 15,
              lineHeight: 1.6,
              marginBottom: 20,
              fontWeight: 400,
              whiteSpace: 'pre-line',
            }}
          >
            {messageParts.prefix}{' '}
            <span style={{ fontWeight: 700 }}>{messageParts.boldPart}</span>
            {messageParts.suffix}
          </p>

          {/* CompactDropdown - full width */}
          <div style={{ marginBottom: 16, width: '100%' }}>
            <CompactDropdown
              placeholder="Clicca per vedere i moduli disponibili"
              templates={templates}
              selectedTemplateId={selectedTemplateId}
              loading={loadingTemplates}
              onSelect={handleTemplateSelect}
              disabled={templates.length === 0}
            />
          </div>

          {/* Pulsante "Usa <nomeTemplate>" - full width, solo se template selezionato */}
          {showChooseThisButton && onConfirmTemplate && (
            <button
              onClick={onConfirmTemplate}
              className={combinedClass}
              style={{
                width: '100%',
                background: '#3b82f6',
                color: '#fff',
                border: '1px solid #3b82f6',
                borderRadius: 8,
                fontWeight: 600,
                cursor: 'pointer',
                padding: '10px 20px',
                marginBottom: 16,
                fontSize: 14,
                transition: 'opacity 0.2s',
              }}
            >
              Usa <span style={{ fontWeight: 700 }}>{templateName}</span>
            </button>
          )}

          {/* Pulsante "Oppure clicca qui e ne creo uno nuovo per te" - full width */}
          {onCreateWithAI && (
            <button
              onClick={onCreateWithAI}
              disabled={isAIGenerating}
              className={combinedClass}
              style={{
                width: '100%',
                background: 'transparent',
                color: '#22c55e',
                border: '1px solid #22c55e',
                borderRadius: 8,
                fontWeight: 500,
                cursor: isAIGenerating ? 'not-allowed' : 'pointer',
                padding: '10px 20px',
                marginBottom: 16,
                opacity: isAIGenerating ? 0.6 : 1,
                fontSize: 14,
                transition: 'opacity 0.2s',
              }}
            >
              Oppure clicca qui e ne creo uno nuovo per te
            </button>
          )}
        </div>

        {/* Pulsante "annulla" - più piccolo, in basso, distanziato */}
        <div style={{ marginTop: 24, textAlign: 'left' }}>
          <button
            onClick={onCancel}
            disabled={isAIGenerating}
            className={combinedClass}
            style={{
              background: 'transparent',
              color: '#94a3b8',
              border: 'none',
              fontWeight: 500,
              cursor: isAIGenerating ? 'not-allowed' : 'pointer',
              padding: '6px 12px',
              opacity: isAIGenerating ? 0.6 : 1,
              fontSize: 13,
              transition: 'opacity 0.2s',
            }}
          >
            annulla
          </button>
        </div>
      </div>
    );
  }

  // ✅ MODALITÀ ESPANSA: UI completa originale
  return (
    <div
      style={{
        background: 'transparent',
        border: 'none',
        borderRadius: 0,
        padding: '16px 20px',
        maxWidth: 'unset',
        margin: 0,
        boxSizing: 'border-box',
      }}
    >
      {/* Template Selection Combobox */}
      <div style={{ marginBottom: 16 }}>
        <div ref={dropdownRef} style={{ position: 'relative', width: '100%' }}>
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
          setUserDesc(String(newValue || ''));
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
            const nodeLabel = String(taskLabel || '').trim();
            const userDetails = String(userDesc || '').trim();
            const combinedText = nodeLabel && userDetails
              ? `${nodeLabel} ${userDetails}`
              : nodeLabel || userDetails;

            if (combinedText && combinedText !== '[object Object]') {
              onNext(combinedText);
            }
          }
        }}
        autoFocus
      />
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
        <button
          onClick={() => {
            const nodeLabel = String(taskLabel || '').trim();
            const userDetails = String(userDesc || '').trim();
            const combinedText = nodeLabel && userDetails
              ? `${nodeLabel} ${userDetails}`
              : nodeLabel || userDetails;

            if (combinedText && combinedText !== '[object Object]') {
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