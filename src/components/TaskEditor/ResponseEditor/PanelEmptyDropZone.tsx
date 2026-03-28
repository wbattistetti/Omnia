import React, { useState } from 'react';
import { useDrop } from 'react-dnd';
import { DND_TYPE_VIEWER } from './TaskRowDnDWrapper';
import { createTask } from './utils/normalize';
import { TaskReference } from './types';

interface PanelEmptyDropZoneProps {
  onDropTask: (task: TaskReference) => void;
  color?: string;
  /** Shown when not dragging (default avoids implying the whole editor is only a drop target). */
  idleLabel?: string;
  /** Shown while a draggable is over the zone. */
  overLabel?: string;
  /** Tighter layout for nested empty states (e.g. escalation row). */
  compact?: boolean;
  // Legacy prop for backward compatibility
  onDropAction?: (task: TaskReference) => void; // @deprecated Use onDropTask instead
}

const PanelEmptyDropZone: React.FC<PanelEmptyDropZoneProps> = ({
  onDropTask,
  onDropAction,
  color = '#3b82f6',
  idleLabel,
  overLabel,
  compact = false,
}) => {
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

  const idle =
    idleLabel ??
    'Nessun task in questa lista. Apri la scheda Tasks nella barra in alto e trascina un task qui, oppure usa il catalogo.';
  const over = overLabel ?? 'Rilascia per aggiungere';

  return (
    <div
      ref={drop}
      style={{
        minHeight: compact ? '56px' : '72px',
        width: '100%',
        maxWidth: compact ? '100%' : 560,
        margin: '0 auto',
        border: isOver ? `2px dashed ${color}` : `1px dashed ${color}40`,
        background: isOver ? `${color}10` : 'transparent',
        padding: compact ? '0.75rem 1rem' : '1rem 1.25rem',
        borderRadius: '8px',
        transition: 'all 0.2s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: isOver ? color : `${color}80`,
        fontSize: compact ? '0.8125rem' : '0.875rem',
        lineHeight: 1.45,
        textAlign: 'center',
        cursor: 'pointer',
      }}
    >
      {isOver ? over : idle}
    </div>
  );
};

export default PanelEmptyDropZone;
