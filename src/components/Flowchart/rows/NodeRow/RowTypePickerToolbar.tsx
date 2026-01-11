import React from 'react';
import { Ear, CheckCircle2, Megaphone, GitBranch, FileText, Server, Check, Bot, ChevronRight, ChevronDown, MoreHorizontal, Tag } from 'lucide-react';
import { useFontContext } from '../../../../context/FontContext';
import { TaskType } from '../../../../types/taskTypes';
import { TaskContext } from '../../../../types/taskContext';
import { filterTasksByContext } from '../../../../utils/taskContextHelpers';
import getIconComponent from '../../../TaskEditor/ResponseEditor/icons';
import { ensureHexColor } from '../../../TaskEditor/ResponseEditor/utils/color';

// ✅ Cache globale per i task "Other" - evita reload ogni volta
let cachedOtherTasks: any[] | null = null;
let isLoadingCache = false;

// Keyboard navigable type picker toolbar
// ✅ Restituisce direttamente TaskType enum invece di stringhe semantiche
// I 7 task principali
const MAIN_TYPE_OPTIONS = [
    { value: TaskType.SayMessage, label: 'Message', Icon: Megaphone, color: '#34d399' },
    { value: TaskType.DataRequest, label: 'Data', Icon: Ear, color: '#3b82f6' },
    { value: TaskType.BackendCall, label: 'BackendCall', Icon: Server, color: '#94a3b8' },
    { value: TaskType.ClassifyProblem, label: 'Problem', Icon: GitBranch, color: '#f59e0b' },
    { value: TaskType.AIAgent, label: 'AI Agent', Icon: Bot, color: '#a855f7' },
    { value: TaskType.Summarizer, label: 'Summarizer', Icon: FileText, color: '#06b6d4' },
    { value: TaskType.Negotiation, label: 'Negotiation', Icon: CheckCircle2, color: '#6366f1' }
];

interface RowTypePickerToolbarProps {
    left: number;
    top: number;
    onPick: (taskType: TaskType | { task: any }) => void; // ✅ Restituisce TaskType enum o task object per "Other"
    rootRef?: React.RefObject<HTMLDivElement>;
    currentType?: TaskType; // ✅ TaskType enum invece di stringa
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
    const [isOtherExpanded, setIsOtherExpanded] = React.useState(false);
    const [otherTasks, setOtherTasks] = React.useState<any[]>(cachedOtherTasks || []);
    const [isLoadingOtherTasks, setIsLoadingOtherTasks] = React.useState(false);
    const btnRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
    const isMouseInsideRef = React.useRef(false);
    const closeTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

    // ✅ Load other tasks when "Other" is expanded - usa cache globale
    React.useEffect(() => {
        if (isOtherExpanded) {
            // Se abbiamo già i task in cache, usali direttamente
            if (cachedOtherTasks) {
                setOtherTasks(cachedOtherTasks);
                setIsLoadingOtherTasks(false);
                return;
            }

            // Se stiamo già caricando, non fare altro fetch
            if (isLoadingCache) {
                setIsLoadingOtherTasks(true);
                return;
            }

            // Carica i task solo se non sono in cache
            setIsLoadingOtherTasks(true);
            isLoadingCache = true;

            fetch('/api/factory/task-templates?taskType=Action')
                .then(res => res.json())
                .then(templates => {
                    const tasks = templates.map((template: any) => ({
                        id: template.id || template._id,
                        label: template.label || '',
                        description: template.description || '',
                        icon: template.icon || 'Circle',
                        color: template.color || 'text-gray-500',
                        type: template.type,
                        allowedContexts: template.allowedContexts || [],
                        templateId: template.id || template._id
                    }));
                    // Filter tasks that are allowed in escalation context
                    const filtered = filterTasksByContext(tasks, TaskContext.ESCALATION);

                    // ✅ Salva in cache globale
                    cachedOtherTasks = filtered;
                    setOtherTasks(filtered);
                    setIsLoadingOtherTasks(false);
                    isLoadingCache = false;
                })
                .catch(err => {
                    console.error('[RowTypePicker] Failed to load other tasks', err);
                    setOtherTasks([]);
                    setIsLoadingOtherTasks(false);
                    isLoadingCache = false;
                });
        }
    }, [isOtherExpanded]);

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

        // Keyboard shortcuts - ✅ Restituisce TaskType enum
        if (lower.length === 1 && /[a-z]/.test(lower)) {
            const map: Record<string, TaskType> = {
                a: TaskType.AIAgent,
                m: TaskType.SayMessage,
                d: TaskType.DataRequest,
                n: TaskType.Negotiation,
                p: TaskType.ClassifyProblem,
                s: TaskType.Summarizer,
                b: TaskType.BackendCall
            };
            const match = map[lower];
            if (match !== undefined && match !== currentType) { onPick(match); return; }
        }

        // Calculate total items (main options + separator + Other button + expanded tasks if expanded)
        const totalItems = MAIN_TYPE_OPTIONS.length + 1 + (isOtherExpanded ? 1 + otherTasks.length : 1);

