import React from 'react';
import { createPortal } from 'react-dom';

interface NodeBufferAreaProps {
  bufferRect: { top: number; left: number; width: number; height: number } | null;
  isHoveredNode: boolean;
  isEditingNode: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

/**
 * Extended hover buffer area for CustomNode
 * Prevents toolbar from disappearing when mouse moves slightly outside node bounds
 */
export const NodeBufferArea: React.FC<NodeBufferAreaProps> = ({
  bufferRect,
  isHoveredNode,
  isEditingNode,
  onMouseEnter,
  onMouseLeave,
}) => {
  if (!bufferRect || !isHoveredNode || isEditingNode) {
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
        zIndex: 499,
        pointerEvents: 'auto',
        background: 'transparent',
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    />,
    document.body
  );
};

