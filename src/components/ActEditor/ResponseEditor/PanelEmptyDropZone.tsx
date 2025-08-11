import React from 'react';
import { useDrop } from 'react-dnd';
import { DND_TYPE_VIEWER } from './ActionRowDnDWrapper';
import { normalizeActionFromViewer } from './utils/normalize';
import { Action } from './types';

interface PanelEmptyDropZoneProps {
  onDropAction: (action: Action) => void;
  color?: string;
}

const PanelEmptyDropZone: React.FC<PanelEmptyDropZoneProps> = ({ onDropAction, color = '#7c3aed' }) => {
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
        minHeight: 120,
        border: `2px dashed ${isOver ? color : 'transparent'}`,
        borderRadius: 10,
        background: isOver ? `${color}10` : 'transparent',
        color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      {isOver ? 'Drop to add first action' : ''}
    </div>
  );
};

export default PanelEmptyDropZone;
