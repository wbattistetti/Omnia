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
  // Legacy prop for backward compatibility
  onDropAction?: (task: TaskReference) => void; // @deprecated Use onDropTask instead
}

const CanvasDropWrapper: React.FC<CanvasDropWrapperProps> = ({ onDropTask, onDropAction, children, isEmpty = false }) => {
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

  return (
    <div ref={drop} style={{
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      flex: 'none',
      minHeight: isEmpty ? '120px' : 'auto',
      width: '100%'
    }}>
      {children}
    </div>
  );
};

export default CanvasDropWrapper;
