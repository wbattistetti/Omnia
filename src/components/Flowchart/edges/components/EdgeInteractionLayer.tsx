import React from 'react';

export interface EdgeInteractionLayerProps {
  onCtrlClick?: (e: React.MouseEvent) => void;
  onShiftClick?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  children: React.ReactNode;
}

/**
 * Edge interaction layer component
 * Handles global edge events (click, ctrl+click, shift+click, context menu, hover)
 */
export const EdgeInteractionLayer: React.FC<EdgeInteractionLayerProps> = ({
  onCtrlClick,
  onShiftClick,
  onContextMenu,
  onMouseEnter,
  onMouseLeave,
  children,
}) => {
  const handleClick = (e: React.MouseEvent) => {
    // Only handle Ctrl+Click and Shift+Click
    // Normal clicks should be ignored (let React Flow handle selection)
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      e.stopPropagation();
      onCtrlClick?.(e);
    } else if (e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      onShiftClick?.(e);
    }
    // Normal click: do nothing, don't prevent default
  };

  return (
    <g
      onClick={handleClick}
      onContextMenu={onContextMenu}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ pointerEvents: 'all' }}
    >
      {children}
    </g>
  );
};
