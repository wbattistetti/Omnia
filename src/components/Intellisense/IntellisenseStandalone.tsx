import React, { useRef, useEffect, useState } from 'react';
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
    const wrapperRef = useRef<HTMLDivElement>(null);
    const rowContainerRef = useRef<HTMLDivElement>(null);
    const measureRef = useRef<HTMLSpanElement>(null);
    const [wrapperPosition, setWrapperPosition] = useState(position);
    const [inputWidth, setInputWidth] = useState(150); // Larghezza iniziale (verrà calcolata dinamicamente)
    const [minInputWidth, setMinInputWidth] = useState(150); // ✅ Larghezza minima dinamica
    const fontSizes = useDynamicFontSizes();

    // Forza il focus sulla textbox
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
            console.log("🎯 [IntellisenseStandalone] Focus forced on input");
        }
    }, []);

    // ✅ Calcola larghezza minima quando cambia il font size (anche senza testo)
    useEffect(() => {
        const sizes = calculateFontBasedSizes(fontSizes.nodeRow);
        const padding = sizes.inputPaddingH * 2; // padding sinistra + destra
        const border = 4; // 2px border sinistra + 2px destra

        // Calcola larghezza minima dinamica per 25 caratteri basata sul font size
        const fontSizeNum = parseFloat(fontSizes.nodeRow) || 14;
        const charWidth = fontSizeNum * 0.6; // Approssimazione larghezza carattere (monospace-like)
        const textWidthFor25Chars = 25 * charWidth; // Larghezza per 25 caratteri
        const minTextWidth = Math.ceil(textWidthFor25Chars + padding + border); // Larghezza minima totale

        setMinInputWidth(minTextWidth);
    }, [fontSizes.nodeRow]);

    // ✅ Misura larghezza del testo per allargare la textbox dinamicamente
    useEffect(() => {
        if (!measureRef.current || !inputRef.current) {
            return;
        }

        const measureText = () => {
            if (!measureRef.current || !inputRef.current) {
                return;
            }

            // Usa il testo attuale o il placeholder per misurare
            const text = state.query || inputRef.current.placeholder || '';
            measureRef.current.textContent = text || 'M'; // 'M' come carattere di riferimento
            const textWidth = measureRef.current.getBoundingClientRect().width;

            // Calcola larghezza minima: larghezza del testo + padding + border
            const sizes = calculateFontBasedSizes(fontSizes.nodeRow);
            const padding = sizes.inputPaddingH * 2; // padding sinistra + destra
            const border = 4; // 2px border sinistra + 2px destra

            // ✅ Calcola larghezza minima dinamica per 25 caratteri basata sul font size
            const fontSizeNum = parseFloat(fontSizes.nodeRow) || 14;
            const charWidth = fontSizeNum * 0.6; // Approssimazione larghezza carattere (monospace-like)
            const textWidthFor25Chars = 25 * charWidth; // Larghezza per 25 caratteri
            const minTextWidth = Math.ceil(textWidthFor25Chars + padding + border); // Larghezza minima totale

            // ✅ Salva la larghezza minima per usarla nello style
            setMinInputWidth(minTextWidth);

            const calculatedWidth = Math.max(
                textWidth + padding + border + 20, // +20 per margine di sicurezza
                minTextWidth
            );

            setInputWidth(calculatedWidth);
        };

        measureText();
    }, [state.query, fontSizes.nodeRow]);

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

    // ✅ Calcola posizione dinamica per centrare rispetto al referenceElement
    useEffect(() => {
        if (!referenceElement || !wrapperRef.current || !rowContainerRef.current) {
            // Se non c'è referenceElement, usa la posizione iniziale
            setWrapperPosition(position);
            return;
        }

        const updatePosition = () => {
            if (!referenceElement || !wrapperRef.current || !rowContainerRef.current) {
                return;
            }

            // Calcola arrowX (centro del referenceElement)
            const rect = referenceElement.getBoundingClientRect();
            const arrowX = rect.left + (rect.width / 2);

            // Misura la larghezza reale del row container (textbox + pulsanti)
            const rowWidth = rowContainerRef.current.getBoundingClientRect().width;

            // Calcola la posizione left del wrapper per centrare la textbox rispetto a arrowX
            // Il centro del row container deve essere allineato con arrowX
            const wrapperLeft = arrowX - (rowWidth / 2);

            // Mantieni la Y originale da position
            setWrapperPosition({
                x: wrapperLeft,
                y: position.y
            });
        };

        // Aggiorna posizione quando cambia il contenuto della textbox
        // Usa requestAnimationFrame per assicurarsi che il DOM sia renderizzato
        requestAnimationFrame(() => {
            requestAnimationFrame(updatePosition);
        });

        // Usa ResizeObserver per rilevare quando la textbox si allarga
        const resizeObserver = new ResizeObserver(() => {
            updatePosition();
        });

        if (rowContainerRef.current) {
            resizeObserver.observe(rowContainerRef.current);
        }

        return () => {
            resizeObserver.disconnect();
        };
    }, [state.query, referenceElement, position.y, inputWidth]);

    // ✅ Log rimosso per evitare spam

    return (
        <div
            ref={wrapperRef}
            className="intellisense-standalone-wrapper"
            style={{
                position: 'fixed',
                top: wrapperPosition.y,
                left: wrapperPosition.x,
                width: 'auto',
                minWidth: '420px', // ✅ Larghezza minima iniziale
                zIndex: 99999,
                background: 'transparent',
                border: 'none',
                padding: '12px'
            }}
            onClick={handleWrapperClick}
            onMouseDown={handleWrapperClick}
        >
            {/* ✅ Row con textbox + 3 pulsanti */}
            <div ref={rowContainerRef} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                {/* ✅ Usa utility centralizzata per dimensioni */}
                {(() => {
                    const sizes = calculateFontBasedSizes(fontSizes.nodeRow);

                    return (
                        <>
                            {/* Span invisibile per misurare la larghezza del testo */}
                            <span
                                ref={measureRef}
                                style={{
                                    position: 'absolute',
                                    visibility: 'hidden',
                                    whiteSpace: 'pre',
                                    fontSize: fontSizes.nodeRow,
                                    fontWeight: 'normal',
                                    padding: 0,
                                    margin: 0,
                                    height: 'auto',
                                    width: 'auto'
                                }}
                            />
                            {/* Textbox - larghezza dinamica basata sul contenuto */}
                            <input
                                ref={inputRef}
                                type="text"
                                value={state.query}
                                onChange={handleInputChange}
                                onKeyDown={handleKeyDown}
                                placeholder="Cerca condizioni o intenti..."
                                style={{
                                    width: `${inputWidth}px`,
                                    minWidth: `${minInputWidth}px`, // ✅ Larghezza minima dinamica per 25 caratteri
                                    padding: `${sizes.inputPaddingV}px ${sizes.inputPaddingH}px`,
                                    border: '2px solid #3b82f6',
                                    borderRadius: '4px',
                                    fontSize: fontSizes.nodeRow,
                                    lineHeight: 1.2,
                                    outline: 'none',
                                    boxSizing: 'border-box',
                                    background: '#fff',
                                    height: `${sizes.inputHeight}px`,
                                    minHeight: `${sizes.inputHeight}px`,
                                    transition: 'width 0.1s ease-out'
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
