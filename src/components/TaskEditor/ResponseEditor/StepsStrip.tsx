import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { stepMeta } from './ddtUtils';
import { Shield, Check, Trash2, X, Plus, ChevronDown } from 'lucide-react';
import { useFontContext } from '@context/FontContext';
import { useResponseEditorContext } from '@responseEditor/context/ResponseEditorContext';
import { taskRepository } from '@services/TaskRepository';
import { DialogueTaskService } from '@services/DialogueTaskService';
import { StepType, STEP_ORDER, getStepOrder } from '@types/stepTypes';

interface StepsStripProps {
  stepKeys: string[];
  selectedStepKey: string;
  onSelectStep: (stepKey: string) => void;
  node?: any; // optional, used to label constraint steps with AI-provided titles
  taskId?: string; // optional, used for toolbar functionality
}

export default function StepsStrip({ stepKeys, selectedStepKey, onSelectStep, node, taskId }: StepsStripProps) {
  const { combinedClass } = useFontContext();
  const { taskId: contextTaskId } = useResponseEditorContext();
  const effectiveTaskId = taskId || contextTaskId;

  // State per hover e toolbar
  const [hoveredStepKey, setHoveredStepKey] = useState<string | null>(null);
  const [toolbarPositions, setToolbarPositions] = useState<Record<string, { top: number; left: number }>>({});
  const buttonRefs = useRef<Record<string, HTMLButtonElement>>({});

  // State per restore dropdown
  const [showRestoreDropdown, setShowRestoreDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const restoreButtonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null);

  // ✅ State per forzare ri-render quando taskInstance.steps cambia
  const [taskVersion, setTaskVersion] = useState(0);

  if (!stepKeys.length) {
    return null;
  }

  // DEBUG: Verifica che stepKeys sia un array
  if (!Array.isArray(stepKeys)) {
    console.error('[StepsStrip] ERROR - stepKeys is not an array!', { stepKeys, type: typeof stepKeys });
    return null;
  }

  const baseLabels: Record<string, string> = {
    start: 'Chiedo il dato',
    introduction: 'Introduzione',
    noMatch: 'Non capisco',
    noInput: 'Non sento',
    confirmation: 'Devo confermare',
    notConfirmed: 'Non Confermato',
    invalid: 'Non valido',
    success: 'Ho capito!'
  };

  const colorForStep = (key: string): string => {
    if ((stepMeta as any)[key]?.color) return (stepMeta as any)[key].color;
    if (/^constraint\./.test(key)) return '#fb923c';
    return '#7c3aed';
  };

  const iconForStep = (key: string): React.ReactNode => {
    if ((stepMeta as any)[key]?.icon) return (stepMeta as any)[key].icon;
    if (/^constraint\./.test(key)) return <Shield size={14} />;
    return null;
  };

  const getFriendlyLabel = (key: string): string => {
    if (baseLabels[key]) return baseLabels[key];
    const m = key.match(/^constraint\.(.+?)\.(r1|r2)$/);
    if (m && node && Array.isArray(node.constraints)) {
      const kind = m[1];
      const r = m[2];
      const c = node.constraints.find((x: any) => (x?.kind || '').toString() === kind);
      if (c && c.title) return `rule: ${c.title} ${r}`;
      if (c) return `rule: ${kind} ${r}`;
    }
    return key;
  };

  // Calcola posizione toolbar per un step
  const updateToolbarPosition = (stepKey: string) => {
    const button = buttonRefs.current[stepKey];
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const toolbarWidth = 60;
    setToolbarPositions(prev => ({
      ...prev,
      [stepKey]: {
        top: rect.top - 40,
        left: rect.right - toolbarWidth,
      }
    }));
  };

  // Listener per scroll e resize quando c'è hover
  useEffect(() => {
    if (hoveredStepKey) {
      updateToolbarPosition(hoveredStepKey);
      window.addEventListener('scroll', () => updateToolbarPosition(hoveredStepKey), true);
      window.addEventListener('resize', () => updateToolbarPosition(hoveredStepKey));

      return () => {
        window.removeEventListener('scroll', () => updateToolbarPosition(hoveredStepKey), true);
        window.removeEventListener('resize', () => updateToolbarPosition(hoveredStepKey));
      };
    }
  }, [hoveredStepKey]);

  // Gestione hover
  const handleMouseEnter = (stepKey: string) => {
    setHoveredStepKey(stepKey);
    setTimeout(() => updateToolbarPosition(stepKey), 0);
  };

  const handleMouseLeave = () => {
    setHoveredStepKey(null);
  };

  // Verifica se uno step è disabilitato o eliminato
  const getStepState = (stepKey: string) => {
    if (!effectiveTaskId || !node) return { isDisabled: false, isDeleted: false };

    const nodeTemplateId = node?.templateId || node?.id;
    const taskInstance = taskRepository.getTask(effectiveTaskId);
    if (!taskInstance) return { isDisabled: false, isDeleted: false };

    const nodeSteps = taskInstance?.steps?.[nodeTemplateId] || {};
    const stepData = nodeSteps[stepKey];
    const isDisabled = stepData?._disabled === true;
    const isDeleted = !stepData;

    return { isDisabled, isDeleted };
  };

  // Handler per toggle disabled
  const handleToggleDisabled = (stepKey: string) => {
    if (!effectiveTaskId || !node) return;
    const nodeTemplateId = node?.templateId || node?.id;
    const task = taskRepository.getTask(effectiveTaskId);
    if (!task) return;

    const currentSteps = task.steps || {};
    const currentNodeSteps = currentSteps[nodeTemplateId] || {};
    const currentStepData = currentNodeSteps[stepKey];

    if (currentStepData) {
      const newDisabledValue = !currentStepData._disabled;
      const updatedStepData = {
        ...currentStepData,
        _disabled: newDisabledValue
      };

      taskRepository.updateTask(effectiveTaskId, {
        steps: {
          ...currentSteps,
          [nodeTemplateId]: {
            ...currentNodeSteps,
            [stepKey]: updatedStepData
          }
        }
      });

      // Force re-render
      setTaskVersion(prev => prev + 1);
    }
  };


  // Step obbligatori che non possono essere disattivati o eliminati
  const mandatorySteps = ['start'];
  const isStepMandatory = (stepKey: string) => mandatorySteps.includes(stepKey);

  // ✅ Calcola step disabilitati che possono essere ripristinati
  const restorableSteps = React.useMemo(() => {
    if (!effectiveTaskId || !node) return [];

    const nodeTemplateId = node?.templateId || node?.id;
    if (!nodeTemplateId) return [];

    const taskInstance = taskRepository.getTask(effectiveTaskId);
    if (!taskInstance) return [];

    const instanceSteps = taskInstance.steps?.[nodeTemplateId] || {};

    // ✅ Step da ripristinare: presenti nell'istanza ma disabilitati (_disabled === true)
    const disabled: Array<{ stepKey: string; stepData: any }> = [];

    Object.keys(instanceSteps).forEach(stepKey => {
      const stepData = instanceSteps[stepKey];
      if (stepData && stepData._disabled === true) {
        // ✅ Step disabilitato = può essere ripristinato
        disabled.push({
          stepKey,
          stepData
        });
      }
    });

    // ✅ Ordina per STEP_ORDER (per UX)
    return disabled.sort((a, b) => {
      return getStepOrder(a.stepKey) - getStepOrder(b.stepKey);
    });
  }, [effectiveTaskId, node, taskVersion]); // ✅ Aggiungi taskVersion come dipendenza

  // Filter stepKeys to show only steps that are enabled (not disabled)
  const visibleStepKeys = React.useMemo(() => {
    if (!effectiveTaskId || !node) return stepKeys;

    const nodeTemplateId = node?.templateId || node?.id;
    if (!nodeTemplateId) return stepKeys;

    const taskInstance = taskRepository.getTask(effectiveTaskId);
    if (!taskInstance) return stepKeys;

    const instanceSteps = taskInstance.steps?.[nodeTemplateId] || {};

    // Show only steps that exist in instance AND are not disabled
    return stepKeys.filter(stepKey => {
      const stepData = instanceSteps[stepKey];
      return stepData && stepData._disabled !== true;
    });
  }, [stepKeys, effectiveTaskId, node, taskVersion]);

  // Handler per ripristinare step (imposta _disabled: false)
  const handleRestoreStep = (stepKey: string, stepData: any) => {
    if (!effectiveTaskId || !node) return;
    const nodeTemplateId = node?.templateId || node?.id;
    const task = taskRepository.getTask(effectiveTaskId);
    if (!task) return;

    const currentSteps = task.steps || {};
    const currentNodeSteps = currentSteps[nodeTemplateId] || {};
    const currentStepData = currentNodeSteps[stepKey];

    if (currentStepData) {
      // ✅ Semplicemente imposta _disabled: false
      const updatedStepData = {
        ...currentStepData,
        _disabled: false
      };
      taskRepository.updateTask(effectiveTaskId, {
        steps: {
          ...currentSteps,
          [nodeTemplateId]: {
            ...currentNodeSteps,
            [stepKey]: updatedStepData
          }
        }
      });

      // ✅ Forza ri-render aggiornando taskVersion
      setTaskVersion(prev => prev + 1);
    }

    setShowRestoreDropdown(false);
  };

  // Handler per cancellazione definitiva (rimuove lo step dalla struttura)
  const handlePermanentDelete = (stepKey: string) => {
    if (!effectiveTaskId || !node) return;
    const nodeTemplateId = node?.templateId || node?.id;
    const task = taskRepository.getTask(effectiveTaskId);
    if (!task) return;

    const currentSteps = task.steps || {};
    const currentNodeSteps = currentSteps[nodeTemplateId] || {};
    const updatedNodeSteps = { ...currentNodeSteps };
    delete updatedNodeSteps[stepKey];

    // ✅ CRITICAL: Quando cancelliamo uno step, passiamo updatedNodeSteps (che può essere {} se tutti gli step sono stati cancellati)
    // Il merge di taskRepository.updateTask ora gestisce correttamente {} come "cancellazione esplicita di tutti gli step"
    taskRepository.updateTask(effectiveTaskId, {
      steps: {
        ...currentSteps,
        [nodeTemplateId]: updatedNodeSteps  // ✅ Se {} (vuoto), indica cancellazione esplicita di tutti gli step
      }
    });

    // ✅ Forza ri-render aggiornando taskVersion
    setTaskVersion(prev => prev + 1);

    // ✅ Se lo step cancellato era selezionato, seleziona il primo step disponibile
    setTimeout(() => {
      const taskInstance = taskRepository.getTask(effectiveTaskId);
      if (!taskInstance) return;
      const instanceSteps = taskInstance.steps?.[nodeTemplateId] || {};
      const remainingSteps = stepKeys.filter(key => {
        const stepData = instanceSteps[key];
        return stepData && stepData._disabled !== true;
      });
      if (selectedStepKey === stepKey && remainingSteps.length > 0) {
        onSelectStep(remainingSteps[0]);
      }
    }, 0);
  };

  // ✅ Funzione per calcolare la posizione del dropdown
  const updateDropdownPosition = () => {
    if (!restoreButtonRef.current) return;
    const rect = restoreButtonRef.current.getBoundingClientRect();
    setDropdownPosition({
      top: rect.bottom + 4, // 4px di margine
      left: rect.right - 200, // Allinea a destra (200px = minWidth del dropdown)
    });
  };

  // ✅ Aggiorna posizione quando il dropdown si apre o quando scroll/resize
  useEffect(() => {
    if (showRestoreDropdown) {
      updateDropdownPosition();
      window.addEventListener('scroll', updateDropdownPosition, true);
      window.addEventListener('resize', updateDropdownPosition);
      return () => {
        window.removeEventListener('scroll', updateDropdownPosition, true);
        window.removeEventListener('resize', updateDropdownPosition);
      };
    } else {
      setDropdownPosition(null);
    }
  }, [showRestoreDropdown]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          restoreButtonRef.current && !restoreButtonRef.current.contains(event.target as Node)) {
        setShowRestoreDropdown(false);
      }
    };

    if (showRestoreDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showRestoreDropdown]);

  return (
    <>
      {/* Toolbar portals per ogni step */}
      {visibleStepKeys.map((key) => {
        const { isDisabled, isDeleted } = getStepState(key);
        const isMandatory = isStepMandatory(key);
        const showToolbar = hoveredStepKey === key && !isDeleted && !isMandatory && effectiveTaskId;
        const toolbarPosition = toolbarPositions[key];

        return showToolbar && toolbarPosition && typeof document !== 'undefined' ? (
          createPortal(
            <div
              key={`toolbar-${key}`}
              onClick={(e) => e.stopPropagation()}
              onMouseEnter={() => setHoveredStepKey(key)}
              onMouseLeave={() => setHoveredStepKey(null)}
              style={{
                position: 'fixed',
                top: `${toolbarPosition.top}px`,
                left: `${toolbarPosition.left}px`,
                display: 'flex',
                gap: 4,
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 6,
                padding: '4px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                zIndex: 10000,
                pointerEvents: 'auto',
              }}
            >
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleToggleDisabled(key);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  border: 'none',
                  background: isDisabled ? 'transparent' : '#10b981',
                  color: isDisabled ? '#6b7280' : '#fff',
                  borderRadius: 4,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                title={isDisabled ? 'Enable step' : 'Disable step'}
              >
                {isDisabled ? <Check size={16} /> : <X size={16} />}
              </button>
            </div>,
            document.body
          )
        ) : null;
      })}

      <div
        className={combinedClass}
        style={{
          display: 'flex',
          flexWrap: 'nowrap',
          gap: 8,
          padding: '6px 16px 10px 16px',
          overflowX: 'auto',
          alignItems: 'center'
        }}
      >
      {visibleStepKeys.map((key) => {
        const color = colorForStep(key);
        const selected = selectedStepKey === key;
        const label = getFriendlyLabel(key);
        const { isDisabled, isDeleted } = getStepState(key);

        return (
          <div
            key={key}
            style={{ position: 'relative', display: 'inline-block' }}
            onMouseEnter={() => handleMouseEnter(key)}
            onMouseLeave={handleMouseLeave}
          >
            <button
              ref={(el) => {
                if (el) buttonRefs.current[key] = el;
              }}
              type="button"
              data-step-key={key}
              aria-label={`Step ${label}`}
              aria-current={selected ? 'step' : undefined}
              onClick={() => onSelectStep(key)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontWeight: selected ? 700 : 500,
                background: 'transparent',
                color: color,
                border: isDeleted
                  ? `1px dashed ${color}80`
                  : isDisabled
                    ? `1px dashed ${color}`
                    : `1px solid ${color}`,
                boxShadow: selected && !isDeleted && !isDisabled ? `0 0 0 2px ${color}` : 'none',
                borderRadius: 10,
                padding: '5px 10px',
                cursor: 'pointer',
                transition: 'box-shadow 0.12s ease',
                minWidth: 0,
                whiteSpace: 'nowrap',
                flexShrink: 0,
                opacity: isDisabled ? 0.6 : 1,
                textDecoration: isDisabled ? 'line-through' : 'none',
              }}
            >
              <span>{iconForStep(key)}</span>
              <span>{label}</span>
            </button>
          </div>
        );
      })}

      {/* Restore button - always visible when there are restorable steps */}
      {restorableSteps.length > 0 && (
        <div style={{ display: 'inline-block', marginLeft: 8 }}>
          <button
            ref={restoreButtonRef}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowRestoreDropdown(!showRestoreDropdown);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 10px',
              background: 'transparent',
              border: '1px solid #6b7280',
              borderRadius: 10,
              color: '#6b7280',
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontWeight: 500,
            }}
            title="Restore deleted steps"
          >
            <Plus size={16} />
            <span>Restore steps</span>
            <ChevronDown size={14} style={{ transform: showRestoreDropdown ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
          </button>
        </div>
      )}

      {/* Dropdown portal - renderizzato fuori dal container */}
      {showRestoreDropdown && dropdownPosition && typeof document !== 'undefined' && (
        createPortal(
          <div
            ref={dropdownRef}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: `${dropdownPosition.top}px`,
              left: `${dropdownPosition.left}px`,
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              zIndex: 10001,
              minWidth: 200,
              maxHeight: 300,
              overflowY: 'auto',
            }}
          >
            {restorableSteps.map(({ stepKey, stepData }) => {
              const color = colorForStep(stepKey);
              const icon = iconForStep(stepKey);
              const label = getFriendlyLabel(stepKey);

              return (
                <div
                  key={stepKey}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    width: '100%',
                  }}
                >
                  {/* Voce step (cliccabile per ripristinare) */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleRestoreStep(stepKey, stepData);
                    }}
                    style={{
                      flex: 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 10px',
                      background: 'transparent',
                      border: `1px solid ${color}`,
                      borderRadius: 10,
                      color: color,
                      cursor: 'pointer',
                      fontSize: 14,
                      fontWeight: 500,
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.border = `2px solid ${color}`;
                      e.currentTarget.style.background = `${color}10`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.border = `1px solid ${color}`;
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <span>{icon}</span>
                    <span>{label}</span>
                  </button>

                  {/* Cestino per cancellazione definitiva */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handlePermanentDelete(stepKey);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 28,
                      height: 28,
                      padding: 0,
                      background: 'transparent',
                      border: 'none',
                      color: '#ef4444',
                      cursor: 'pointer',
                      borderRadius: 4,
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#fee2e2';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                    title="Delete permanently (cannot be restored)"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
          </div>,
          document.body
        )
      )}
      </div>
    </>
  );
}

