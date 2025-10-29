import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { stepMeta } from '../ddtUtils';
import { StepGroup } from './types';
import MessageReviewMessage from './MessageReviewMessage';

type Props = {
    group: StepGroup;
    expanded: boolean;
    onToggle: () => void;
};

export default function MessageReviewAccordion({ group, expanded, onToggle }: Props) {
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
                <span style={{ fontWeight: 700, fontSize: 15, color: borderColor, flex: 1 }}>
                    {meta?.label || group.stepKey}
                </span>
                <span style={{ fontSize: 12, color: textColor, opacity: 0.7 }}>
                    {group.items.length} {group.items.length === 1 ? 'message' : 'messages'}
                </span>
            </button>

            {/* Accordion Content - All messages when expanded */}
            {expanded && (
                <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {group.items.length === 0 ? (
                        <div style={{ color: '#64748b', fontStyle: 'italic', fontSize: 13 }}>
                            No messages for this step type.
                        </div>
                    ) : (
                        group.items.map((item) => (
                            <div
                                key={item.id}
                                style={{
                                    background: '#fff',
                                    border: `1px solid ${borderColor}`,
                                    borderRadius: 8,
                                    padding: 12,
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                }}
                            >
                                <MessageReviewMessage item={item} />
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

