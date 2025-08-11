import React from 'react';
import { useDrop } from 'react-dnd';
import { DND_TYPE_VIEWER } from './ActionRowDnDWrapper';
import { normalizeActionFromViewer } from './utils/normalize';
import { Action } from './types';

interface BottomDropZoneProps {
  onDropAction: (action: Action) => void;
  color?: string;
}

const BottomDropZone: React.FC<BottomDropZoneProps> = ({ onDropAction, color = '#2563eb' }) => {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: [DND_TYPE_VIEWER],
    drop: (item: any) => {
      const normalized = normalizeActionFromViewer(item);
      onDropAction(normalized);
    },
    collect: (monitor) => ({ isOver: monitor.isOver({ shallow: true }) })
  }), [onDropAction]);

  return (
    <div
      ref={drop}
      style={{
        marginTop: 8,
        border: `1px dashed ${color}`,
        borderRadius: 10,
        padding: '10px 12px',
        color,
        textAlign: 'center',
        background: isOver ? `${color}10` : 'transparent',
        transition: 'background 0.15s, border 0.15s',
      }}
    >
      Drag here to append
    </div>
  );
};

export default BottomDropZone;
