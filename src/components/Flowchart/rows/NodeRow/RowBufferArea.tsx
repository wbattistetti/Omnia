import React from 'react';
import { createPortal } from 'react-dom';

interface RowBufferAreaProps {
  bufferRect: { top: number; left: number; width: number; height: number } | null;
  showIcons: boolean;
  showCreatePicker: boolean;
  isEditing: boolean;
  onMouseEnter: () => void;
  onMouseLeave: (e: React.MouseEvent) => void;
}

/**
 * Extended hover buffer area for row toolbar tolerance
 * Creates a transparent overlay that captures hover events to keep toolbar visible
 * when mouse moves slightly outside the row boundaries
 */
export const RowBufferArea: React.FC<RowBufferAreaProps> = ({
  bufferRect,
  showIcons,
  showCreatePicker,
  isEditing,
  onMouseEnter,
  onMouseLeave
}) => {
  if (!bufferRect || !showIcons || showCreatePicker || isEditing) {
    return null;
  }

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: bufferRect.top,
        left: bufferRect.left,
        width: bufferRect.width,
        height: bufferRect.height,
        zIndex: 499, // Below toolbar (1000) but above normal content
        pointerEvents: 'auto', // Capture hover to keep toolbar visible
        background: 'transparent',
        // Debug: show area (remove in production)
        // border: '1px dashed rgba(0, 255, 0, 0.3)',
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    />
    , document.body
  );
};

