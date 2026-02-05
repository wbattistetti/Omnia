// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React from 'react';
import { ChevronDown } from 'lucide-react';
import { useFontContext } from '../../../context/FontContext';
import { getAllDialogueTemplates } from '../../../services/ProjectDataService';
import IconRenderer from './components/IconRenderer';
import { generateFriendlyWizardMessage } from '../../../utils/textTransformers';
import CompactDropdown from './CompactDropdown';
import WizardAI, { AccordionState } from './WizardAI';
import { SchemaNode } from './MainDataCollection';

interface Props {
  userDesc: string;
  setUserDesc: (v: string) => void;
  onNext: (text?: string) => void;
  onCancel: () => void;
  dataNode?: { name?: string; subData?: string[] };
  onAutoDetect?: (userDesc: string) => void;
  onTemplateSelect?: (template: any) => void;
  taskType?: string;
  taskLabel?: string;
  isCompactMode?: boolean;
  onConfirmTemplate?: () => void;
  // Props per WizardAI
  accordionState?: AccordionState;
  mountedDataTree?: SchemaNode[];
  schemaRootLabel?: string;
  onConfirmStructure?: () => void;
  onRefineStructure?: () => void;
  onEditManually?: () => void;
  onStructureChange?: (mains: SchemaNode[]) => void;
  showRefiningTextbox?: boolean;
  refiningText?: string;
  onRefiningTextChange?: (text: string) => void;
  onApplyRefining?: () => void;
  onCreateWithAI?: () => void;
  isAIGenerating?: boolean;
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
  onConfirmTemplate,
  accordionState = 'collapsed',
  mountedDataTree = [],
  schemaRootLabel = 'Data',
  onConfirmStructure,
  onRefineStructure,
  onEditManually,
  onStructureChange,
  showRefiningTextbox = false,
  refiningText = '',
  onRefiningTextChange,
  onApplyRefining,
  onCreateWithAI,
  isAIGenerating = false,
}) => {
  const { combinedClass } = useFontContext();
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const [templates, setTemplates] = React.useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<string>('');
  const [loadingTemplates, setLoadingTemplates] = React.useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);

  // Load templates
  React.useEffect(() => {
    const loadTemplates = async () => {
      setLoadingTemplates(true);
      try {
        const allTemplates = await getAllDialogueTemplates();
        let filtered = Array.isArray(allTemplates) ? [...allTemplates] : [];

        if (taskType && taskType !== 'UNDEFINED') {
          if (taskType === 'DataRequest') {
            filtered = filtered.filter(t => {
              const kind = t.kind || t.name || t.type || '';
              return kind !== 'intent';
            });
          } else if (taskType === 'ProblemClassification') {
            filtered = filtered.filter(t => {
              const kind = t.kind || t.name || t.type || '';
              return kind === 'intent';
            });
          }
        }

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
  }, [taskType]);

  // Auto-select template based on node label
  React.useEffect(() => {
    if (templates.length === 0 || !dataNode?.name) return;

    const nodeLabel = String(dataNode.name || '').toLowerCase().trim();
    if (!nodeLabel) return;

    for (const template of templates) {
      const templateId = template._id || template.id || template.name;
      const patterns = template.patterns;
      if (!patterns || typeof patterns !== 'object') continue;

      const langPatterns = patterns.IT || patterns.EN || patterns.PT;
      if (!Array.isArray(langPatterns)) continue;

      for (const patternStr of langPatterns) {
        try {
          const regex = new RegExp(patternStr, 'i');
          if (regex.test(nodeLabel)) {
            setSelectedTemplateId(templateId);
            if (onTemplateSelect) {
              onTemplateSelect(template);
            }
            return;
          }
        } catch (e) {
          continue;
        }
      }
    }
  }, [templates, dataNode?.name, onTemplateSelect]);

  const handleTemplateSelect = React.useCallback((templateId: string, template: any) => {
    setSelectedTemplateId(templateId);
    if (onTemplateSelect) {
      onTemplateSelect(template);
    }
  }, [onTemplateSelect]);

  // Event listener for prefill
  React.useEffect(() => {
    const handler = (e: any) => {
      const text = e?.detail?.text || '';
      try {
        setUserDesc(String(text || ''));
      } catch {}
      if (textareaRef.current) {
        textareaRef.current.value = String(text || '');
      }
    };
    document.addEventListener('taskWizard:prefillDesc', handler as any);
    return () => {
      document.removeEventListener('taskWizard:prefillDesc', handler as any);
    };
  }, [setUserDesc]);

  // COMPACT MODE: Geometria esatta richiesta
  if (isCompactMode) {
    const messageParts = taskLabel ? generateFriendlyWizardMessage(taskLabel) : {
      prefix: 'Non sono riuscito a trovare un modulo adatto per',
      boldPart: '',
      suffix: '.\nProva a vedere se tra quelli disponibili qui sotto ce n\'è uno che fa al caso tuo:'
    };

    const selectedTemplate = selectedTemplateId
      ? templates.find(t => (t._id || t.id || t.name) === selectedTemplateId)
      : null;
    const templateName = selectedTemplate ? (selectedTemplate.label || selectedTemplate.name || 'template') : '';

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100%',
          height: 'auto',
          padding: '20px 24px',
        }}
      >
        {/* Message */}
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

        {/* Dropdown */}
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

        {/* ChooseTemplateButton */}
        {selectedTemplateId && onConfirmTemplate && (
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
            }}
          >
            Usa <span style={{ fontWeight: 700 }}>{templateName}</span>
          </button>
        )}

        {/* WizardAI */}
        {!selectedTemplateId && (
          <WizardAI
            state={accordionState}
            structure={mountedDataTree}
            schemaRootLabel={schemaRootLabel}
            onConfirm={onConfirmStructure || (() => {})}
            onRefine={onRefineStructure || (() => {})}
            onEditManually={onEditManually || (() => {})}
            onStructureChange={onStructureChange}
            showRefiningTextbox={showRefiningTextbox}
            refiningText={refiningText}
            onRefiningTextChange={onRefiningTextChange}
            onApplyRefining={onApplyRefining}
            onCreateWithAI={onCreateWithAI}
            isAIGenerating={isAIGenerating}
          />
        )}

        {/* CancelButton */}
        <div style={{ marginTop: 'auto', paddingTop: 24 }}>
          <button
            onClick={onCancel}
            className={combinedClass}
            style={{
              background: 'transparent',
              color: '#94a3b8',
              border: 'none',
              fontWeight: 500,
              cursor: 'pointer',
              padding: '6px 12px',
              fontSize: 13,
            }}
          >
            annulla
          </button>
        </div>
      </div>
    );
  }

  // EXPANDED MODE: UI completa originale (mantenuta per compatibilità)
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
      <div style={{ marginBottom: 16 }}>
        <div style={{ position: 'relative', width: '100%' }}>
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
                      onClick={() => {
                        handleTemplateSelect(id, template);
                        setIsDropdownOpen(false);
                      }}
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
