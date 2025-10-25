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
  // DISABILITATO: ora usiamo toolbar fullWidth
  return null;
};

