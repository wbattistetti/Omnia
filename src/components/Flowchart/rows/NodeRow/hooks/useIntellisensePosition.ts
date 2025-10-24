import { useState, useEffect, useRef } from 'react';

interface UseIntellisensePositionProps {
    isEditing: boolean;
    inputRef: React.RefObject<HTMLTextAreaElement>;
}

/**
 * Manages stable intellisense menu positioning with debounced updates
 * Prevents flickering by using a single consistent calculation method
 */
export function useIntellisensePosition({
    isEditing,
    inputRef
}: UseIntellisensePositionProps) {
    const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
    const updateTimerRef = useRef<number | null>(null);
    const resizeObserverRef = useRef<ResizeObserver | null>(null);

    // Single source of truth for position calculation
    const calculatePosition = (): { left: number; top: number } | null => {
        if (!inputRef.current) {
            console.log('[IntellisensePosition] Input ref not available');
            return null;
        }

        const rect = inputRef.current.getBoundingClientRect();

        const position = {
            left: rect.left,
            top: rect.bottom + 4 // 4px gap below input
        };

        console.log('[IntellisensePosition] Calculated position:', {
            inputRect: { left: rect.left, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height },
            menuPosition: position
        });

        // Use simple, reliable screen coordinates
        return position;
    };

    // Debounced position update
    const scheduleUpdate = (immediate = false) => {
        if (updateTimerRef.current) {
            window.clearTimeout(updateTimerRef.current);
        }

        const delay = immediate ? 0 : 50; // 50ms debounce for resize events

        updateTimerRef.current = window.setTimeout(() => {
            const newPos = calculatePosition();
            setPosition(newPos);
            updateTimerRef.current = null;
        }, delay);
    };

    // Initialize position when editing starts
    useEffect(() => {
        if (isEditing) {
            // Small delay to ensure input is mounted and has correct dimensions
            const initTimer = window.setTimeout(() => {
                scheduleUpdate(true);
            }, 10);

            return () => window.clearTimeout(initTimer);
        } else {
            // Clear position when editing stops
            if (updateTimerRef.current) {
                window.clearTimeout(updateTimerRef.current);
                updateTimerRef.current = null;
            }
            setPosition(null);
        }
    }, [isEditing]);

    // Watch for textarea resize (multi-line expansion)
    useEffect(() => {
        if (!isEditing || !inputRef.current) {
            // Cleanup observer if exists
            if (resizeObserverRef.current) {
                resizeObserverRef.current.disconnect();
                resizeObserverRef.current = null;
            }
            return;
        }

        const el = inputRef.current;

        // Create debounced resize observer
        resizeObserverRef.current = new ResizeObserver(() => {
            // Debounced update on resize
            scheduleUpdate(false);
        });

        resizeObserverRef.current.observe(el);

        return () => {
            if (resizeObserverRef.current) {
                resizeObserverRef.current.disconnect();
                resizeObserverRef.current = null;
            }
            if (updateTimerRef.current) {
                window.clearTimeout(updateTimerRef.current);
                updateTimerRef.current = null;
            }
        };
    }, [isEditing]);

    // Update on scroll/viewport changes (with debouncing)
    useEffect(() => {
        if (!isEditing) return;

        const handleScroll = () => scheduleUpdate(false);
        const handleResize = () => scheduleUpdate(false);

        window.addEventListener('scroll', handleScroll, { passive: true, capture: true });
        window.addEventListener('resize', handleResize, { passive: true });

        return () => {
            window.removeEventListener('scroll', handleScroll, { capture: true });
            window.removeEventListener('resize', handleResize);
        };
    }, [isEditing]);

    return position;
}

