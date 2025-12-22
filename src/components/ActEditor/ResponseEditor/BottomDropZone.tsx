import React from 'react';
import { useDrop } from 'react-dnd';
import { DND_TYPE_VIEWER } from './ActionRowDnDWrapper';
import { normalizeTaskFromViewer } from './utils/normalize';
import { TaskReference } from './types';

interface BottomDropZoneProps {
  onDropTask: (task: TaskReference) => void;
  color?: string;
  // Legacy prop for backward compatibility
  onDropAction?: (task: TaskReference) => void; // @deprecated Use onDropTask instead
}

const BottomDropZone: React.FC<BottomDropZoneProps> = ({ onDropTask, onDropAction }) => {
  const handleDrop = onDropTask ?? onDropAction;
  const [, drop] = useDrop(() => ({
    accept: [DND_TYPE_VIEWER],
    drop: (item: any) => {
      const normalized = normalizeTaskFromViewer(item);
      handleDrop?.(normalized);
    },
    collect: () => ({})
  }), [handleDrop]);

  return (
    <div
      ref={drop}
      style={{
        marginTop: 8,
        border: 'none',
        background: 'transparent',
        padding: 0,
        minHeight: 0
      }}
    />
  );
};

export default BottomDropZone;
