import React, { useRef, useEffect, useLayoutEffect, useState, useCallback } from 'react';
import { Link2Off as LinkOff, X } from 'lucide-react';
import { useIntellisense } from '../../context/IntellisenseContext';
import { IntellisenseMenu } from './IntellisenseMenu';
import { IntellisenseItem } from '../../types/intellisense';
import { useDynamicFontSizes } from '../../hooks/useDynamicFontSizes';
import { calculateFontBasedSizes } from '../../utils/fontSizeUtils';
import { VoiceInput } from '../common/VoiceInput';
import type { EdgeLinkChoice } from './edgeLinkChoice';
import { edgeLinkChoiceFromInputText, edgeLinkChoiceFromIntellisenseItem } from './edgeLinkChoice';

/** Sopra il backdrop edge (100000) in IntellisensePopover. */
const STANDALONE_Z = 100_001;

/**
 * Editor compatto per condizione su edge nuovo: solo textbox + azioni a destra,
 * senza pannello contenitore, ancorato al punto medio del link (coordinate schermo).
 * Il menu usa `inlineAnchor`: l’host gestisce Enter/Frecce; la scelta è sempre un `EdgeLinkChoice`
 * immutabile (nessuna dipendenza da state.query dopo close nel parent).
 */
interface IntellisenseStandaloneProps {
    anchorScreen: { x: number; y: number };
    extraItems: IntellisenseItem[];
    allowedKinds?: Array<'condition' | 'intent'>;
    onCommit: (choice: EdgeLinkChoice) => void;
    /** Chiude il contesto; il parent esegue cleanup edge/nodo temporaneo se necessario. */
    onClose: () => void;
}

