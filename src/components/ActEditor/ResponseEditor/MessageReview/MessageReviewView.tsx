import React from 'react';
import { collectAllMessages, groupMessagesByStep } from './utils';
import { AccordionState } from './types';
import MessageReviewToolbar from './MessageReviewToolbar';
import MessageReviewAccordion from './MessageReviewAccordion';

type Props = {
    node: any;
    translations: Record<string, string>;
};

export default function MessageReviewView({ node, translations }: Props) {
    const items = React.useMemo(() => collectAllMessages(node, translations), [node, translations]);

    const [accordionState, setAccordionState] = React.useState<AccordionState>({});

    const groups = React.useMemo(() => groupMessagesByStep(items), [items]);

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

    // Calculate optimal number of columns based on available width and content
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [availableWidth, setAvailableWidth] = React.useState(1200);

    React.useEffect(() => {
        const updateWidth = () => {
            if (containerRef.current) {
                setAvailableWidth(containerRef.current.clientWidth);
            }
        };

        updateWidth();

        let timeoutId: NodeJS.Timeout;
        const handleResize = () => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(updateWidth, 150);
        };

        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            clearTimeout(timeoutId);
        };
    }, []);

    // Calculate optimal column count: aim for 2-3 columns, column width ~400px
    const optimalColumnCount = React.useMemo(() => {
        const columnWidth = 400;
        return Math.max(2, Math.min(4, Math.floor(availableWidth / columnWidth)));
    }, [availableWidth]);

    if (items.length === 0) {
        return (
            <div style={{ padding: 24, textAlign: 'center', color: '#64748b', fontStyle: 'italic' }}>
                No messages found in current template.
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <MessageReviewToolbar onExpandAll={handleExpandAll} onCollapseAll={handleCollapseAll} />

            <div
                ref={containerRef}
                style={{
                    flex: 1,
                    overflow: 'auto',
                    position: 'relative',
                    padding: '16px',
                }}
            >
                {groups.length === 0 ? (
                    <div style={{ padding: 24, color: '#64748b', fontStyle: 'italic' }}>
                        No messages to display.
                    </div>
                ) : (
                    <div
                        style={{
                            columnCount: optimalColumnCount,
                            columnGap: '24px',
                            columnFill: 'balance',
                            columnRule: 'none',
                        }}
                    >
                        {groups.map((group) => (
                            <MessageReviewAccordion
                                key={group.stepKey}
                                group={group}
                                expanded={accordionState[group.stepKey] ?? false}
                                onToggle={() => handleToggleAccordion(group.stepKey)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

