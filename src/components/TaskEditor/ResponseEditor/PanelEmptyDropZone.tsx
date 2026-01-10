import React, { useState } from 'react';
import { useDrop } from 'react-dnd';
import { DND_TYPE_VIEWER } from './TaskRowDnDWrapper';
import { createTask } from './utils/normalize';
import { TaskReference } from './types';

interface PanelEmptyDropZoneProps {
  onDropTask: (task: TaskReference) => void;
  color?: string;
  // Legacy prop for backward compatibility
  onDropAction?: (task: TaskReference) => void; // @deprecated Use onDropTask instead
}

const PanelEmptyDropZone: React.FC<PanelEmptyDropZoneProps> = ({ onDropTask, onDropAction, color = '#3b82f6' }) => {
  const handleDrop = onDropTask ?? onDropAction;
  const [isOver, setIsOver] = useState(false);

  const [{ isOver: isDropping }, drop] = useDrop(() => ({
    accept: [DND_TYPE_VIEWER],
    drop: (item: any, monitor) => {
      const normalized = createTask(item);
      handleDrop?.(normalized);
      return { handled: true };
    },
    collect: (monitor) => ({
      isOver: monitor.isOver()
    })
  }), [handleDrop]);

  // Aggiorna stato locale per feedback visivo
  React.useEffect(() => {
    setIsOver(isDropping);
  }, [isDropping]);

  return (
    <div
      ref={drop}
      style={{
        minHeight: '80px',
        width: '100%',
        border: isOver ? `2px dashed ${color}` : `1px dashed ${color}40`,
        background: isOver ? `${color}10` : 'transparent',
        padding: '1.5rem',
        borderRadius: '8px',
        transition: 'all 0.2s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: isOver ? color : `${color}60`,
        fontSize: '0.875rem',
        cursor: 'pointer'
      }}
    >
      {isOver ? 'Rilascia qui per aggiungere' : 'Trascina un task qui'}
    </div>
  );
};

export default PanelEmptyDropZone;
