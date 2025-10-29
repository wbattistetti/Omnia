import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

type Props = {
    onExpandAll: () => void;
    onCollapseAll: () => void;
    onStyleChange?: (style: string) => void;
    onParamChange?: (param: string, enabled: boolean) => void;
    activeParams?: Set<string>;
};

const STYLE_OPTIONS = [
    { key: 'formal', label: 'Formal', color: '#3b82f6' },
    { key: 'informal', label: 'Informal', color: '#10b981' },
    { key: 'concise', label: 'Concise', color: '#f59e0b' },
    { key: 'verbose', label: 'Verbose', color: '#8b5cf6' },
    { key: 'authoritative', label: 'Authoritative', color: '#ef4444' },
    { key: 'empathetic', label: 'Empathetic', color: '#ec4899' },
];

// Parametri accumulabili (si possono combinare)
const ACCUMULABLE_PARAMS = [
    { key: 'latency', label: 'Latency', color: '#6366f1' },
    { key: 'uncertainty', label: 'mmm...', color: '#a855f7' },
    { key: 'echo', label: 'Echo', color: '#06b6d4' },
];

// Culture options in alphabetical order
const CULTURE_OPTIONS = [
    { key: 'br', label: 'Brasile', color: '#10b981' },
    { key: 'fr', label: 'Francia', color: '#3b82f6' },
    { key: 'de', label: 'Germania', color: '#6366f1' },
    { key: 'it', label: 'Italia', color: '#f59e0b' },
    { key: 'es', label: 'Spagna', color: '#ef4444' },
    { key: 'us', label: 'Stati Uniti', color: '#8b5cf6' },
].sort((a, b) => a.label.localeCompare(b.label));

export default function MessageReviewToolbar({
    onExpandAll,
    onCollapseAll,
    onStyleChange,
    onParamChange,
    activeParams = new Set()
}: Props) {
    const [cultureDropdownOpen, setCultureDropdownOpen] = React.useState(false);
    const cultureDropdownRef = React.useRef<HTMLDivElement>(null);

    // Find active culture or default to Italy
    const activeCulture = CULTURE_OPTIONS.find(c => activeParams.has(c.key)) || CULTURE_OPTIONS.find(c => c.key === 'it') || CULTURE_OPTIONS[3];

    // Close dropdown when clicking outside
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (cultureDropdownRef.current && !cultureDropdownRef.current.contains(event.target as Node)) {
                setCultureDropdownOpen(false);
            }
        };

        if (cultureDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [cultureDropdownOpen]);

    const handleCultureSelect = (cultureKey: string) => {
        // Activate selected culture (mutual exclusivity handled in parent component)
        onParamChange?.(cultureKey, true);
        setCultureDropdownOpen(false);
    };

    return (
        <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            background: '#f8fafc'
        }}>
            {/* Center - Style controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {STYLE_OPTIONS.map((style) => (
                    <button
                        key={style.key}
                        onClick={() => onStyleChange?.(style.key)}
                        style={{
                            background: 'transparent',
                            border: `1px solid ${style.color}`,
                            borderRadius: 6,
                            padding: '4px 8px',
                            cursor: 'pointer',
                            fontSize: 11,
                            color: style.color,
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = style.color;
                            e.currentTarget.style.color = 'white';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = style.color;
                        }}
                        title={`Apply ${style.label} style`}
                    >
                        {style.label}
                    </button>
                ))}
            </div>

            {/* Accumulable parameters */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {ACCUMULABLE_PARAMS.map((param) => {
                    const isActive = activeParams.has(param.key);
                    return (
                        <button
                            key={param.key}
                            onClick={() => onParamChange?.(param.key, !isActive)}
                            style={{
                                background: isActive ? param.color : 'transparent',
                                border: `1px solid ${param.color}`,
                                borderRadius: 6,
                                padding: '4px 8px',
                                cursor: 'pointer',
                                fontSize: 11,
                                color: isActive ? 'white' : param.color,
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                                if (!isActive) {
                                    e.currentTarget.style.background = param.color;
                                    e.currentTarget.style.color = 'white';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!isActive) {
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.color = param.color;
                                }
                            }}
                            title={`Toggle ${param.label} parameter`}
                        >
                            {param.label}
                        </button>
                    );
                })}
            </div>

            {/* Culture dropdown */}
            <div ref={cultureDropdownRef} style={{ position: 'relative' }}>
                <button
                    onClick={() => setCultureDropdownOpen(!cultureDropdownOpen)}
                    style={{
                        background: activeCulture.color,
                        border: `1px solid ${activeCulture.color}`,
                        borderRadius: 6,
                        padding: '4px 12px',
                        cursor: 'pointer',
                        fontSize: 11,
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = '0.9';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = '1';
                    }}
                    title="Select culture"
                >
                    {activeCulture.label}
                    <ChevronDown size={14} />
                </button>

                {cultureDropdownOpen && (
                    <div
                        style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            marginTop: 4,
                            background: 'white',
                            border: '1px solid #e2e8f0',
                            borderRadius: 6,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                            zIndex: 1000,
                            minWidth: 150,
                            overflow: 'hidden'
                        }}
                    >
                        {CULTURE_OPTIONS.map((culture) => (
                            <button
                                key={culture.key}
                                onClick={() => handleCultureSelect(culture.key)}
                                style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    background: activeCulture.key === culture.key ? '#f3f4f6' : 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: 11,
                                    color: '#1f2937',
                                    textAlign: 'left',
                                    display: 'flex',
                                    alignItems: 'center',
                                    transition: 'background 0.15s'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = '#f9fafb';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = activeCulture.key === culture.key ? '#f3f4f6' : 'transparent';
                                }}
                            >
                                {culture.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Right side - Expand/Collapse controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                    onClick={onExpandAll}
                    style={{
                        background: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: 6,
                        padding: '6px 8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                    }}
                    title="Expand all accordions"
                >
                    <ChevronDown size={16} />
                </button>
                <button
                    onClick={onCollapseAll}
                    style={{
                        background: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: 6,
                        padding: '6px 8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                    }}
                    title="Collapse all accordions"
                >
                    <ChevronUp size={16} />
                </button>
            </div>
        </div>
    );
}

