// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useMemo, useRef, useLayoutEffect, useState, useCallback } from 'react';
import { getNodesBounds, Node } from 'reactflow';

/**
 * Configuration options for the scrollable flow hook
 */
export interface UseScrollableFlowOptions {
    /** Padding around the content area in pixels */
    padding?: number;
    /** Minimum width for the spacer element */
    minWidth?: number;
    /** Minimum height for the spacer element */
    minHeight?: number;
    /** Whether to automatically center the viewport on mount */
    autoCenter?: boolean;
    /** Whether to recalculate bounds when nodes change */
    recalculateOnNodeChange?: boolean;
}

/**
 * Return type for the useScrollableFlow hook
 */
export interface UseScrollableFlowReturn {
    /** Reference to the wrapper container element */
    wrapperRef: React.RefObject<HTMLDivElement>;
    /** Calculated size for the spacer element */
    spacerSize: { width: number; height: number };
    /** Current panning state */
    isPanning: boolean;
    /** Function to set panning state */
    setIsPanning: (panning: boolean) => void;
    /** Function to fit the view to content */
    handleFitView: () => void;
    /** Function to scroll to a specific position */
    scrollToPosition: (x: number, y: number) => void;
    /** Function to get current scroll position */
    getScrollPosition: () => { x: number; y: number };
}

/**
 * Custom hook for managing scrollable React Flow behavior
 *
 * This hook provides:
 * - Automatic bounds calculation based on node positions
 * - Scrollable wrapper with proper sizing
 * - Pan state management
 * - View fitting and positioning utilities
 *
 * @param nodes - Array of React Flow nodes
 * @param options - Configuration options
 * @returns Hook return object with refs, state, and utility functions
 */
export const useScrollableFlow = (
    nodes: Node[],
    options: UseScrollableFlowOptions = {}
): UseScrollableFlowReturn => {
    const {
        padding = 400,
        minWidth = 1200,
        minHeight = 800,
        autoCenter = true,
        recalculateOnNodeChange = true
    } = options;

    const wrapperRef = useRef<HTMLDivElement>(null);
    const [isPanning, setIsPanning] = useState(false);

    // Calculate spacer size based on node bounds with real dimensions
    const spacerSize = useMemo(() => {
        if (!nodes.length) {
            return { width: minWidth, height: minHeight };
        }

        try {
            // Custom bounds calculation that considers real node dimensions
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

            nodes.forEach((node) => {
                const pos = node.position;
                const NODE_WIDTH = 280; // Standard node width

                // Calculate dynamic node height based on content
                let nodeHeight = 40; // Base height
                if (node.data?.rows && Array.isArray(node.data.rows)) {
                    // Add height for each row (24px per row + padding)
                    nodeHeight += node.data.rows.length * 24 + 20;
                }

                minX = Math.min(minX, pos.x);
                minY = Math.min(minY, pos.y);
                maxX = Math.max(maxX, pos.x + NODE_WIDTH);
                maxY = Math.max(maxY, pos.y + nodeHeight);
            });

            // Ensure we have valid bounds
            if (minX === Infinity) {
                return { width: minWidth, height: minHeight };
            }

            const calculatedWidth = maxX - minX + padding * 2;
            const calculatedHeight = maxY - minY + padding * 2;

            const result = {
                width: Math.max(calculatedWidth, minWidth),
                height: Math.max(calculatedHeight, minHeight),
            };

            // FIX: Force MUCH larger dimensions to ensure scrollbars appear
            const finalResult = {
                width: Math.max(result.width, 3000), // Force minimum 3000px width
                height: Math.max(result.height, 2500), // Force minimum 2500px height
            };

            // Debug: Log only when dimensions are significant
            if (finalResult.width > 1500 || finalResult.height > 1000) {
                console.log('🔍 [useScrollableFlow] Calculated dimensions:', {
                    nodesCount: nodes.length,
                    calculated: result,
                    final: finalResult,
                    padding,
                    shouldCreateScrollbars: finalResult.width > 1200 || finalResult.height > 800
                });
            }

            return finalResult;
        } catch (error) {
            console.warn('🔍 [useScrollableFlow] Error calculating node bounds:', error);
            return { width: minWidth, height: minHeight };
        }
    }, [nodes.length, padding, minWidth, minHeight]); // Only recalculate when node count changes, not on every node change

    // Fit view to center content in viewport
    const handleFitView = useCallback(() => {
        const el = wrapperRef.current;
        if (!el) return;

        const centerX = Math.max(0, (spacerSize.width - el.clientWidth) / 2);
        const centerY = Math.max(0, (spacerSize.height - el.clientHeight) / 2);

        el.scrollLeft = centerX;
        el.scrollTop = centerY;
    }, [spacerSize.width, spacerSize.height]);

    // Scroll to specific position
    const scrollToPosition = useCallback((x: number, y: number) => {
        const el = wrapperRef.current;
        if (!el) return;

        el.scrollLeft = Math.max(0, Math.min(x, spacerSize.width - el.clientWidth));
        el.scrollTop = Math.max(0, Math.min(y, spacerSize.height - el.clientHeight));
    }, [spacerSize.width, spacerSize.height]);

    // Get current scroll position
    const getScrollPosition = useCallback(() => {
        const el = wrapperRef.current;
        if (!el) return { x: 0, y: 0 };

        return {
            x: el.scrollLeft,
            y: el.scrollTop
        };
    }, []);

    // Auto-center on mount or when spacer size changes
    useLayoutEffect(() => {
        // DISABILITATO: React Flow fitView interferisce con le scrollbar
        // if (autoCenter) {
        //     handleFitView();
        // }
    }, [spacerSize.width, spacerSize.height, autoCenter, handleFitView]);

    return {
        wrapperRef,
        spacerSize,
        isPanning,
        setIsPanning,
        handleFitView,
        scrollToPosition,
        getScrollPosition,
    };
};
