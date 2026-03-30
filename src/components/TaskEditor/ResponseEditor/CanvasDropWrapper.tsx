import React from 'react';
import { useDrop } from 'react-dnd';
import { DND_TYPE_VIEWER } from './TaskRowDnDWrapper';
import { createTask } from './utils/normalize';
import { TaskReference } from './types';

interface CanvasDropWrapperProps {
  onDropTask: (task: TaskReference) => void;
  color?: string;
  children: React.ReactNode;
  isEmpty?: boolean; // ✅ NEW: Indicates if escalation is empty (for flex fix)
  /** Grow with parent so the whole area accepts drops (single-escalation Behaviour). */
  fillAvailable?: boolean;
  // Legacy prop for backward compatibility
  onDropAction?: (task: TaskReference) => void; // @deprecated Use onDropTask instead
}

const CanvasDropWrapper: React.FC<CanvasDropWrapperProps> = ({
  onDropTask,
  onDropAction,
  children,
  isEmpty = false,
  fillAvailable = false,
}) => {
  const handleDrop = onDropTask ?? onDropAction;

  const [, drop] = useDrop(() => ({
    accept: [DND_TYPE_VIEWER],
    drop: (item: any, monitor) => {
      // ✅ CRITICAL: Check if a child (TaskRowDnDWrapper or PanelEmptyDropZone) handled the drop
      if (monitor.didDrop()) {
        return undefined; // Child already handled it
      }
      const normalized = createTask(item);
      handleDrop?.(normalized);
      return { handled: true };
    },
    collect: () => ({}) // No visual feedback - completely invisible
  }), [handleDrop]);

  /** When empty in a fixed-height card (e.g. tree view), grow so the whole slot is a drop target. */
  const fillEmptySlot = isEmpty && !fillAvailable;

  return (
    <div
      ref={drop}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        flex: fillAvailable ? 1 : fillEmptySlot ? 1 : 'none',
        minHeight: fillAvailable ? 0 : fillEmptySlot ? 0 : isEmpty ? '72px' : 'auto',
        width: '100%',
        alignSelf: fillAvailable || fillEmptySlot ? 'stretch' : undefined,
      }}
    >
      {children}
    </div>
  );
};

export default CanvasDropWrapper;
