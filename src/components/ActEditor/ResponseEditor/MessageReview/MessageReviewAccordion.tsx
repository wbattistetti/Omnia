import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { stepMeta } from '../ddtUtils';
import { StepGroup } from './types';
import MessageReviewMessage from './MessageReviewMessage';
import { useFontContext } from '../../../../context/FontContext';

type Props = {
    group: StepGroup;
    expanded: boolean;
    onToggle: () => void;
    updateSelectedNode?: (updater: (node: any) => any) => void;
};

export default function MessageReviewAccordion({ group, expanded, onToggle, updateSelectedNode }: Props) {
    const { combinedClass } = useFontContext();
    const meta = stepMeta[group.stepKey];

    if (!meta) {
        console.warn('[MessageReviewAccordion] ⚠️ No meta found for stepKey:', group.stepKey, 'Available keys:', Object.keys(stepMeta));
    }

    const bgColor = meta?.bg || 'rgba(107,114,128,0.15)';
    const borderColor = meta?.border || '#6b7280';
    const textColor = meta?.color || '#64748b';

    return (
        <div
            style={{
                border: `2px solid ${borderColor}`,
                borderRadius: 12,
                background: bgColor,
                marginBottom: 12,
                overflow: 'visible',
                breakInside: 'avoid',
                pageBreakInside: 'avoid',
                WebkitColumnBreakInside: 'avoid',
            }}
        >
            {/* Accordion Header - Always visible */}
            <button
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onToggle();
                }}
                style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '12px 16px',
                    background: bgColor,
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.background = meta?.bgActive || bgColor;
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.background = bgColor;
                }}
            >
                <span style={{ color: borderColor, display: 'flex', alignItems: 'center' }}>
                    {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </span>
                <span style={{ color: borderColor, display: 'flex', alignItems: 'center' }}>
                    {meta?.icon || null}
                </span>
                <span className={combinedClass} style={{ fontWeight: 700, color: borderColor, flex: 1 }}>
                    {meta?.label || group.stepKey}
                </span>
                <span className={combinedClass} style={{ color: textColor, opacity: 0.7 }}>
                    {(() => {
                        const totalMessages = group.recoveries.reduce((sum, r) => sum + r.items.length, 0);
                        return `${totalMessages} ${totalMessages === 1 ? 'message' : 'messages'}`;
                    })()}
                </span>
            </button>

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

