import React from 'react';
import { GripVertical, Trash2, Edit3 } from 'lucide-react';

interface NodeRowActionsOverlayProps {
  iconPos: { top: number; left: number };
  showIcons: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onDrag: (e: React.MouseEvent) => void;
  isEditing: boolean;
  setIsEditing: (v: boolean) => void;
  labelRef: React.RefObject<HTMLSpanElement>;
}

export const NodeRowActionsOverlay: React.FC<NodeRowActionsOverlayProps> = ({
  iconPos,
  showIcons,
  canDelete,
  onEdit,
  onDelete,
  onDrag,
  isEditing,
  setIsEditing,
  labelRef
}) => {
  if (!showIcons || !iconPos) return null;
  return (
    <div
      style={{
        position: 'fixed',
        top: iconPos.top,
        left: iconPos.left,
        display: 'flex',
        gap: 4,
        zIndex: 1000,
        background: '#fff',
        borderRadius: 6,
        boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
        padding: '2px 4px',
        alignItems: 'center',
        border: '1px solid #000',
        height: labelRef.current ? `${labelRef.current.getBoundingClientRect().height}px` : '22px',
        minHeight: 0,
        marginLeft: 0
      }}
      className="flex items-center"
    >
      {/* Drag handle */}
      <span
        className="cursor-grab nodrag"
        title="Trascina la riga"
        style={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', padding: 2 }}
        onMouseDown={onDrag}
      >
        <GripVertical className="w-4 h-4 text-slate-400 hover:text-black transition-colors" />
      </span>
      {/* Matita (edit) */}
      <button 
        onClick={onEdit}
        className="text-slate-400 hover:text-black transition-colors"
        title="Edit row"
        style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer' }}
      >
        <Edit3 className="w-4 h-4" />
      </button>
      {/* Cestino (delete) */}
      {canDelete && (
        <button 
          onClick={onDelete}
          className="text-red-400 hover:text-red-600 transition-colors"
          title="Delete row"
          style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer' }}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}; 