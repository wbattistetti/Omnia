// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronUp, Check, Trash2, X } from 'lucide-react';
import { stepMeta } from '@responseEditor/ddtUtils';
import { useFontContext } from '@context/FontContext';

type StepTabProps = {
    stepKey: string;
    expanded: boolean;
    disabled?: boolean;
    deleted?: boolean;
    messageCount?: number;
    onToggle: () => void;
    onToggleDisabled?: () => void;
    onDelete?: () => void;
    taskId?: string;
    node?: any;
};

export default function StepTab({
    stepKey,
    expanded,
    disabled = false,
    deleted = false,
    messageCount = 0,
    onToggle,
    onToggleDisabled,
    onDelete,
    taskId,
    node,
}: StepTabProps) {
    const { combinedClass } = useFontContext();
    const meta = stepMeta[stepKey];
    const [isHovered, setIsHovered] = useState(false);
    const [toolbarPosition, setToolbarPosition] = useState<{ top: number; left: number } | null>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    if (!meta) {
        console.warn('[StepTab] ⚠️ No meta found for stepKey:', stepKey, 'Available keys:', Object.keys(stepMeta));
    }

    const bgColor = meta?.bg || 'rgba(107,114,128,0.15)';
    const borderColor = meta?.border || '#6b7280';
    const textColor = meta?.color || '#64748b';

    // Apply disabled styling
    const effectiveBgColor = disabled ? `${bgColor}80` : bgColor;
    const effectiveBorderColor = disabled ? `${borderColor}80` : borderColor;
    const effectiveBorderStyle = disabled ? 'dashed' : 'solid';

    // Step obbligatori che non possono essere disattivati o eliminati
    const mandatorySteps = ['start'];
    const isMandatory = mandatorySteps.includes(stepKey);

    // Show toolbar only when hovered, not deleted, not mandatory, and taskId exists
    const showToolbar = isHovered && !deleted && !isMandatory && taskId;

    // Calcola posizione toolbar dinamicamente
    const updateToolbarPosition = () => {
        if (!buttonRef.current) return;
        const rect = buttonRef.current.getBoundingClientRect();
        const toolbarWidth = 60; // 28px + 28px + 4px gap
        const newPosition = {
            top: rect.top - 40, // 40px sopra la tab
            left: rect.right - toolbarWidth, // Allineata al bordo destro
        };
        setToolbarPosition(newPosition);
    };

    // Ricalcola posizione quando hover cambia o quando scroll/resize
    useEffect(() => {
        if (showToolbar) {
            // Usa setTimeout per assicurarsi che buttonRef.current sia disponibile
            const timer = setTimeout(() => {
                updateToolbarPosition();
            }, 0);

            // Listener per scroll (capture phase per catturare scroll di tutti i container)
            window.addEventListener('scroll', updateToolbarPosition, true);
            window.addEventListener('resize', updateToolbarPosition);

            return () => {
                clearTimeout(timer);
                window.removeEventListener('scroll', updateToolbarPosition, true);
                window.removeEventListener('resize', updateToolbarPosition);
            };
        } else {
            setToolbarPosition(null);
        }
    }, [showToolbar, isHovered]); // Aggiunto isHovered come dipendenza

    return (
        <>
            {/* Toolbar - Portal React per renderizzare fuori dal DOM scrollabile */}
            {showToolbar && toolbarPosition && typeof document !== 'undefined' &&
                createPortal(
                    <div
                        onClick={(e) => e.stopPropagation()}
                        onMouseEnter={() => setIsHovered(true)}
                        onMouseLeave={() => setIsHovered(false)}
                        style={{
                            position: 'fixed',
                            top: `${toolbarPosition.top}px`,
                            left: `${toolbarPosition.left}px`,
                            display: 'flex',
                            gap: 4,
                            backgroundColor: '#fff',
                            border: '1px solid #e5e7eb',
                            borderRadius: 6,
                            padding: '4px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                            zIndex: 10000,
                            pointerEvents: 'auto',
                        }}
                    >
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onToggleDisabled?.();
                            }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 28,
                                height: 28,
                                border: 'none',
                                background: disabled ? 'transparent' : '#10b981',
                                color: disabled ? '#6b7280' : '#fff',
                                borderRadius: 4,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                            }}
                            title={disabled ? 'Enable step' : 'Disable step'}
                        >
                            {disabled ? <Check size={16} /> : <X size={16} />}
                        </button>
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onDelete?.();
                            }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 28,
                                height: 28,
                                border: 'none',
                                background: 'transparent',
                                color: '#ef4444',
                                borderRadius: 4,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                            }}
                            title="Delete step from instance"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>,
                    document.body
                )
            }

            {/* Wrapper comune per tab e gestione hover */}
            <div
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                style={{
                    position: 'relative',
                    width: '100%',
                }}
            >
                {/* Tab button */}
                <button
                    ref={buttonRef}
                    onMouseEnter={(e) => {
                        e.stopPropagation();
                        setIsHovered(true);
                    }}
                    onMouseLeave={(e) => {
                        e.stopPropagation();
                        setIsHovered(false);
                    }}
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
                        background: isHovered ? (meta?.bgActive || effectiveBgColor) : effectiveBgColor,
                        border: `2px ${effectiveBorderStyle} ${effectiveBorderColor}`,
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'background 0.2s',
                        position: 'relative',
                        textDecoration: disabled ? 'line-through' : 'none',
                    }}
                >
                    <span style={{ color: borderColor, display: 'flex', alignItems: 'center' }}>
                        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </span>
                    <span style={{ color: borderColor, display: 'flex', alignItems: 'center' }}>
                        {meta?.icon || null}
                    </span>
                    <span className={combinedClass} style={{ fontWeight: 700, color: borderColor, flex: 1 }}>
                        {meta?.label || stepKey}
                    </span>
                    <span className={combinedClass} style={{ color: textColor, opacity: 0.7 }}>
                        {messageCount} {messageCount === 1 ? 'message' : 'messages'}
                    </span>
                </button>
            </div>
        </>
    );
}
