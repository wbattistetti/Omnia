// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React, { useCallback, useEffect } from 'react';
import { ReactFlow, ReactFlowProps, Node, Edge } from 'reactflow';
import { useScrollableFlow, UseScrollableFlowOptions } from '../../hooks/useScrollableFlow';
import './ScrollableFlow.css';

/**
 * Props for the ScrollableFlow component
 */
export interface ScrollableFlowProps extends Omit<ReactFlowProps, 'style' | 'className'> {
    /** Array of React Flow nodes */
    nodes: Node[];
    /** Array of React Flow edges */
    edges: Edge[];
    /** Configuration options for the scrollable behavior */
    options?: UseScrollableFlowOptions;
    /** CSS class name for the React Flow container */
    className?: string;
    /** CSS class name for the wrapper container */
    wrapperClassName?: string;
    /** Whether to show the default React Flow controls */
    showControls?: boolean;
    /** Whether to show the minimap */
    showMinimap?: boolean;
    /** Custom controls component */
    controls?: React.ReactNode;
    /** Callback when panning state changes */
    onPanningChange?: (isPanning: boolean) => void;
    /** Callback when view is fitted */
    onFitView?: () => void;
}

/**
 * ScrollableFlow component that provides scrollable React Flow with pan support
 *
 * Features:
 * - Scrollable wrapper with custom scrollbars
 * - Pan support for dragging the view
 * - Automatic bounds calculation
 * - Configurable padding and minimum dimensions
 * - Enterprise-ready with proper TypeScript support
 *
 * @param props - Component props
 * @returns ScrollableFlow component
 */
export const ScrollableFlow: React.FC<ScrollableFlowProps> = ({
    nodes,
    edges,
    options = {},
    className = '',
    wrapperClassName = '',
    showControls = true,
    showMinimap = false,
    controls,
    onPanningChange,
    onFitView,
    ...reactFlowProps
}) => {
    const {
        wrapperRef,
        spacerSize,
        isPanning,
        setIsPanning,
        handleFitView,
    } = useScrollableFlow(nodes, options);

    // Handle panning state changes
    const handlePanningChange = useCallback((panning: boolean) => {
        setIsPanning(panning);
        onPanningChange?.(panning);
    }, [setIsPanning, onPanningChange]);

    // Handle fit view with callback
    const handleFitViewWithCallback = useCallback(() => {
        handleFitView();
        onFitView?.();
    }, [handleFitView, onFitView]);

    // Handle pane mouse events
    const handlePaneMouseEnter = useCallback(() => {
        handlePanningChange(true);
    }, [handlePanningChange]);

    const handlePaneMouseLeave = useCallback(() => {
        handlePanningChange(false);
    }, [handlePanningChange]);

    // Wheel events are now handled natively by the wrapper - no custom handler needed

    // Default React Flow props for scrollable behavior
    const defaultReactFlowProps: Partial<ReactFlowProps> = {
        panOnScroll: false,
        zoomOnScroll: false,
        zoomOnPinch: false,
        preventScrolling: false,  // ⬅️ CAMBIA: lascia passare la wheel al wrapper
        panOnDrag: true,
        minZoom: 1,               // ⬅️ CAMBIA: solo scrollbar, niente zoom
        maxZoom: 1,               // ⬅️ CAMBIA: solo scrollbar, niente zoom
        fitView: false,           // ⬅️ CRITICAL: Disabilita fitView automatico
        fitViewOptions: { padding: 0.3, duration: 400 },
        onPaneMouseEnter: handlePaneMouseEnter,
        onPaneMouseLeave: handlePaneMouseLeave,
    };

    // Merge default props with user props
    const mergedProps = {
        ...defaultReactFlowProps,
        ...reactFlowProps,
        nodes,
        edges,
        className: `scrollable-flow ${className}`.trim(),
    };

    // ScrollableFlow is properly configured - no debug logs needed

    return (
        <div
            ref={wrapperRef}
            className={`scrollable-flow-wrapper ${wrapperClassName}`.trim()}
            style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                overflow: 'auto',
                cursor: isPanning ? 'grabbing' : 'grab',
                // CRITICAL: Force wrapper to be smaller than content
                maxWidth: '100%',
                maxHeight: '100%',
                minWidth: 0,
                minHeight: 0,
            }}
        >
            <div
                className="scrollable-flow-spacer"
                style={{
                    position: 'relative',
                    width: spacerSize.width,
                    height: spacerSize.height,
                }}
            >
                <div
                    className="scrollable-flow-container"
                    style={{
                        position: 'absolute',
                        inset: 0,
                        // DEBUG: Make sure React Flow doesn't cover scrollbars
                        zIndex: 1,
                        pointerEvents: 'none'  // Let scrollbars be clickable
                    }}
                >
                    <ReactFlow
                        {...mergedProps}
                        style={{
                            // DEBUG: Make sure React Flow doesn't interfere with scrolling
                            overflow: 'visible',
                            position: 'relative',
                            zIndex: 1
                        }}
                    >
                        {showControls && (
                            <div className="scrollable-flow-controls">
                                {controls || (
                                    <div className="default-controls">
                                        <button
                                            onClick={handleFitViewWithCallback}
                                            className="fit-view-button"
                                            title="Fit view to content"
                                        >
                                            Fit View
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                        {showMinimap && (
                            <div className="scrollable-flow-minimap">
                                {/* Minimap component would go here */}
                            </div>
                        )}
                    </ReactFlow>
                </div>
            </div>
        </div>
    );
};
