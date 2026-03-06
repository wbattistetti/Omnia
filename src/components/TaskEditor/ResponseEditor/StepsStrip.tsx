import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { stepMeta } from './ddtUtils';
import { Shield, Check, Trash2, X } from 'lucide-react';
import { useFontContext } from '@context/FontContext';
import { useResponseEditorContext } from '@responseEditor/context/ResponseEditorContext';
import { taskRepository } from '@services/TaskRepository';

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
      const updatedStepData = {
        ...currentStepData,
        _disabled: !currentStepData._disabled
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
    }
  };

  // Handler per delete step
  const handleDeleteStep = (stepKey: string) => {
    if (!effectiveTaskId || !node) return;
    const nodeTemplateId = node?.templateId || node?.id;
    const task = taskRepository.getTask(effectiveTaskId);
    if (!task) return;

    const currentSteps = task.steps || {};
    const currentNodeSteps = currentSteps[nodeTemplateId] || {};
    const updatedNodeSteps = { ...currentNodeSteps };
    delete updatedNodeSteps[stepKey];

    taskRepository.updateTask(effectiveTaskId, {
      steps: {
        ...currentSteps,
        [nodeTemplateId]: updatedNodeSteps
      }
    });
  };

  // Step obbligatori che non possono essere disattivati o eliminati
  const mandatorySteps = ['start'];
  const isStepMandatory = (stepKey: string) => mandatorySteps.includes(stepKey);

  return (
    <>
      {/* Toolbar portals per ogni step */}
      {stepKeys.map((key) => {
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
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDeleteStep(key);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  border: 'none',
                  background: 'transparent',
                  color: '#ef4444',
                  borderRadius: 4,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                title="Delete step from instance"
              >
                <Trash2 size={16} />
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
          overflowX: 'auto'
        }}
      >
      {stepKeys.map((key, index) => {
        const color = colorForStep(key);
        const selected = selectedStepKey === key;
        const label = getFriendlyLabel(key);
        const { isDisabled, isDeleted } = getStepState(key);
        const isHovered = hoveredStepKey === key;

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
              aria-label={`Step ${label}`}
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
                    : selected
                      ? `3px solid ${color}`
                      : `1px solid ${color}`,
                borderRadius: 10,
                padding: '5px 10px',
                cursor: 'pointer',
                transition: 'border 0.15s',
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
      </div>
    </>
  );
}

