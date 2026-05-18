/**
 * Flow canvas shell: clips React Flow to the dock area (pan/zoom via RF, no native scroll).
 */
import React, { forwardRef } from 'react';
import './FlowchartWrapper.css';

export interface FlowchartWrapperProps {
  /** Overlay in shell coordinates (same box as the visible canvas). */
  overlay?: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  children: React.ReactNode;
}

export const FlowchartWrapper = forwardRef<HTMLDivElement, FlowchartWrapperProps>(
  function FlowchartWrapper({ overlay, style = {}, className = '', children }, ref) {
    return (
      <div
        ref={ref}
        className={`flow-canvas-shell ${className}`.trim()}
        style={{
          position: 'relative',
          flex: '1 1 0%',
          minHeight: 0,
          minWidth: 0,
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          ...style,
        }}
      >
        {children}
        {overlay}
      </div>
    );
  }
);
