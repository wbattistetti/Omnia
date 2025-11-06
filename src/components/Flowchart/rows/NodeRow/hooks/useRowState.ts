import { useState, useRef, useEffect } from 'react';
import { NodeRowData } from '../../../../../types/NodeRowTypes';

interface UseRowStateProps {
    row: NodeRowData;
    forceEditing?: boolean;
}

/**
 * Manages all local state for a NodeRow component
 * Extracts state management to simplify the main component
 */
export function useRowState({ row, forceEditing = false }: UseRowStateProps) {
    // Editing state
    const [isEditing, setIsEditing] = useState(forceEditing);
    const [hasEverBeenEditing, setHasEverBeenEditing] = useState(forceEditing);
    const [currentText, setCurrentText] = useState(row.text);

    // Inclusion state
    const [included, setIncluded] = useState(row.included !== false); // default true

    // Intellisense state
    const [showIntellisense, setShowIntellisense] = useState(false);
    const [intellisenseQuery, setIntellisenseQuery] = useState('');
    const suppressIntellisenseRef = useRef<boolean>(false);
    const intellisenseTimerRef = useRef<number | null>(null);

  // Type picker state
  const [allowCreatePicker, setAllowCreatePicker] = useState(false);
  const [showCreatePicker, setShowCreatePicker] = useState(false);

  // Toolbar/icons state
    const [showIcons, setShowIcons] = useState(false);
    const [iconPos, setIconPos] = useState<{ top: number, left: number } | null>(null);

    // Refs
    const typeToolbarRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const nodeContainerRef = useRef<HTMLDivElement>(null);
    const labelRef = useRef<HTMLSpanElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);
    const mousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const buttonCloseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Track global mouse position for stability buffer
    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            mousePosRef.current = { x: e.clientX, y: e.clientY };
        };
        window.addEventListener('mousemove', onMove, { passive: true });
        return () => window.removeEventListener('mousemove', onMove);
    }, []);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (buttonCloseTimeoutRef.current) {
                clearTimeout(buttonCloseTimeoutRef.current);
                buttonCloseTimeoutRef.current = null;
            }
        };
    }, []);

    // Hide action overlay while editing to avoid ghost bars
    useEffect(() => {
        if (isEditing) setShowIcons(false);
    }, [isEditing]);

    // Sync currentText with row.text when row changes
    useEffect(() => {
        setCurrentText(row.text);
    }, [row.text]);

    return {
        // Editing state
        isEditing,
        setIsEditing,
        hasEverBeenEditing,
        setHasEverBeenEditing,
        currentText,
        setCurrentText,

        // Inclusion state
        included,
        setIncluded,

        // Intellisense state
        showIntellisense,
        setShowIntellisense,
        intellisenseQuery,
        setIntellisenseQuery,
        suppressIntellisenseRef,
        intellisenseTimerRef,

        // Type picker state
        allowCreatePicker,
        setAllowCreatePicker,
        showCreatePicker,
        setShowCreatePicker,

        // Toolbar/icons state
        showIcons,
        setShowIcons,
        iconPos,
        setIconPos,

        // Refs
        typeToolbarRef,
        inputRef,
        nodeContainerRef,
        labelRef,
        overlayRef,
        mousePosRef,
        buttonCloseTimeoutRef
    };
}

