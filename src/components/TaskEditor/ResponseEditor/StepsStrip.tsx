/**
 * Horizontal Behaviour step tabs. Visibility merges TaskRepository mirrors with editor TaskTree
 * (`node.steps`) so tabs appear before `task.steps[nodeId]` is populated in memory.
 */
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { stepMeta } from './ddtUtils';
import { Shield, Check, X, Plus, ChevronDown } from 'lucide-react';
import { useFontContext } from '@context/FontContext';
import { useResponseEditorContext } from '@responseEditor/context/ResponseEditorContext';
import { taskRepository } from '@services/TaskRepository';
import { computeVisibleBehaviourStepKeys } from '@responseEditor/behaviour/computeVisibleBehaviourStepKeys';
import {
  buildUnifiedBehaviourAddMenuItems,
  type UnifiedAddMenuItem,
} from '@responseEditor/behaviour/computeAddableBehaviourStepKeys';
import { createEmptyBehaviourStepEntry } from '@responseEditor/core/taskTree/manualDefaultBehaviourSteps';

interface StepsStripProps {
  stepKeys: string[];
  selectedStepKey: string;
  onSelectStep: (stepKey: string) => void;
  node?: any; // optional, used to label constraint steps with AI-provided titles
  taskId?: string; // optional, used for toolbar functionality
  updateSelectedNode?: (updater: (node: any) => any, options?: { skipAutoSave?: boolean }) => void;
  selectedRoot?: boolean;
  selectedPath?: number[];
  selectedSubIndex?: number | null;
}

