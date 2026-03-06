import React, { useState, useRef, useCallback, useEffect } from 'react';
import { collectAllMessages, groupMessagesByStep } from './utils';
import { STEP_ORDER, StepType, getStepOrder } from '@types/stepTypes';
import { AccordionState } from './types';
import MessageReviewToolbar from './MessageReviewToolbar';
import MessageReviewAccordion from './MessageReviewAccordion';
import { useResponseEditorContext } from '@responseEditor/context/ResponseEditorContext';
import { taskRepository } from '@services/TaskRepository';
import DialogueTaskService from '@services/DialogueTaskService';
import { Plus, ChevronDown } from 'lucide-react';
import { stepMeta } from '@responseEditor/ddtUtils';

type Props = {
    node: any;
    translations: Record<string, string>;
    updateSelectedNode?: (updater: (node: any) => any) => void;
};

export default function MessageReviewView({ node, translations, updateSelectedNode }: Props) {
    const { taskId } = useResponseEditorContext();

    // Debug: Log quando MessageReviewView viene renderizzato
    console.log('[MessageReviewView] RENDER:', {
        hasNode: !!node,
        nodeId: node?.id,
        taskId,
        translationsCount: Object.keys(translations || {}).length
    });

    const items = React.useMemo(() => collectAllMessages(node, translations), [node, translations]);

    const [accordionState, setAccordionState] = React.useState<AccordionState>({});
    // Initialize with Italy (it) as default culture
    const [activeParams, setActiveParams] = React.useState<Set<string>>(new Set(['it']));
    const [showRestoreDropdown, setShowRestoreDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const groups = React.useMemo(() => groupMessagesByStep(items), [items]);

    // Get node templateId
    const nodeTemplateId = node?.templateId || node?.id;

    // Get task instance and template
    const taskInstance = taskId ? taskRepository.getTask(taskId) : null;
    const template = nodeTemplateId ? DialogueTaskService.getTemplate(nodeTemplateId) : null;

    // Find deleted steps that can be restored from template
    // ✅ Calcola step cancellati che possono essere ripristinati (approccio diretto)
    const restorableSteps = React.useMemo(() => {
        if (!taskInstance || !template || !nodeTemplateId) return [];

        // ✅ Leggi tutti gli step del template per questo nodeTemplateId
        const templateSteps = template.steps?.[nodeTemplateId] || template.steps || {};

        // ✅ Leggi tutti gli step dell'istanza per questo nodeTemplateId
        const instanceSteps = taskInstance.steps?.[nodeTemplateId] || {};

        // ✅ Step da ripristinare: presenti nel template ma NON nell'istanza
        const deleted: Array<{ stepKey: string; stepData: any }> = [];

        Object.keys(templateSteps).forEach(stepKey => {
            if (!instanceSteps[stepKey]) {
                // ✅ Esiste nel template ma non nell'istanza = cancellato
                deleted.push({
                    stepKey,
                    stepData: templateSteps[stepKey]
                });
            }
        });

        // ✅ Ordina per STEP_ORDER (per UX)
        return deleted.sort((a, b) => {
            return getStepOrder(a.stepKey) - getStepOrder(b.stepKey);
        });
    }, [taskInstance, template, nodeTemplateId]);

    // Handle restore step
    const handleRestoreStep = (stepKey: string, stepData: any) => {
        if (!taskId || !nodeTemplateId) return;

        const task = taskRepository.getTask(taskId);
        if (!task) return;

        // For now, restore step as-is (GUIDs will be handled by buildTaskTree if needed)
        // TODO: Consider cloning GUIDs if step was previously deleted and needs new translations
        const currentSteps = task.steps || {};
        const currentNodeSteps = currentSteps[nodeTemplateId] || {};

        // Create new steps object with restored step in correct position
        const updatedNodeSteps: Record<string, any> = {};

        // Add steps in STEP_ORDER, inserting restored step at correct position
        STEP_ORDER.forEach(stepType => {
            const key = stepType;
            if (key === stepKey) {
                // Insert restored step
                updatedNodeSteps[key] = { ...stepData, _disabled: false };
            } else if (currentNodeSteps[key]) {
                // Keep existing step
                updatedNodeSteps[key] = currentNodeSteps[key];
            }
        });

        // Add any remaining steps not in STEP_ORDER
        Object.keys(currentNodeSteps).forEach(key => {
            const stepType = key as StepType;
            if (!STEP_ORDER.includes(stepType) && !updatedNodeSteps[key]) {
                updatedNodeSteps[key] = currentNodeSteps[key];
            }
        });

        // If restored step is not in STEP_ORDER, add it at the end
        const restoredStepType = stepKey as StepType;
        if (!STEP_ORDER.includes(restoredStepType)) {
            updatedNodeSteps[stepKey] = { ...stepData, _disabled: false };
        }

        taskRepository.updateTask(taskId, {
            steps: {
                ...currentSteps,
                [nodeTemplateId]: updatedNodeSteps
            }
        });

        setShowRestoreDropdown(false);
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowRestoreDropdown(false);
            }
        };

        if (showRestoreDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showRestoreDropdown]);

    // Split groups into two panels
    const leftGroups = React.useMemo(() => {
        const mid = Math.ceil(groups.length / 2);
        return groups.slice(0, mid);
    }, [groups]);

    const rightGroups = React.useMemo(() => {
        const mid = Math.ceil(groups.length / 2);
        return groups.slice(mid);
    }, [groups]);

    const handleToggleAccordion = (stepKey: string) => {
        setAccordionState((prev) => ({
            ...prev,
            [stepKey]: !prev[stepKey],
        }));
    };

    const handleExpandAll = () => {
        const newState: AccordionState = {};
        groups.forEach((group) => {
            newState[group.stepKey] = true;
        });
        setAccordionState(newState);
    };

    const handleCollapseAll = () => {
        setAccordionState({});
    };

    const handleStyleChange = (style: string) => {
        // TODO: Implement style change for messages
        console.log('Apply style:', style);
    };

    const handleParamChange = (param: string, enabled: boolean) => {
        setActiveParams(prev => {
            const newSet = new Set(prev);

            // Culture options are mutually exclusive
            const cultureOptions = ['br', 'fr', 'de', 'it', 'es', 'us'];
            if (cultureOptions.includes(param)) {
                // Remove all other culture options first
                cultureOptions.forEach(culture => {
                    if (culture !== param) {
                        newSet.delete(culture);
                    }
                });
            }

            if (enabled) {
                newSet.add(param);
            } else {
                newSet.delete(param);
                // If disabling a culture and no culture is active, default to Italy
                if (cultureOptions.includes(param) && cultureOptions.every(c => !newSet.has(c))) {
                    newSet.add('it');
                }
            }

            return newSet;
        });

        console.log('Param changed:', param, enabled);
    };

    // Splitter state and handlers
    const containerRef = useRef<HTMLDivElement>(null);
    const [leftWidth, setLeftWidth] = useState(() => {
        const saved = localStorage.getItem('message-review-splitter-width');
        return saved ? parseInt(saved, 10) : 50; // Default 50% (percentage)
    });
    const [isDragging, setIsDragging] = useState(false);

    // Save splitter position
    useEffect(() => {
        if (leftWidth) {
            localStorage.setItem('message-review-splitter-width', leftWidth.toString());
        }
    }, [leftWidth]);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging || !containerRef.current) return;

        const containerRect = containerRef.current.getBoundingClientRect();
        const containerWidth = containerRect.width;
        const mouseX = e.clientX - containerRect.left;
        const percentage = (mouseX / containerWidth) * 100;

        // Limit between 20% and 80%
        const clampedPercentage = Math.max(20, Math.min(80, percentage));
        setLeftWidth(clampedPercentage);
    }, [isDragging]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [isDragging, handleMouseMove, handleMouseUp]);

    if (items.length === 0) {
        return (
            <div style={{ padding: 24, textAlign: 'center', color: '#64748b', fontStyle: 'italic' }}>
                No messages found in current template.
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <MessageReviewToolbar
                onExpandAll={handleExpandAll}
                onCollapseAll={handleCollapseAll}
                onStyleChange={handleStyleChange}
                onParamChange={handleParamChange}
                activeParams={activeParams}
            />

            <div
                ref={containerRef}
                style={{
                    flex: 1,
                    display: 'flex',
                    minHeight: 0,
                    overflow: 'hidden',
                    position: 'relative',
                }}
            >
                {/* Left Grid */}
                <div
                    style={{
                        width: `${leftWidth}%`,
                        minWidth: 0,
                        overflow: 'auto',
                        padding: '16px',
                        borderRight: '1px solid #e5e7eb',
                        position: 'relative',
                    }}
                >
                    {leftGroups.length === 0 ? (
                        <div style={{ padding: 24, color: '#64748b', fontStyle: 'italic' }}>
                            No messages to display.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative', overflow: 'visible' }}>
                            {leftGroups.map((group) => (
                                <MessageReviewAccordion
                                    key={group.stepKey}
                                    group={group}
                                    expanded={accordionState[group.stepKey] ?? false}
                                    onToggle={() => handleToggleAccordion(group.stepKey)}
                                    updateSelectedNode={updateSelectedNode}
                                    node={node}
                                    taskId={taskId}
                                />
                            ))}

                            {/* Restore button - always visible when there are restorable steps */}
                            {restorableSteps.length > 0 && (
                                <div style={{ position: 'relative', display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                                    <button
                                        onClick={() => setShowRestoreDropdown(!showRestoreDropdown)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 6,
                                            padding: '8px 12px',
                                            backgroundColor: '#fff',
                                            border: '1px solid #e5e7eb',
                                            borderRadius: 6,
                                            cursor: 'pointer',
                                            color: '#6b7280',
                                            fontSize: '14px',
                                            transition: 'all 0.2s',
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.backgroundColor = '#f9fafb';
                                            e.currentTarget.style.borderColor = '#d1d5db';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.backgroundColor = '#fff';
                                            e.currentTarget.style.borderColor = '#e5e7eb';
                                        }}
                                    >
                                        <Plus size={16} />
                                        <span>Restore steps</span>
                                        <ChevronDown size={14} style={{ transform: showRestoreDropdown ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                                    </button>

                                    {showRestoreDropdown && (
                                        <div
                                            ref={dropdownRef}
                                            style={{
                                                position: 'absolute',
                                                top: '100%',
                                                right: 0,
                                                marginTop: '4px',
                                                backgroundColor: '#fff',
                                                border: '1px solid #e5e7eb',
                                                borderRadius: 6,
                                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                                zIndex: 1000,
                                                minWidth: '200px',
                                                maxHeight: '300px',
                                                overflowY: 'auto',
                                            }}
                                        >
                                            {restorableSteps.map(({ stepKey, stepData }) => {
                                                const stepMetaItem = stepMeta[stepKey];
                                                return (
                                                    <button
                                                        key={stepKey}
                                                        onClick={() => handleRestoreStep(stepKey, stepData)}
                                                        style={{
                                                            width: '100%',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: 8,
                                                            padding: '10px 12px',
                                                            border: 'none',
                                                            background: 'transparent',
                                                            cursor: 'pointer',
                                                            textAlign: 'left',
                                                            fontSize: '14px',
                                                            color: '#374151',
                                                            transition: 'background 0.2s',
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.backgroundColor = '#f3f4f6';
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.backgroundColor = 'transparent';
                                                        }}
                                                    >
                                                        {stepMetaItem?.icon && (
                                                            <span style={{ color: stepMetaItem.border }}>
                                                                {stepMetaItem.icon}
                                                            </span>
                                                        )}
                                                        <span style={{ flex: 1 }}>
                                                            {stepMetaItem?.label || stepKey}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Splitter */}
                <div
                    onMouseDown={handleMouseDown}
                    style={{
                        width: '6px',
                        cursor: 'col-resize',
                        background: isDragging ? '#fb923c55' : 'transparent',
                        flexShrink: 0,
                        position: 'relative',
                        zIndex: 10,
                    }}
                    aria-label="Resize panels"
                    role="separator"
                />

                {/* Right Grid */}
                <div
                    style={{
                        width: `${100 - leftWidth}%`,
                        minWidth: 0,
                        overflow: 'visible',
                        padding: '16px',
                        position: 'relative',
                    }}
                >
                    {rightGroups.length === 0 ? (
                        <div style={{ padding: 24, color: '#64748b', fontStyle: 'italic' }}>
                            No messages to display.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative' }}>
                            {rightGroups.map((group) => (
                                <MessageReviewAccordion
                                    key={group.stepKey}
                                    group={group}
                                    expanded={accordionState[group.stepKey] ?? false}
                                    onToggle={() => handleToggleAccordion(group.stepKey)}
                                    updateSelectedNode={updateSelectedNode}
                                    node={node}
                                    taskId={taskId}
                                />
                            ))}

                            {/* Restore button - always visible when there are restorable steps */}
                            {restorableSteps.length > 0 && (
                                <div style={{ position: 'relative', display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                                    <button
                                        onClick={() => setShowRestoreDropdown(!showRestoreDropdown)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 6,
                                            padding: '8px 12px',
                                            backgroundColor: '#fff',
                                            border: '1px solid #e5e7eb',
                                            borderRadius: 6,
                                            cursor: 'pointer',
                                            color: '#6b7280',
                                            fontSize: '14px',
                                            transition: 'all 0.2s',
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.backgroundColor = '#f9fafb';
                                            e.currentTarget.style.borderColor = '#d1d5db';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.backgroundColor = '#fff';
                                            e.currentTarget.style.borderColor = '#e5e7eb';
                                        }}
                                    >
                                        <Plus size={16} />
                                        <span>Restore steps</span>
                                        <ChevronDown size={14} style={{ transform: showRestoreDropdown ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                                    </button>

                                    {showRestoreDropdown && (
                                        <div
                                            ref={dropdownRef}
                                            style={{
                                                position: 'absolute',
                                                top: '100%',
                                                right: 0,
                                                marginTop: '4px',
                                                backgroundColor: '#fff',
                                                border: '1px solid #e5e7eb',
                                                borderRadius: 6,
                                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                                zIndex: 1000,
                                                minWidth: '200px',
                                                maxHeight: '300px',
                                                overflowY: 'auto',
                                            }}
                                        >
                                            {restorableSteps.map(({ stepKey, stepData }) => {
                                                const stepMetaItem = stepMeta[stepKey];
                                                return (
                                                    <button
                                                        key={stepKey}
                                                        onClick={() => handleRestoreStep(stepKey, stepData)}
                                                        style={{
                                                            width: '100%',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: 8,
                                                            padding: '10px 12px',
                                                            border: 'none',
                                                            background: 'transparent',
                                                            cursor: 'pointer',
                                                            textAlign: 'left',
                                                            fontSize: '14px',
                                                            color: '#374151',
                                                            transition: 'background 0.2s',
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.backgroundColor = '#f3f4f6';
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.backgroundColor = 'transparent';
                                                        }}
                                                    >
                                                        {stepMetaItem?.icon && (
                                                            <span style={{ color: stepMetaItem.border }}>
                                                                {stepMetaItem.icon}
                                                            </span>
                                                        )}
                                                        <span style={{ flex: 1 }}>
                                                            {stepMetaItem?.label || stepKey}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

