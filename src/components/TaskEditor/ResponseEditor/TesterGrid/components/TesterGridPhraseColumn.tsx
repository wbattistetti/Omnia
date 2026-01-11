import React from 'react';
import { renderPhraseWithSpans } from '../helpers/renderPhraseWithSpans';

interface TesterGridPhraseColumnProps {
  phrase: string;
  spans?: Array<{ start: number; end: number }>;
  width: number;
  isResizing: boolean;
  onResizeStart: (e: React.MouseEvent) => void;
  leading?: React.ReactNode;
}

/**
 * Column component for displaying test phrases with resize handle
 */
export default function TesterGridPhraseColumn({
  phrase,
  spans,
  width,
  isResizing,
  onResizeStart,
  leading,
}: TesterGridPhraseColumnProps) {
  return (
    <td
      style={{
        padding: 8,
        wordBreak: 'break-word',
        width: `${width}px`,
        position: 'relative'
      }}
    >
      {leading}
      {renderPhraseWithSpans(phrase, spans)}
      {/* Splitter - linea verticale draggable */}
      <div
        onMouseDown={onResizeStart}
        style={{
          position: 'absolute',
          right: '-3px',
          top: 0,
          bottom: 0,
          width: '6px',
          cursor: 'col-resize',
          backgroundColor: isResizing ? '#3b82f6' : 'rgba(107, 114, 128, 0.4)',
          zIndex: 20,
          transition: isResizing ? 'none' : 'background-color 0.2s',
          borderLeft: '1px solid rgba(107, 114, 128, 0.6)',
          borderRight: '1px solid rgba(107, 114, 128, 0.6)',
          pointerEvents: 'auto'
        }}
        onMouseEnter={(e) => {
          if (!isResizing) {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(59, 130, 246, 0.6)';
            (e.currentTarget as HTMLElement).style.borderLeftColor = '#3b82f6';
            (e.currentTarget as HTMLElement).style.borderRightColor = '#3b82f6';
          }
        }}
        onMouseLeave={(e) => {
          if (!isResizing) {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(107, 114, 128, 0.4)';
            (e.currentTarget as HTMLElement).style.borderLeftColor = 'rgba(107, 114, 128, 0.6)';
            (e.currentTarget as HTMLElement).style.borderRightColor = 'rgba(107, 114, 128, 0.6)';
          }
        }}
      />
    </td>
  );
}