export default function StepsStrip({
  stepKeys,
  selectedStepKey,
  onSelectStep,
  node,
  taskId,
  updateSelectedNode,
  selectedRoot = false,
  selectedPath,
  selectedSubIndex,
}: StepsStripProps) {
  const { combinedClass } = useFontContext();
  const { taskId: contextTaskId } = useResponseEditorContext();
  const effectiveTaskId = taskId || contextTaskId;

  // State per hover e toolbar
  const [hoveredStepKey, setHoveredStepKey] = useState<string | null>(null);
  const [toolbarPositions, setToolbarPositions] = useState<Record<string, { top: number; left: number }>>({});
  const buttonRefs = useRef<Record<string, HTMLButtonElement>>({});

  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const addDropdownRef = useRef<HTMLDivElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const [addDropdownPosition, setAddDropdownPosition] = useState<{ top: number; left: number } | null>(null);

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

  const visibleStepKeys = React.useMemo(() => {
    if (!effectiveTaskId || !node) return stepKeys;

    const nodeTemplateId = node?.templateId || node?.id;
    if (!nodeTemplateId) return stepKeys;

    const taskInstance = taskRepository.getTask(effectiveTaskId);
    if (!taskInstance) return stepKeys;

    const instanceSteps = taskInstance.steps?.[nodeTemplateId] || {};
    const nodeDict =
      node?.steps && typeof node.steps === 'object' && !Array.isArray(node.steps)
        ? (node.steps as Record<string, unknown>)
        : undefined;

    return computeVisibleBehaviourStepKeys(stepKeys, instanceSteps, nodeDict);
  }, [stepKeys, effectiveTaskId, node, taskVersion]);

  const unifiedAddMenuItems = React.useMemo(() => {
    if (!node || !effectiveTaskId) return [];

    const nodeTemplateId = node?.templateId || node?.id;
    if (!nodeTemplateId) return [];

    const taskInstance = taskRepository.getTask(effectiveTaskId);
    if (!taskInstance) return [];

    const instanceSteps = taskInstance.steps?.[nodeTemplateId] || {};
    const nodeDict =
      node?.steps && typeof node.steps === 'object' && !Array.isArray(node.steps)
        ? (node.steps as Record<string, unknown>)
        : undefined;

    return buildUnifiedBehaviourAddMenuItems(
      selectedRoot,
      selectedPath,
      selectedSubIndex,
      instanceSteps,
      nodeDict
    );
  }, [node, selectedRoot, selectedPath, selectedSubIndex, effectiveTaskId, taskVersion]);

  const visibleUnifiedAddMenuItems = React.useMemo((): UnifiedAddMenuItem[] => {
    if (!updateSelectedNode) {
      return unifiedAddMenuItems.filter((i) => i.mode === 'restore');
    }
    return unifiedAddMenuItems;
  }, [unifiedAddMenuItems, updateSelectedNode]);

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

      // Keep TaskTree node.steps in sync so uiStepKeys / strip match the live store
      if (updateSelectedNode) {
        const stepForNode = { ...updatedStepData } as Record<string, unknown>;
        delete stepForNode._disabled;
        updateSelectedNode((n: any) => {
          const prevSteps =
            n.steps && typeof n.steps === 'object' && !Array.isArray(n.steps) ? n.steps : {};
          return {
            ...n,
            steps: {
              ...prevSteps,
              [stepKey]: stepForNode,
            },
          };
        });
      }

      // ✅ Forza ri-render aggiornando taskVersion
      setTaskVersion(prev => prev + 1);
    }

    setShowAddDropdown(false);
  };

  const handleAddStep = (stepKey: string) => {
    if (!updateSelectedNode || !node) return;

    const emptyShell = createEmptyBehaviourStepEntry(stepKey);
    updateSelectedNode((n: any) => {
      const prevSteps =
        n.steps && typeof n.steps === 'object' && !Array.isArray(n.steps) ? n.steps : {};
      return {
        ...n,
        steps: {
          ...prevSteps,
          [stepKey]: emptyShell,
        },
      };
    });

    setShowAddDropdown(false);
    setAddDropdownPosition(null);
    onSelectStep(stepKey);
    setTaskVersion((prev) => prev + 1);
  };

  const handleUnifiedAddItem = (item: UnifiedAddMenuItem) => {
    if (item.mode === 'create') {
      handleAddStep(item.stepKey);
      return;
    }
    handleRestoreStep(item.stepKey, item.stepData);
  };

  // Handler per cancellazione definitiva (rimuove lo step dalla struttura)
  const updateAddDropdownPosition = () => {
    if (!addButtonRef.current) return;
    const rect = addButtonRef.current.getBoundingClientRect();
    setAddDropdownPosition({
      top: rect.bottom + 4,
      left: rect.right - 200,
    });
  };

  useEffect(() => {
    if (showAddDropdown) {
      updateAddDropdownPosition();
      window.addEventListener('scroll', updateAddDropdownPosition, true);
      window.addEventListener('resize', updateAddDropdownPosition);
      return () => {
        window.removeEventListener('scroll', updateAddDropdownPosition, true);
        window.removeEventListener('resize', updateAddDropdownPosition);
      };
    } else {
      setAddDropdownPosition(null);
    }
  }, [showAddDropdown]);

  useEffect(() => {
    const handleClickOutsideAdd = (event: MouseEvent) => {
      if (addDropdownRef.current && !addDropdownRef.current.contains(event.target as Node) &&
          addButtonRef.current && !addButtonRef.current.contains(event.target as Node)) {
        setShowAddDropdown(false);
      }
    };

    if (showAddDropdown) {
      document.addEventListener('mousedown', handleClickOutsideAdd);
      return () => {
        document.removeEventListener('mousedown', handleClickOutsideAdd);
      };
    }
  }, [showAddDropdown]);

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

      {visibleUnifiedAddMenuItems.length > 0 && (
        <div style={{ display: 'inline-block', marginLeft: 8 }}>
          <button
            ref={addButtonRef}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowAddDropdown(!showAddDropdown);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 10px',
              background: 'transparent',
              border: '1px solid #f59e0b',
              borderRadius: 10,
              color: '#fbbf24',
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontWeight: 500,
            }}
            title="Add or restore behaviour steps"
            type="button"
          >
            <Plus size={16} />
            <span>ADD</span>
            <ChevronDown
              size={14}
              style={{
                transform: showAddDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s',
              }}
            />
          </button>
        </div>
      )}

      {showAddDropdown && addDropdownPosition && typeof document !== 'undefined' && (
        createPortal(
          <div
            ref={addDropdownRef}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: `${addDropdownPosition.top}px`,
              left: `${addDropdownPosition.left}px`,
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              zIndex: 10001,
              minWidth: 220,
              maxHeight: 320,
              overflowY: 'auto',
            }}
          >
            {visibleUnifiedAddMenuItems.map((item) => {
              const stepKey = item.stepKey;
              const color = colorForStep(stepKey);
              const icon = iconForStep(stepKey);
              const label = getFriendlyLabel(stepKey);

              return (
                <button
                  key={`${item.mode}-${stepKey}`}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleUnifiedAddItem(item);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 12px',
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '1px solid #f3f4f6',
                    color: color,
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 500,
                    textAlign: 'left',
                  }}
                >
                  <span>{icon}</span>
                  <span>{label}</span>
                </button>
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

