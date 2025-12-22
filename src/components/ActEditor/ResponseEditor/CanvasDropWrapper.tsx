import React from 'react';
import { useDrop } from 'react-dnd';
import { DND_TYPE_VIEWER } from './ActionRowDnDWrapper';
import { normalizeTaskFromViewer } from './utils/normalize';
import { TaskReference } from './types';

interface CanvasDropWrapperProps {
  onDropAction: (task: TaskReference) => void;
  color?: string;
  children: React.ReactNode;
}

const CanvasDropWrapper: React.FC<CanvasDropWrapperProps> = ({ onDropAction, color = '#2563eb', children }) => {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: [DND_TYPE_VIEWER],
    drop: (item: any) => {
      const normalized = normalizeTaskFromViewer(item);
      onDropAction(normalized);
    },
    collect: (monitor) => ({ isOver: monitor.isOver({ shallow: true }) })
  }), [onDropAction]);

  return (
    <div style={{ position: 'relative' }}>
      <div>{children}</div>
      <div
        ref={drop}
        style={{
          marginTop: 12,
          height: 140,
          border: isOver ? `2px dashed ${color}` : '2px dashed transparent',
          borderRadius: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color,
          background: isOver ? `${color}12` : 'transparent',
          transition: 'background 0.15s, border 0.15s',
        }}
      >
        {isOver ? 'Drop to append' : ''}
      </div>
    </div>
  );
};

export default CanvasDropWrapper;
