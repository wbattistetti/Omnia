import React, { useRef, useEffect } from 'react';
import { Link2Off as LinkOff, X } from 'lucide-react';
import { useIntellisense } from "../../context/IntellisenseContext";
import { IntellisenseMenu } from './IntellisenseMenu';
import { IntellisenseItem } from '../../types/intellisense';
import { useDynamicFontSizes } from '../../hooks/useDynamicFontSizes';
import { calculateFontBasedSizes } from '../../utils/fontSizeUtils';

interface IntellisenseStandaloneProps {
    position: { x: number; y: number };
    referenceElement: HTMLElement | null;
    extraItems: IntellisenseItem[];
    allowedKinds?: Array<'condition' | 'intent'>;
    onSelect: (item: IntellisenseItem | null) => void;
    onClose: () => void;
}

export const IntellisenseStandalone: React.FC<IntellisenseStandaloneProps> = ({
    position,
    referenceElement,
    extraItems,
    allowedKinds,
    onSelect,
    onClose
}) => {
    const { state, actions } = useIntellisense();
    const inputRef = useRef<HTMLInputElement>(null);
    const fontSizes = useDynamicFontSizes();

    // Forza il focus sulla textbox
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
            console.log("🎯 [IntellisenseStandalone] Focus forced on input");
        }
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        console.log("🎯 [IntellisenseStandalone] Input change:", e.target.value);
        actions.setQuery(e.target.value);
    };

    // ✅ Handler per Enter: se vuoto → unconditioned, altrimenti custom text
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();

            const text = state.query.trim();

            if (text.length === 0) {
                // ✅ Textbox vuota → Unconditioned (come click su LinkOff)
                console.log("🎯 [IntellisenseStandalone] Enter with empty text - unconditioned");
                onSelect({
                    id: '__unlinked__',
                    label: '',
                    kind: 'condition',
                    category: 'special'
                } as any);
            } else {
                // ✅ Textbox con testo → Condizione custom
                console.log("🎯 [IntellisenseStandalone] Enter pressed - applying text:", text);
                onSelect(null);
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            console.log("🎯 [IntellisenseStandalone] Escape pressed - canceling");
            handleCancelClick();
        }
    };

    // ✅ Handler per Else button
    const handleElseClick = () => {
        console.log("🎯 [IntellisenseStandalone] Else clicked");
        onSelect({
            id: '__else__',
            label: 'Else',
            kind: 'condition',
            category: 'special'
        } as any);
    };

    // ✅ Handler per Unlinked button
    const handleUnlinkedClick = () => {
        console.log("🎯 [IntellisenseStandalone] Unlinked clicked");
        onSelect({
            id: '__unlinked__',
            label: '',
            kind: 'condition',
            category: 'special'
        } as any);
    };

    // ✅ Handler per Cancel (X) button - cleanup completo
    const handleCancelClick = () => {
        console.log("🎯 [IntellisenseStandalone] Cancel clicked - cleanup temp nodes");

        // ✅ Chiudi Intellisense (onClose ora gestisce anche il cleanup per gli edge)
        onClose();

        // ✅ CLEANUP: Chiama anche qui come fallback (onClose potrebbe non avere il contesto dell'edge)
        const cleanupTempNodesAndEdges = (window as any).__cleanupAllTempNodesAndEdges;
        if (cleanupTempNodesAndEdges) {
            cleanupTempNodesAndEdges();
            console.log("🎯 [IntellisenseStandalone] Cleanup function called (fallback)");
        }
    };

    // ✅ Handler per prevenire la propagazione del click
    const handleWrapperClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        console.log("🎯 [IntellisenseStandalone] Wrapper click - preventing close");
    };

    // ✅ Log rimosso per evitare spam

    return (
        <div
            className="intellisense-standalone-wrapper"
            style={{
                position: 'fixed',
                top: position.y,
                left: position.x,
                width: '420px',
                zIndex: 99999,
                background: 'transparent',
                border: 'none',
                padding: '12px'
            }}
            onClick={handleWrapperClick}
            onMouseDown={handleWrapperClick}
        >
            {/* ✅ Row con textbox + 3 pulsanti */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                {/* ✅ Usa utility centralizzata per dimensioni */}
                {(() => {
                    const sizes = calculateFontBasedSizes(fontSizes.nodeRow);

                    return (
                        <>
                            {/* Textbox - proporzionale al font */}
                            <input
                                ref={inputRef}
                                type="text"
                                value={state.query}
                                onChange={handleInputChange}
                                onKeyDown={handleKeyDown}
                                placeholder="Cerca condizioni o intenti..."
                                style={{
                                    flex: 0.5,
                                    padding: `${sizes.inputPaddingV}px ${sizes.inputPaddingH}px`,
                                    border: '2px solid #3b82f6',
                                    borderRadius: '4px',
                                    fontSize: fontSizes.nodeRow,
                                    lineHeight: 1.2,
                                    outline: 'none',
                                    boxSizing: 'border-box',
                                    background: '#fff',
                                    height: `${sizes.inputHeight}px`,
                                    minHeight: `${sizes.inputHeight}px`
                                }}
                            />

                            {/* ✅ Button 1: Else - proporzionale al font */}
                            <button
                                onClick={handleElseClick}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: `${sizes.buttonPaddingV}px ${sizes.buttonPaddingH}px`,
                                    fontSize: fontSizes.nodeRow,
                                    fontWeight: 600,
                                    borderRadius: '4px',
                                    border: '1px solid #9333ea',
                                    background: '#9333ea',
                                    color: '#fff',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                    transition: 'background 150ms',
                                    height: `${sizes.buttonHeight}px`,
                                    minHeight: `${sizes.buttonHeight}px`,
                                    boxSizing: 'border-box'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#7e22ce'}
                                onMouseLeave={(e) => e.currentTarget.style.background = '#9333ea'}
                                title="Else: ramo di fallback quando altre condizioni sono false"
                            >
                                Else
                            </button>

                            {/* ✅ Button 2: Unlinked - proporzionale al font */}
                            <button
                                onClick={handleUnlinkedClick}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: `${sizes.iconButtonSize}px`,
                                    height: `${sizes.iconButtonSize}px`,
                                    background: '#f3f4f6',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    transition: 'background 150ms',
                                    minWidth: `${sizes.iconButtonSize}px`,
                                    minHeight: `${sizes.iconButtonSize}px`
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#e5e7eb'}
                                onMouseLeave={(e) => e.currentTarget.style.background = '#f3f4f6'}
                                title="Collegamento senza condizione"
                            >
                                <LinkOff size={sizes.iconSize} color="#6b7280" />
                            </button>

                            {/* ✅ Button 3: Cancel - proporzionale al font */}
                            <button
                                onClick={handleCancelClick}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: `${sizes.iconButtonSize}px`,
                                    height: `${sizes.iconButtonSize}px`,
                                    background: '#fef2f2',
                                    border: '1px solid #fca5a5',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    transition: 'background 150ms',
                                    minWidth: `${sizes.iconButtonSize}px`,
                                    minHeight: `${sizes.iconButtonSize}px`
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#fee2e2'}
                                onMouseLeave={(e) => e.currentTarget.style.background = '#fef2f2'}
                                title="Annulla (ESC)"
                            >
                                <X size={sizes.iconSize} color="#dc2626" />
                            </button>
                        </>
                    );
                })()}
            </div>

            {/* IntellisenseMenu (solo lista, mode=inline) */}
            <IntellisenseMenu
                isOpen={true}
                query={state.query}
                position={position}
                referenceElement={referenceElement}
                onSelect={(item) => {
                    console.log("🎯 [IntellisenseStandalone] Item selected from menu:", item);
                    onSelect(item);
                }}
                onClose={onClose}
                extraItems={extraItems}
                allowedKinds={allowedKinds}
                mode="inline"
            />
        </div>
    );
};