        if (key === 'ArrowDown') setFocusIdx(i => Math.min(totalItems - 1, i + 1));
        else if (key === 'ArrowUp') setFocusIdx(i => Math.max(0, i - 1));
        else if (key === 'Enter') {
            // Handle selection based on focus index
            if (focusIdx < MAIN_TYPE_OPTIONS.length) {
                const opt = MAIN_TYPE_OPTIONS[focusIdx];
                if (opt && opt.value !== currentType) onPick(opt.value);
            } else if (focusIdx === MAIN_TYPE_OPTIONS.length) {
                // Separator - do nothing
            } else if (focusIdx === MAIN_TYPE_OPTIONS.length + 1) {
                // Other button - toggle expansion
                setIsOtherExpanded(!isOtherExpanded);
            } else if (isOtherExpanded && focusIdx > MAIN_TYPE_OPTIONS.length + 1) {
                // Other task selection
                const taskIdx = focusIdx - MAIN_TYPE_OPTIONS.length - 2;
                const task = otherTasks[taskIdx];
                if (task) {
                    // Pass the task object instead of TaskType enum
                    onPick({ task });
                }
            }
        } else if (key === 'Escape') {
            if (isOtherExpanded) {
                setIsOtherExpanded(false);
            } else {
                onRequestClose && onRequestClose();
            }
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
                maxWidth: isOtherExpanded ? 320 : 220,
                maxHeight: '80vh',
                overflowY: 'auto',
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
                {/* Main task types */}
                {MAIN_TYPE_OPTIONS.map((opt, i) => {
                    const isCurrent = currentType === opt.value;
                    return (
                        <button
                            key={opt.value}
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
                            onMouseDown={(e) => { if (isCurrent) return; e.preventDefault(); e.stopPropagation(); onPick(opt.value); }}
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

                {/* Separator */}
                <div
                    ref={el => (btnRefs.current[MAIN_TYPE_OPTIONS.length] = el)}
                    style={{
                        height: 1,
                        background: 'rgba(148,163,184,0.2)',
                        margin: '4px 0',
                        pointerEvents: 'none'
                    }}
                />

                {/* Other button */}
                <button
                    ref={el => (btnRefs.current[MAIN_TYPE_OPTIONS.length + 1] = el)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        minWidth: 180,
                        padding: '6px 8px',
                        border: 'none',
                        borderRadius: 8,
                        background: MAIN_TYPE_OPTIONS.length + 1 === focusIdx ? 'rgba(234,179,8,0.15)' : 'rgba(0,0,0,0.75)',
                        color: '#e5e7eb',
                        cursor: 'pointer',
                        outline: MAIN_TYPE_OPTIONS.length + 1 === focusIdx ? '1px solid rgba(234,179,8,0.45)' : 'none',
                    }}
                    className={combinedClass}
                    tabIndex={MAIN_TYPE_OPTIONS.length + 1 === focusIdx ? 0 : -1}
                    onMouseEnter={() => setFocusIdx(MAIN_TYPE_OPTIONS.length + 1)}
                    onFocus={() => setFocusIdx(MAIN_TYPE_OPTIONS.length + 1)}
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setIsOtherExpanded(!isOtherExpanded); }}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <MoreHorizontal className="w-4 h-4" style={{ color: '#94a3b8' }} />
                        <span>Other</span>
                    </span>
                    {isOtherExpanded ? (
                        <ChevronDown className="w-4 h-4" style={{ color: '#94a3b8' }} />
                    ) : (
                        <ChevronRight className="w-4 h-4" style={{ color: '#94a3b8' }} />
                    )}
                </button>

                {/* Expanded other tasks */}
                {isOtherExpanded && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4, paddingLeft: 8, borderLeft: '1px solid rgba(148,163,184,0.2)' }}>
                        {isLoadingOtherTasks ? (
                            <div style={{ padding: '8px', color: '#94a3b8', fontSize: '0.875rem' }}>Loading...</div>
                        ) : otherTasks.length === 0 ? (
                            <div style={{ padding: '8px', color: '#94a3b8', fontSize: '0.875rem' }}>No other tasks available</div>
                        ) : (
                            otherTasks.map((task, taskIdx) => {
                                const idx = MAIN_TYPE_OPTIONS.length + 2 + taskIdx;
                                const iconName = task.icon || 'Tag';
                                const taskColor = task.color ? ensureHexColor(task.color) : '#94a3b8';
                                const iconNode = getIconComponent(iconName, taskColor);

                                return (
                                    <button
                                        key={task.id || taskIdx}
                                        ref={el => (btnRefs.current[idx] = el)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: 8,
                                            minWidth: 160,
                                            padding: '6px 8px',
                                            border: 'none',
                                            borderRadius: 8,
                                            background: idx === focusIdx ? 'rgba(234,179,8,0.15)' : 'rgba(0,0,0,0.5)',
                                            color: '#e5e7eb',
                                            cursor: 'pointer',
                                            outline: idx === focusIdx ? '1px solid rgba(234,179,8,0.45)' : 'none',
                                            fontSize: '0.875rem',
                                        }}
                                        className={combinedClass}
                                        tabIndex={idx === focusIdx ? 0 : -1}
                                        onMouseEnter={() => setFocusIdx(idx)}
                                        onFocus={() => setFocusIdx(idx)}
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            // For other tasks, pass the task object instead of TaskType enum
                                            onPick({ task });
                                        }}
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                        title={task.description || task.label}
                                    >
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                                                {iconNode}
                                            </span>
                                            <span>{task.label || task.id}</span>
                                        </span>
                                    </button>
                                );
                            })
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

