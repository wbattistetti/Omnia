import React, { useState, useRef, useCallback, useEffect } from 'react';
import { collectAllMessages, groupMessagesByStep } from './utils';
import { AccordionState } from './types';
import MessageReviewToolbar from './MessageReviewToolbar';
import MessageReviewAccordion from './MessageReviewAccordion';

type Props = {
    node: any;
    translations: Record<string, string>;
    updateSelectedNode?: (updater: (node: any) => any) => void;
};

export default function MessageReviewView({ node, translations, updateSelectedNode }: Props) {
    const items = React.useMemo(() => collectAllMessages(node, translations), [node, translations]);

    const [accordionState, setAccordionState] = React.useState<AccordionState>({});
    // Initialize with Italy (it) as default culture
    const [activeParams, setActiveParams] = React.useState<Set<string>>(new Set(['it']));

    const groups = React.useMemo(() => groupMessagesByStep(items), [items]);

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
                    }}
                >
                    {leftGroups.length === 0 ? (
                        <div style={{ padding: 24, color: '#64748b', fontStyle: 'italic' }}>
                            No messages to display.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {leftGroups.map((group) => (
                                <MessageReviewAccordion
                                    key={group.stepKey}
                                    group={group}
                                    expanded={accordionState[group.stepKey] ?? false}
                                    onToggle={() => handleToggleAccordion(group.stepKey)}
                                    updateSelectedNode={updateSelectedNode}
                                />
                            ))}
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
                        overflow: 'auto',
                        padding: '16px',
                    }}
                >
                    {rightGroups.length === 0 ? (
                        <div style={{ padding: 24, color: '#64748b', fontStyle: 'italic' }}>
                            No messages to display.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {rightGroups.map((group) => (
                                <MessageReviewAccordion
                                    key={group.stepKey}
                                    group={group}
                                    expanded={accordionState[group.stepKey] ?? false}
                                    onToggle={() => handleToggleAccordion(group.stepKey)}
                                    updateSelectedNode={updateSelectedNode}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

