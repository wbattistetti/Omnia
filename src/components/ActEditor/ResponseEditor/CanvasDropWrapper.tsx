import React from 'react';
import { useDrop } from 'react-dnd';
import { DND_TYPE_VIEWER } from './TaskRowDnDWrapper';
import { normalizeTaskFromViewer } from './utils/normalize';
import { TaskReference } from './types';

interface CanvasDropWrapperProps {
  onDropTask: (task: TaskReference) => void;
  color?: string;
  children: React.ReactNode;
  // Legacy prop for backward compatibility
  onDropAction?: (task: TaskReference) => void; // @deprecated Use onDropTask instead
}

const CanvasDropWrapper: React.FC<CanvasDropWrapperProps> = ({ onDropTask, onDropAction, children }) => {
  const handleDrop = onDropTask ?? onDropAction;
  const debugDrop = () => {
    try { return localStorage.getItem('debug.drop') === '1'; } catch { return false; }
  };

  const [, drop] = useDrop(() => ({
    accept: [DND_TYPE_VIEWER],
    drop: (item: any, monitor) => {
      // Only handle drop if it wasn't handled by a child (TaskRowDnDWrapper)
      const didDrop = monitor.didDrop();
      if (debugDrop()) {
        console.log('[DROP_DEBUG][CanvasDropWrapper] Drop received', { didDrop, itemType: item?.type });
      }
      if (didDrop) {
        // A child handled the drop, don't process it here
        if (debugDrop()) console.log('[DROP_DEBUG][CanvasDropWrapper] ⏭️ Skipping - child handled drop');
        return;
      }
      if (debugDrop()) {
        console.log('[DROP_DEBUG][CanvasDropWrapper] ✅ Processing drop (no child handled it)');
      }
      const normalized = normalizeTaskFromViewer(item);
      handleDrop?.(normalized);
    },
    collect: () => ({}) // No visual feedback - completely invisible
  }), [handleDrop]);

  return (
    <div ref={drop} style={{ position: 'relative' }}>
      {children}
    </div>
  );
};

export default CanvasDropWrapper;
