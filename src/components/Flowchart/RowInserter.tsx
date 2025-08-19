import React from 'react';
import { PlusCircle } from 'lucide-react';

interface RowInserterProps {
  visible: boolean;
  onInsert: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export const RowInserter: React.FC<RowInserterProps> = ({ visible, onInsert, onMouseEnter, onMouseLeave }) => {
  return (
    <div
      className="row-inserter relative flex items-center justify-center"
      style={{ height: 4, minHeight: 0, width: '100%', margin: 0, padding: 0, cursor: 'copy' }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onDoubleClick={visible ? onInsert : undefined}
    >
      {/* Nessun pannello visivo: il testo viene mostrato come tooltip del cursore in FlowEditor */}
    </div>
  );
}; 