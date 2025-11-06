import React from 'react';
import { Ear, CheckCircle2, Megaphone, GitBranch, FileText, Server, Check, Bot } from 'lucide-react';
import { useFontContext } from '../../../../context/FontContext';

// Keyboard navigable type picker toolbar
// ORDINATI ALFABETICAMENTE
const TYPE_OPTIONS = [
    { key: 'AIAgent', label: 'AI Agent', Icon: Bot, color: '#a855f7' },
    { key: 'BackendCall', label: 'BackendCall', Icon: Server, color: '#94a3b8' },
    { key: 'DataRequest', label: 'Data', Icon: Ear, color: '#3b82f6' },
    { key: 'Message', label: 'Message', Icon: Megaphone, color: '#34d399' },
    { key: 'Negotiation', label: 'Negotiation', Icon: CheckCircle2, color: '#6366f1' },
    { key: 'ProblemClassification', label: 'Problem', Icon: GitBranch, color: '#f59e0b' },
    { key: 'Summarizer', label: 'Summarizer', Icon: FileText, color: '#06b6d4' }
];

interface RowTypePickerToolbarProps {
    left: number;
    top: number;
    onPick: (k: string) => void;
    rootRef?: React.RefObject<HTMLDivElement>;
    currentType?: string;
    onRequestClose?: () => void;
    buttonCloseTimeoutRef?: React.MutableRefObject<NodeJS.Timeout | null>;
}

/**
 * Type picker toolbar for selecting agent act type
 * Keyboard navigable with arrow keys, Enter to confirm, Escape to close
 * Supports keyboard shortcuts: a=AI Agent, m=Message, d=Data, n=Negotiation, p=Problem, s=Summarizer, b=BackendCall
 */
export function RowTypePickerToolbar({
    left,
    top,
    onPick,
    rootRef,
    currentType,
    onRequestClose,
    buttonCloseTimeoutRef
}: RowTypePickerToolbarProps) {
    // Get font from context with fallback
    let combinedClass = 'font-intent-sans text-intent-base';

    try {
        const context = useFontContext();
        combinedClass = context.combinedClass;
    } catch {
        // Not within FontProvider, use defaults
    }

    const [focusIdx, setFocusIdx] = React.useState(0);
    const btnRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
    const isMouseInsideRef = React.useRef(false);
    const closeTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

    React.useEffect(() => {
        setFocusIdx(0);
        setTimeout(() => btnRefs.current[0]?.focus(), 0);
        return () => {
            if (closeTimeoutRef.current) {
                clearTimeout(closeTimeoutRef.current);
            }
        };
    }, []);

    const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        const key = e.key;
        const lower = (key || '').toLowerCase();
        const block = ['ArrowDown', 'ArrowUp', 'Enter', 'Escape'];
        if (block.includes(key)) { e.preventDefault(); e.stopPropagation(); }

        // Keyboard shortcuts
        if (lower.length === 1 && /[a-z]/.test(lower)) {
            const map: Record<string, string> = {
                a: 'AIAgent',
                m: 'Message',
                d: 'DataRequest',
                n: 'Negotiation',
                p: 'ProblemClassification',
                s: 'Summarizer',
                b: 'BackendCall'
            };
            const match = map[lower];
            if (match && match !== currentType) { onPick(match); return; }
        }

        if (key === 'ArrowDown') setFocusIdx(i => Math.min(TYPE_OPTIONS.length - 1, i + 1));
        else if (key === 'ArrowUp') setFocusIdx(i => Math.max(0, i - 1));
        else if (key === 'Enter') {
            const opt = TYPE_OPTIONS[focusIdx];
            if (opt && opt.key !== currentType) onPick(opt.key);
        } else if (key === 'Escape') {
            onRequestClose && onRequestClose();
        }
    };

    const handleMouseEnter = () => {
        isMouseInsideRef.current = true;
        // Clear any pending close timeouts
        if (closeTimeoutRef.current) {
            clearTimeout(closeTimeoutRef.current);
            closeTimeoutRef.current = null;
        }
        // Cancel button's close timeout when mouse enters picker
        if (buttonCloseTimeoutRef && buttonCloseTimeoutRef.current) {
            clearTimeout(buttonCloseTimeoutRef.current);
            buttonCloseTimeoutRef.current = null;
        }
    };

    const handleMouseLeave = () => {
        isMouseInsideRef.current = false;
        // Clear any existing timeout
        if (closeTimeoutRef.current) {
            clearTimeout(closeTimeoutRef.current);
        }
        // Delay closing to allow moving mouse back to button
        closeTimeoutRef.current = setTimeout(() => {
            if (!isMouseInsideRef.current) {
                try { onRequestClose && onRequestClose(); } catch { }
            }
        }, 200);
    };

    return (
        <div
            style={{
                position: 'fixed',
                left,
                top,
                padding: 6,
                background: 'rgba(17,24,39,0.92)',
                border: '1px solid rgba(234,179,8,0.35)',
                boxShadow: '0 10px 24px rgba(0,0,0,0.35)',
                width: 'max-content',
                maxWidth: 220,
                borderRadius: 12,
                backdropFilter: 'blur(3px) saturate(120%)',
                WebkitBackdropFilter: 'blur(3px) saturate(120%)',
            }}
            className={combinedClass}
            role="menu"
            tabIndex={0}
            onKeyDown={onKeyDown}
            aria-label="Pick act type"
            ref={rootRef as any}
            onPointerDown={(e) => { e.stopPropagation(); }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <div
                style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
            >
                {TYPE_OPTIONS.map((opt, i) => {
                    const isCurrent = currentType === opt.key;
                    return (
                        <button
                            key={opt.key}
                            ref={el => (btnRefs.current[i] = el)}
                            disabled={isCurrent}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 8,
                                minWidth: 180,
                                padding: '6px 8px',
                                border: 'none',
                                borderRadius: 8,
                                background: isCurrent ? 'rgba(30,41,59,0.7)' : 'rgba(0,0,0,0.75)',
                                color: isCurrent ? '#94a3b8' : '#e5e7eb',
                                cursor: isCurrent ? 'default' : 'pointer',
                                outline: i === focusIdx ? '1px solid rgba(234,179,8,0.45)' : 'none',
                            }}
                            className={combinedClass}
                            tabIndex={i === focusIdx ? 0 : -1}
                            aria-selected={i === focusIdx}
                            onMouseEnter={() => setFocusIdx(i)}
                            onFocus={() => setFocusIdx(i)}
                            onMouseDown={(e) => { if (isCurrent) return; e.preventDefault(); e.stopPropagation(); onPick(opt.key); }}
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        >
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                <opt.Icon className="w-4 h-4" style={{ color: isCurrent ? '#64748b' : opt.color }} />
                                <span>{opt.label}</span>
                            </span>
                            {isCurrent && (
                                <Check className="w-4 h-4" style={{ color: '#22c55e' }} />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

