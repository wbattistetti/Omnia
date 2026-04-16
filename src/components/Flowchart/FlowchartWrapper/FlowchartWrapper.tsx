/**
 * Contenitore per React Flow: riempie il genitore (width/height 100%, min-height 0)
 * senza imporre larghezze minime derivate dai bounds dei nodi.
 */
import React from 'react';
import './FlowchartWrapper.css';

export interface FlowchartWrapperProps {
    /** Mantenuti per compatibilità API; non usati per il sizing del contenitore. */
    nodes: import('reactflow').Node[];
    edges: import('reactflow').Edge[];
    padding?: number;
    minWidth?: number;
    minHeight?: number;
    style?: React.CSSProperties;
    className?: string;
    children: React.ReactNode;
}

export const FlowchartWrapper: React.FC<FlowchartWrapperProps> = ({
    nodes: _nodes,
    edges: _edges,
    padding: _padding,
    minWidth: _minWidth,
    minHeight: _minHeight,
    style = {},
    className = '',
    children,
}) => {
    return (
        <div
            className={className || undefined}
            style={{
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                height: '100%',
                minHeight: 0,
                minWidth: 0,
                overflow: 'hidden',
                position: 'relative',
                flex: '1 1 0%',
                ...style,
            }}
        >
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    width: '100%',
                    height: '100%',
                    minHeight: 0,
                    minWidth: 0,
                    flex: '1 1 0%',
                    position: 'relative',
                }}
            >
                {children}
            </div>
        </div>
    );
};
