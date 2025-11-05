import React from 'react';
import { Ear, CheckCircle2, Megaphone, GitBranch, FileText, Server, Check } from 'lucide-react';

// Keyboard navigable type picker toolbar
const TYPE_OPTIONS = [
    { key: 'Message', label: 'Message', Icon: Megaphone, color: '#34d399' },
    { key: 'DataRequest', label: 'Data', Icon: Ear, color: '#3b82f6' },
    { key: 'Negotiation', label: 'Negotiation', Icon: CheckCircle2, color: '#6366f1' },
    { key: 'ProblemClassification', label: 'Problem', Icon: GitBranch, color: '#f59e0b' },
    { key: 'Summarizer', label: 'Summarizer', Icon: FileText, color: '#06b6d4' },
    { key: 'BackendCall', label: 'BackendCall', Icon: Server, color: '#94a3b8' }
];

interface RowTypePickerToolbarProps {
    left: number;
    top: number;
    onPick: (k: string) => void;
    rootRef?: React.RefObject<HTMLDivElement>;
    currentType?: string;
    onRequestClose?: () => void;
}

/**
 * Type picker toolbar for selecting agent act type
 * Keyboard navigable with arrow keys, Enter to confirm, Escape to close
 * Supports keyboard shortcuts: m=Message, d=Data, n=Negotiation, p=Problem, s=Summarizer, b=BackendCall
 */
export function RowTypePickerToolbar({
    left,
    top,
    onPick,
    rootRef,
    currentType,
    onRequestClose
}: RowTypePickerToolbarProps) {
    const [focusIdx, setFocusIdx] = React.useState(0);
    const btnRefs = React.useRef<Array<HTMLButtonElement | null>>([]);

    React.useEffect(() => {
        setFocusIdx(0);
        setTimeout(() => btnRefs.current[0]?.focus(), 0);
        return () => { };
    }, []);

    const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        const key = e.key;
        const lower = (key || '').toLowerCase();
        const block = ['ArrowDown', 'ArrowUp', 'Enter', 'Escape'];
        if (block.includes(key)) { e.preventDefault(); e.stopPropagation(); }

        // Keyboard shortcuts
        if (lower.length === 1 && /[a-z]/.test(lower)) {
            const map: Record<string, string> = {
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
        }
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
                WebkitBackdropFilter: 'blur(3px) saturate(120%)'
            }}
            role="menu"
            tabIndex={0}
            onKeyDown={onKeyDown}
            aria-label="Pick act type"
            ref={rootRef as any}
            onPointerDown={(e) => { e.stopPropagation(); }}
            onPointerLeave={() => { setTimeout(() => { try { onRequestClose && onRequestClose(); } catch { } }, 100); }}
        >
            <div
                style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
                onMouseEnter={() => { try { console.log('[Picker][enter]'); } catch { } }}
                onMouseLeave={() => {
                    try { console.log('[Picker][leave]'); } catch { }
                    setTimeout(() => { try { onRequestClose && onRequestClose(); } catch { } }, 100);
                }}
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
                                outline: i === focusIdx ? '1px solid rgba(234,179,8,0.45)' : 'none'
                            }}
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

