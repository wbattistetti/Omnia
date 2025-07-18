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
      className="relative flex items-center justify-center"
      style={{ height: 6, minHeight: 0, margin: 0, padding: 0, cursor: 'pointer' }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onDoubleClick={visible ? onInsert : undefined}
    >
      {visible && (
        <button
          className="absolute left-1/2 -translate-x-1/2 -top-1 p-0 hover:bg-yellow-100 transition"
          style={{ zIndex: 10, width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', boxShadow: 'none' }}
          title="Inserisci qui"
          tabIndex={-1}
          onClick={onInsert}
        >
          <PlusCircle className="w-2.5 h-2.5 text-yellow-500" />
        </button>
      )}
    </div>
  );
}; 