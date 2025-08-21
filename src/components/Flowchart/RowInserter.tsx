import React from 'react';
import { PlusCircle } from 'lucide-react';

interface RowInserterProps {
  visible: boolean;
  onInsert: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  index?: number; // for hit-test recovery
}

export const RowInserter: React.FC<RowInserterProps> = ({ visible, onInsert, onMouseEnter, onMouseLeave, index }) => {
  return (
    <div
      className="row-inserter relative flex items-center justify-center"
      style={{ height: 6, minHeight: 0, width: '100%', margin: 0, padding: 0, cursor: 'copy' }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={visible ? onInsert : undefined}
      data-idx={typeof index === 'number' ? index : undefined}
    >
      {/* Rettangolo tratteggiato sottile quando visibile per indicare inserimento */}
      {visible && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 8,
            right: 8,
            height: 4,
            borderTop: '1px dashed #64748b',
            borderBottom: '1px dashed #64748b',
            opacity: 0.9,
            pointerEvents: 'none',
            background: 'rgba(100,116,139,0.08)'
          }}
        />
      )}
    </div>
  );
}; 