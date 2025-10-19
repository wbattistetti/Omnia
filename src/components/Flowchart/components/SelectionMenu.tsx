import React from 'react';

export interface SelectionMenuProps {
  selectedNodeIds: string[];
  selectionMenu: { show: boolean; x: number; y: number };
  onCreateTask: () => void;
  onCancel: () => void;
}

export const SelectionMenu: React.FC<SelectionMenuProps> = ({ selectedNodeIds, selectionMenu, onCreateTask, onCancel }) => {
  if (!selectionMenu.show || selectedNodeIds.length < 2) return null;
  return (
    <div className="absolute z-20 flex items-center gap-1" style={{ left: selectionMenu.x, top: selectionMenu.y, transform: 'translate(8px, 8px)' }}>
      <button
        className="px-2 py-1 text-xs rounded border bg-white border-slate-300 text-slate-700 shadow-sm"
        onClick={onCreateTask}
      >Crea Task</button>
      <button
        className="px-2 py-1 text-xs rounded border bg-white border-red-300 text-red-700 shadow-sm"
        onClick={onCancel}
      >Annulla</button>
    </div>
  );
};
