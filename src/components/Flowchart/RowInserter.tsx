import React, { useEffect } from 'react';
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
      style={{ height: 6, minHeight: 0, width: '100%', margin: 0, padding: 0, cursor: visible ? 'copy' : 'default' }}
      onMouseEnter={() => onMouseEnter && onMouseEnter()}
      onMouseLeave={() => onMouseLeave && onMouseLeave()}
      onClick={visible ? onInsert : undefined}
      data-idx={typeof index === 'number' ? index : undefined}
    >
      {/* Unica linea tratteggiata nera quando visibile per indicare inserimento */}
      {visible && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: 6,
            right: 6,
            height: 0,
            borderTop: '2px dashed rgba(0,0,0,0.9)',
            transform: 'translateY(-50%)',
            opacity: 1,
            pointerEvents: 'none',
            background: 'transparent'
          }}
        />
      )}
    </div>
  );
}; 