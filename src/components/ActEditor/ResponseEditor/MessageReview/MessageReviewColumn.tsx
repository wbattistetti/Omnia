import React from 'react';
import { StepGroup, AccordionState } from './types';
import MessageReviewAccordion from './MessageReviewAccordion';

type Props = {
    groups: StepGroup[];
    accordionState: AccordionState;
    onToggleAccordion: (stepKey: string) => void;
    columnIndex: number;
    onResize?: (columnIndex: number, width: number) => void;
};

export default function MessageReviewColumn({
    groups,
    accordionState,
    onToggleAccordion,
    columnIndex,
    onResize,
}: Props) {
    const columnRef = React.useRef<HTMLDivElement>(null);
    const [isResizing, setIsResizing] = React.useState(false);
    const [startWidth, setStartWidth] = React.useState(0);
    const [startX, setStartX] = React.useState(0);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!columnRef.current || !onResize) return;
        e.preventDefault();
        setIsResizing(true);
        setStartWidth(columnRef.current.offsetWidth);
        setStartX(e.clientX);
    };

    React.useEffect(() => {
        if (!isResizing || !onResize || !columnRef.current) return;

        const handleMouseMove = (e: MouseEvent) => {
            const diff = e.clientX - startX;
            const newWidth = Math.max(300, Math.min(800, startWidth + diff));
            onResize(columnIndex, newWidth);
        };

        const handleMouseUp = () => {
            setIsResizing(false);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing, startWidth, startX, columnIndex, onResize]);

    return (
        <div
            ref={columnRef}
            style={{
                width: '100%',
                minWidth: 300,
                maxWidth: 800,
                display: 'flex',
                flexDirection: 'column',
                padding: '16px',
                overflowY: 'auto',
                overflowX: 'visible',
                position: 'relative',
                borderRight: onResize ? '2px solid #fbbf24' : 'none',
            }}
        >
            {groups.length === 0 ? (
                <div style={{ color: '#64748b', fontStyle: 'italic', padding: 16 }}>
                    No messages in this column.
                </div>
            ) : (
                groups.map((group) => (
                    <MessageReviewAccordion
                        key={group.stepKey}
                        group={group}
                        expanded={accordionState[group.stepKey] ?? false}
                        onToggle={() => onToggleAccordion(group.stepKey)}
                    />
                ))
            )}
            {onResize && (
                <div
                    onMouseDown={handleMouseDown}
                    style={{
                        position: 'absolute',
                        right: -2,
                        top: 0,
                        bottom: 0,
                        width: 4,
                        cursor: 'col-resize',
                        background: isResizing ? '#fbbf24' : 'transparent',
                        zIndex: 10,
                    }}
                />
            )}
        </div>
    );
}