export const IntellisenseStandalone: React.FC<IntellisenseStandaloneProps> = ({
    anchorScreen,
    extraItems,
    allowedKinds,
    onCommit,
    onClose,
}) => {
    const { state, actions } = useIntellisense();
    const inputRef = useRef<HTMLInputElement>(null);
    /** Box del solo `<input>` (bordo/campo), da VoiceInput.chromeRef; centro sul midpoint del link. */
    const inputChromeRef = useRef<HTMLDivElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const measureRef = useRef<HTMLSpanElement>(null);
    const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLDivElement | null>(null);
    const [measured, setMeasured] = useState(false);
    const [wrapperPosition, setWrapperPosition] = useState({ x: 0, y: 0 });
    const [inputWidth, setInputWidth] = useState(150);
    const [minInputWidth, setMinInputWidth] = useState(150);
    const [navSeq, setNavSeq] = useState(0);
    const [navDir, setNavDir] = useState<1 | -1>(1);
    const fontSizes = useDynamicFontSizes();
    /** Set when menu confirms a row (click o intelli-enter) così Enter non invia anche testo libero. */
    const menuEnterHandledRef = useRef(false);

    const bindRowContainerRef = useCallback((el: HTMLDivElement | null) => {
        setMenuAnchorEl(el);
    }, []);

    useEffect(() => {
        setMeasured(false);
    }, [anchorScreen.x, anchorScreen.y]);

    useLayoutEffect(() => {
        const run = () => {
            const wrap = wrapperRef.current;
            const chrome = inputChromeRef.current;
            if (!wrap || !chrome) return;
            const wrapRect = wrap.getBoundingClientRect();
            const chromeRect = chrome.getBoundingClientRect();
            if (chromeRect.width <= 0 || chromeRect.height <= 0) {
                requestAnimationFrame(run);
                return;
            }
            const offsetX = chromeRect.left - wrapRect.left;
            const offsetYTop = chromeRect.top - wrapRect.top;
            setWrapperPosition({
                x: anchorScreen.x - chromeRect.width / 2 - offsetX,
                y: anchorScreen.y - chromeRect.height / 2 - offsetYTop,
            });
            setMeasured(true);
        };
        run();
    }, [anchorScreen.x, anchorScreen.y, state.query, inputWidth, fontSizes.nodeRow]);

    useEffect(() => {
        if (!measured) return;
        inputRef.current?.focus();
    }, [measured]);

    useEffect(() => {
        const sizes = calculateFontBasedSizes(fontSizes.nodeRow);
        const padding = sizes.inputPaddingH * 2;
        const border = 4;
        const fontSizeNum = parseFloat(fontSizes.nodeRow) || 14;
        const charWidth = fontSizeNum * 0.6;
        const minTextWidth = Math.ceil(25 * charWidth + padding + border);
        setMinInputWidth(minTextWidth);
    }, [fontSizes.nodeRow]);

    useEffect(() => {
        if (!measureRef.current || !inputRef.current) return;

        const text = state.query || inputRef.current.placeholder || '';
        measureRef.current.textContent = text || 'M';
        const textWidth = measureRef.current.getBoundingClientRect().width;
        const sizes = calculateFontBasedSizes(fontSizes.nodeRow);
        const padding = sizes.inputPaddingH * 2;
        const border = 4;
        const fontSizeNum = parseFloat(fontSizes.nodeRow) || 14;
        const charWidth = fontSizeNum * 0.6;
        const minTextWidth = Math.ceil(25 * charWidth + padding + border);
        setMinInputWidth(minTextWidth);
        setInputWidth(Math.max(textWidth + padding + border + 20, minTextWidth));
    }, [state.query, fontSizes.nodeRow]);

    useEffect(() => {
        const wrap = wrapperRef.current;
        if (!wrap) return;
        const ro = new ResizeObserver(() => {
            const chrome = inputChromeRef.current;
            if (!wrap || !chrome) return;
            const wrapRect = wrap.getBoundingClientRect();
            const chromeRect = chrome.getBoundingClientRect();
            if (chromeRect.width <= 0 || chromeRect.height <= 0) return;
            const offsetX = chromeRect.left - wrapRect.left;
            const offsetYTop = chromeRect.top - wrapRect.top;
            setWrapperPosition({
                x: anchorScreen.x - chromeRect.width / 2 - offsetX,
                y: anchorScreen.y - chromeRect.height / 2 - offsetYTop,
            });
        });
        ro.observe(wrap);
        return () => ro.disconnect();
    }, [anchorScreen.x, anchorScreen.y]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        actions.setQuery(e.target.value);
    };

    const handleMenuSelect = useCallback(
        (item: IntellisenseItem | null) => {
            if (!item) return;
            menuEnterHandledRef.current = true;
            onCommit(edgeLinkChoiceFromIntellisenseItem(item));
        },
        [onCommit]
    );

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            e.stopPropagation();
            const dir = e.key === 'ArrowDown' ? 1 : -1;
            setNavDir(dir);
            setNavSeq((s) => s + 1);
            return;
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            menuEnterHandledRef.current = false;
            try {
                document.dispatchEvent(new CustomEvent('intelli-enter'));
            } catch {
                /* ignore */
            }
            if (menuEnterHandledRef.current) {
                return;
            }
            const text = (e.currentTarget as HTMLInputElement).value;
            onCommit(edgeLinkChoiceFromInputText(text));
        } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            onClose();
        }
    };

    const handleElseClick = () => {
        onCommit({ kind: 'else' });
    };

    const handleUnlinkedClick = () => {
        onCommit({ kind: 'unlinked' });
    };

    const stopFlowPropagation = (e: React.MouseEvent) => {
        e.stopPropagation();
    };

    const preLayoutLeft = anchorScreen.x - 160;
    const preLayoutTop = anchorScreen.y - 28;

    return (
        <div
            ref={wrapperRef}
            className="intellisense-standalone-wrapper"
            style={{
                position: 'fixed',
                top: measured ? wrapperPosition.y : preLayoutTop,
                left: measured ? wrapperPosition.x : preLayoutLeft,
                zIndex: STANDALONE_Z,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 6,
                background: 'transparent',
                boxShadow: 'none',
                border: 'none',
                padding: 0,
                minWidth: measured ? undefined : 320,
                minHeight: measured ? undefined : 56,
                opacity: measured ? 1 : 0,
                pointerEvents: 'auto',
            }}
            onClick={stopFlowPropagation}
            onMouseDown={stopFlowPropagation}
        >
            <div
                ref={bindRowContainerRef}
                style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap' }}
            >
                <span
                    ref={measureRef}
                    aria-hidden
                    style={{
                        position: 'absolute',
                        visibility: 'hidden',
                        whiteSpace: 'pre',
                        fontSize: fontSizes.nodeRow,
                        fontWeight: 'normal',
                        padding: 0,
                        margin: 0,
                        height: 'auto',
                        width: 'auto',
                    }}
                />
                {(() => {
                    const sizes = calculateFontBasedSizes(fontSizes.nodeRow);
                    return (
                        <>
                            <div style={{ display: 'inline-block', flexShrink: 0 }}>
                            <VoiceInput
                                ref={inputRef}
                                chromeRef={inputChromeRef}
                                type="text"
                                value={state.query}
                                onChange={handleInputChange}
                                onKeyDown={handleKeyDown}
                                placeholder="Cerca condizioni o intenti..."
                                autoStartWhenEmpty={true}
                                style={{
                                    width: `${inputWidth}px`,
                                    minWidth: `${minInputWidth}px`,
                                    paddingTop: `${sizes.inputPaddingV}px`,
                                    paddingBottom: `${sizes.inputPaddingV}px`,
                                    paddingLeft: `${sizes.inputPaddingH}px`,
                                    borderWidth: '1px',
                                    borderStyle: 'solid',
                                    borderColor: 'rgba(148, 163, 184, 0.55)',
                                    borderRadius: '6px',
                                    fontSize: fontSizes.nodeRow,
                                    lineHeight: 1.2,
                                    outline: 'none',
                                    boxSizing: 'border-box',
                                    background: 'rgba(15, 23, 42, 0.92)',
                                    color: '#f1f5f9',
                                    height: `${sizes.inputHeight}px`,
                                    minHeight: `${sizes.inputHeight}px`,
                                    transition: 'width 0.1s ease-out',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.35)',
                                }}
                            />
                            </div>
                            <button
                                type="button"
                                onClick={handleElseClick}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: `${sizes.buttonPaddingV}px ${sizes.buttonPaddingH}px`,
                                    fontSize: fontSizes.nodeRow,
                                    fontWeight: 600,
                                    borderRadius: '6px',
                                    border: '1px solid #9333ea',
                                    background: '#9333ea',
                                    color: '#fff',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                    height: `${sizes.buttonHeight}px`,
                                    minHeight: `${sizes.buttonHeight}px`,
                                    boxSizing: 'border-box',
                                }}
                                title="Else: ramo di fallback quando altre condizioni sono false"
                            >
                                Else
                            </button>
                            <button
                                type="button"
                                onClick={handleUnlinkedClick}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: `${sizes.iconButtonSize}px`,
                                    height: `${sizes.iconButtonSize}px`,
                                    background: 'rgba(30, 41, 59, 0.9)',
                                    border: '1px solid rgba(148, 163, 184, 0.4)',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    minWidth: `${sizes.iconButtonSize}px`,
                                    minHeight: `${sizes.iconButtonSize}px`,
                                }}
                                title="Collegamento senza condizione"
                            >
                                <LinkOff size={sizes.iconSize} color="#94a3b8" />
                            </button>
                            <button
                                type="button"
                                onClick={onClose}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: `${sizes.iconButtonSize}px`,
                                    height: `${sizes.iconButtonSize}px`,
                                    background: 'rgba(127, 29, 29, 0.35)',
                                    border: '1px solid rgba(248, 113, 113, 0.45)',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    minWidth: `${sizes.iconButtonSize}px`,
                                    minHeight: `${sizes.iconButtonSize}px`,
                                }}
                                title="Annulla (ESC)"
                            >
                                <X size={sizes.iconSize} color="#fca5a5" />
                            </button>
                        </>
                    );
                })()}
            </div>

            <IntellisenseMenu
                isOpen={measured && !!menuAnchorEl}
                query={state.query}
                position={anchorScreen}
                referenceElement={menuAnchorEl}
                onSelect={handleMenuSelect}
                onClose={onClose}
                extraItems={extraItems}
                allowedKinds={allowedKinds}
                mode="inline"
                inlineAnchor
                navSignal={{ seq: navSeq, dir: navDir }}
                disableDocumentClickOutside
            />
        </div>
    );
};
