import React from 'react';
import { StepGroup } from '@responseEditor/MessageReview/types';
import MessageReviewMessage from '@responseEditor/MessageReview/MessageReviewMessage';
import { useFontContext } from '@context/FontContext';
import { taskRepository } from '@services/TaskRepository';
import { stepMeta } from '@responseEditor/ddtUtils';
import StepTab from './StepTab';

type Props = {
    group: StepGroup;
    expanded: boolean;
    onToggle: () => void;
    updateSelectedNode?: (updater: (node: any) => any) => void;
    node: any;
    taskId?: string;
};

export default function MessageReviewAccordion({ group, expanded, onToggle, updateSelectedNode, node, taskId }: Props) {
    const { combinedClass } = useFontContext();

    // Get node templateId
    const nodeTemplateId = node?.templateId || node?.id;

    // Get task instance and check step state
    const taskInstance = taskId ? taskRepository.getTask(taskId) : null;
    const nodeSteps = taskInstance?.steps?.[nodeTemplateId] || {};
    const stepData = nodeSteps[group.stepKey];
    const isDisabled = stepData?._disabled === true;
    const isDeleted = !stepData;

    // Get step meta for styling
    const meta = stepMeta[group.stepKey];
    const bgColor = meta?.bg || 'rgba(107,114,128,0.15)';
    const borderColor = meta?.border || '#6b7280';
    const textColor = meta?.color || '#64748b';

    // Apply disabled styling
    const effectiveBgColor = isDisabled ? `${bgColor}80` : bgColor;
    const effectiveBorderColor = isDisabled ? `${borderColor}80` : borderColor;
    const effectiveBorderStyle = isDisabled ? 'dashed' : 'solid';

    // Handle toggle disabled state
    const handleToggleDisabled = () => {
        if (!taskId || !nodeTemplateId) return;

        const task = taskRepository.getTask(taskId);
        if (!task) return;

        const currentSteps = task.steps || {};
        const currentNodeSteps = currentSteps[nodeTemplateId] || {};
        const currentStepData = currentNodeSteps[group.stepKey];

        if (currentStepData) {
            const updatedStepData = {
                ...currentStepData,
                _disabled: !currentStepData._disabled
            };
            taskRepository.updateTask(taskId, {
                steps: {
                    ...currentSteps,
                    [nodeTemplateId]: {
                        ...currentNodeSteps,
                        [group.stepKey]: updatedStepData
                    }
                }
            });
        }
    };

    // Handle delete step
    const handleDeleteStep = () => {
        if (!taskId || !nodeTemplateId) return;

        const task = taskRepository.getTask(taskId);
        if (!task) return;

        const currentSteps = task.steps || {};
        const currentNodeSteps = currentSteps[nodeTemplateId] || {};
        const updatedNodeSteps = { ...currentNodeSteps };
        delete updatedNodeSteps[group.stepKey];

        taskRepository.updateTask(taskId, {
            steps: {
                ...currentSteps,
                [nodeTemplateId]: updatedNodeSteps
            }
        });
    };

    // Calculate total messages
    const totalMessages = group.recoveries.reduce((sum, r) => sum + r.items.length, 0);

    return (
        <div
            style={{
                border: `2px ${effectiveBorderStyle} ${effectiveBorderColor}`,
                borderRadius: 12,
                background: effectiveBgColor,
                marginBottom: 12,
                overflow: 'visible',
                breakInside: 'avoid',
                pageBreakInside: 'avoid',
                WebkitColumnBreakInside: 'avoid',
                position: 'relative',
                opacity: isDisabled ? 0.6 : 1,
            }}
        >
            {/* StepTab as header */}
            <StepTab
                stepKey={group.stepKey}
                expanded={expanded}
                disabled={isDisabled}
                deleted={isDeleted}
                messageCount={totalMessages}
                onToggle={onToggle}
                onToggleDisabled={handleToggleDisabled}
                onDelete={handleDeleteStep}
                taskId={taskId}
                node={node}
            />

            {/* Accordion Content - Recovery boxes with messages when expanded */}
            {expanded && (
                <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {group.recoveries.length === 0 ? (
                        <div className={combinedClass} style={{ color: '#64748b', fontStyle: 'italic' }}>
                            No messages for this step type.
                        </div>
                    ) : (
                        group.recoveries.map((recovery) => (
                            <div
                                key={recovery.escIndex !== null ? `recovery_${recovery.escIndex}` : 'no_recovery'}
                                style={{
                                    border: `1px solid ${borderColor}`,
                                    borderRadius: 8,
                                    padding: '12px',
                                    background: 'rgba(255, 255, 255, 0.5)',
                                }}
                            >
                                {/* Recovery header (optional, can be hidden if not needed) */}
                                {recovery.escIndex !== null && (
                                    <div className={combinedClass} style={{
                                        marginBottom: 8,
                                        fontWeight: 600,
                                        color: textColor,
                                        opacity: 0.8
                                    }}>
                                        Recovery {recovery.escIndex + 1}
                                    </div>
                                )}

                                {/* Messages inside recovery - no individual boxes */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {recovery.items.length === 0 ? (
                                        <div className={combinedClass} style={{ color: '#64748b', fontStyle: 'italic' }}>
                                            No messages in this recovery.
                                        </div>
                                    ) : (
                                        recovery.items.map((item) => (
                                            <MessageReviewMessage
                                                key={item.id}
                                                item={item}
                                                updateSelectedNode={updateSelectedNode}
                                            />
                                        ))
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

