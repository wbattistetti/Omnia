import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { Node, Edge, getNodesBounds } from 'reactflow';
import './FlowchartWrapper.css';

export interface FlowchartWrapperProps {
    nodes: Node[];
    edges: Edge[];
    padding?: number;
    minWidth?: number;
    minHeight?: number;
    style?: React.CSSProperties;
    className?: string;
    children: React.ReactNode;
}

export const FlowchartWrapper: React.FC<FlowchartWrapperProps> = ({
    nodes,
    edges,
    padding = 400,
    minWidth = 1200,
    minHeight = 800,
    style = {},
    className = '',
    children
}) => {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const [scrollPosition, setScrollPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    // Calcola dimensioni dinamiche del flusso
    const flowDimensions = useMemo(() => {
        if (!nodes.length) {
            return { width: minWidth, height: minHeight };
        }

        try {
            const bounds = getNodesBounds(nodes);

            return {
                width: Math.max(bounds.width + padding * 2, minWidth),
                height: Math.max(bounds.height + padding * 2, minHeight)
            };
        } catch (error) {
            console.warn('Error calculating flow dimensions:', error);
            return { width: minWidth, height: minHeight };
        }
    }, [nodes.length, nodes.map(n => `${n.position.x},${n.position.y}`).join('|'), padding, minWidth, minHeight]);

    // Calcola dimensioni del wrapper
    const [wrapperDimensions, setWrapperDimensions] = useState({ width: 0, height: 0 });

    useEffect(() => {
        const updateDimensions = () => {
            if (wrapperRef.current) {
                const rect = wrapperRef.current.getBoundingClientRect();
                setWrapperDimensions({ width: rect.width, height: rect.height });
            }
        };

        updateDimensions();
        window.addEventListener('resize', updateDimensions);
        return () => window.removeEventListener('resize', updateDimensions);
    }, []);

    // Calcola se servono scrollbar
    const needsHorizontalScroll = flowDimensions.width > wrapperDimensions.width;
    const needsVerticalScroll = flowDimensions.height > wrapperDimensions.height;

    // Calcola posizione delle scrollbar
    const horizontalScrollbarHeight = needsHorizontalScroll ? 16 : 0;
    const verticalScrollbarWidth = needsVerticalScroll ? 16 : 0;

    // Calcola dimensioni del viewport (escludendo scrollbar)
    const viewportWidth = wrapperDimensions.width - verticalScrollbarWidth;
    const viewportHeight = wrapperDimensions.height - horizontalScrollbarHeight;

    // Calcola percentuali di scroll
    const maxScrollX = Math.max(0, flowDimensions.width - viewportWidth);
    const maxScrollY = Math.max(0, flowDimensions.height - viewportHeight);

    const scrollPercentX = maxScrollX > 0 ? (scrollPosition.x / maxScrollX) * 100 : 0;
    const scrollPercentY = maxScrollY > 0 ? (scrollPosition.y / maxScrollY) * 100 : 0;

    // Calcola dimensioni delle thumb delle scrollbar
    const thumbWidthX = Math.max(20, (viewportWidth / flowDimensions.width) * viewportWidth);
    const thumbHeightY = Math.max(20, (viewportHeight / flowDimensions.height) * viewportHeight);

    // Funzione per aggiornare la posizione del pannello
    const updatePanelPosition = useCallback((x: number, y: number) => {
        if (panelRef.current) {
            panelRef.current.style.transform = `translate(-${x}px, -${y}px)`;
        }
    }, []);

    // Gestione scroll con mouse wheel
    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();

        const deltaX = e.deltaX;
        const deltaY = e.deltaY;

        setScrollPosition(prev => {
            const newX = Math.max(0, Math.min(maxScrollX, prev.x + deltaX));
            const newY = Math.max(0, Math.min(maxScrollY, prev.y + deltaY));

            updatePanelPosition(newX, newY);
            return { x: newX, y: newY };
        });
    }, [maxScrollX, maxScrollY, updatePanelPosition]);

    // Gestione drag delle scrollbar
    const handleScrollbarMouseDown = useCallback((type: 'horizontal' | 'vertical', e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
        setDragStart({ x: e.clientX, y: e.clientY });
    }, []);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging) return;

        const deltaX = e.clientX - dragStart.x;
        const deltaY = e.clientY - dragStart.y;

        setScrollPosition(prev => {
            const newX = Math.max(0, Math.min(maxScrollX, prev.x + deltaX));
            const newY = Math.max(0, Math.min(maxScrollY, prev.y + deltaY));

            updatePanelPosition(newX, newY);
            return { x: newX, y: newY };
        });

        setDragStart({ x: e.clientX, y: e.clientY });
    }, [isDragging, dragStart, maxScrollX, maxScrollY, updatePanelPosition]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, handleMouseMove, handleMouseUp]);

    // Inizializza posizione del pannello
    useEffect(() => {
        updatePanelPosition(scrollPosition.x, scrollPosition.y);
    }, [scrollPosition, updatePanelPosition]);

    return (
        <div
            ref={wrapperRef}
            className={`flowchart-wrapper ${className}`.trim()}
            style={{
                width: '100%',
                height: '100%',
                overflow: 'hidden',
                position: 'relative',
                ...style
            }}
            onWheel={handleWheel}
        >
            {/* Pannello principale */}
            <div
                ref={panelRef}
                className="flowchart-panel"
                style={{
                    width: flowDimensions.width,
                    height: flowDimensions.height,
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                }}
            >
                {children}
            </div>

            {/* Scrollbar orizzontale */}
            {needsHorizontalScroll && (
                <div
                    className="scrollbar-horizontal"
                    style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        width: viewportWidth,
                        height: horizontalScrollbarHeight,
                        backgroundColor: '#2d3748',
                        cursor: 'pointer'
                    }}
                >
                    <div
                        className="scrollbar-thumb-horizontal"
                        style={{
                            position: 'absolute',
                            left: `${scrollPercentX}%`,
                            width: `${thumbWidthX}px`,
                            height: '100%',
                            backgroundColor: '#4a5568',
                            cursor: 'grab',
                            borderRadius: '4px'
                        }}
                        onMouseDown={(e) => handleScrollbarMouseDown('horizontal', e)}
                    />
                </div>
            )}

            {/* Scrollbar verticale */}
            {needsVerticalScroll && (
                <div
                    className="scrollbar-vertical"
                    style={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        width: verticalScrollbarWidth,
                        height: viewportHeight,
                        backgroundColor: '#2d3748',
                        cursor: 'pointer'
                    }}
                >
                    <div
                        className="scrollbar-thumb-vertical"
                        style={{
                            position: 'absolute',
                            top: `${scrollPercentY}%`,
                            width: '100%',
                            height: `${thumbHeightY}px`,
                            backgroundColor: '#4a5568',
                            cursor: 'grab',
                            borderRadius: '4px'
                        }}
                        onMouseDown={(e) => handleScrollbarMouseDown('vertical', e)}
                    />
                </div>
            )}
        </div>
    );
};