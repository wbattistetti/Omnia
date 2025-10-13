import React from 'react';
import { GripVertical, Trash2, Edit3, Settings, Wrench } from 'lucide-react';

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
  onHoverChange?: (v: boolean) => void;
  iconSize?: number;
  hasDDT?: boolean;
  gearColor?: string;
  isCondition?: boolean;
  onWrenchClick?: () => void;
  onOpenDDT?: () => void;
  // NEW: act type icon and handler to open inline picker
  ActIcon?: React.ComponentType<any> | null;
  actColor?: string;
  onTypeChangeRequest?: () => void;
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
  labelRef,
  onHoverChange,
  iconSize,
  hasDDT,
  gearColor,
  isCondition,
  onWrenchClick,
  onOpenDDT,
  ActIcon,
  actColor,
  onTypeChangeRequest
}) => {
  if (!showIcons || !iconPos) return null;
  const size = typeof iconSize === 'number' ? iconSize : (labelRef.current ? Math.max(12, Math.min(20, Math.round(labelRef.current.getBoundingClientRect().height * 0.7))) : 14);
  return (
    <div
      style={{
        position: 'fixed',
        top: iconPos.top + 3,
        left: iconPos.left,
        display: 'flex',
        gap: 4,
        zIndex: 1000,
        background: 'transparent',
        borderRadius: 0,
        boxShadow: 'none',
        padding: 0,
        alignItems: 'center',
        border: 'none',
        height: labelRef.current ? `${labelRef.current.getBoundingClientRect().height}px` : `${size + 8}px`,
        minHeight: 0,
        marginLeft: 0,
        pointerEvents: 'auto'
      }}
      className="flex items-center"
      onMouseEnter={() => onHoverChange && onHoverChange(true)}
      onMouseLeave={() => onHoverChange && onHoverChange(false)}
    >
      {/* Current ActType icon → opens inline type picker below */}
      {ActIcon && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            try {
              console.log('[TypePicker][overlayIcon][click]', {
                iconPos,
                labelRect: labelRef.current?.getBoundingClientRect()
              });
            } catch {}
            // Anchor to the icon itself (client coordinates for fixed positioning)
            const anchor = (e.currentTarget as HTMLElement).getBoundingClientRect();
            onTypeChangeRequest && onTypeChangeRequest(anchor);
          }}
          title="Change act type"
          style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
        >
          <ActIcon style={{ width: size, height: size, color: actColor || '#64748b' }} />
        </button>
      )}
      {/* Drag handle */}
      <span
        className="cursor-grab nodrag"
        title="Trascina la riga"
        style={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', padding: 2, userSelect: 'none' }}
        draggable={false}
        onDragStart={(e) => { e.preventDefault(); }}
        onPointerDown={(e) => { try { console.log('[RowDrag][grip:down]'); } catch {} onDrag(e as any); }}
        onMouseDown={(e) => { try { console.log('[RowDrag][grip:mouseDown]'); } catch {} onDrag(e); }}
      >
        <GripVertical className="text-slate-400 hover:text-black transition-colors" style={{ width: size, height: size }} />
      </span>
      {/* Matita (edit) */}
      <button 
        onClick={onEdit}
        className="text-slate-400 hover:text-black transition-colors"
        title="Edit row"
        style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer' }}
      >
        <Edit3 style={{ width: size, height: size }} />
      </button>
      {/* Wrench (Condition) - subito dopo la matita se è una condition */}
      {isCondition && (
        <button
          onClick={onWrenchClick}
          className="text-slate-400 hover:text-black transition-colors"
          title="Edit condition"
          style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer' }}
        >
          <Wrench style={{ width: size, height: size }} />
        </button>
      )}
      {/* Gear (DDT) */}
      <button
        onClick={onOpenDDT}
        title={hasDDT ? 'Open DDT' : 'No DDT linked'}
        style={{ display: 'flex', alignItems: 'center', padding: 2, background: 'none', border: 'none', cursor: 'pointer' }}
      >
        <Settings style={{ width: size, height: size, color: hasDDT ? (gearColor || '#64748b') : '#9ca3af' }} />
      </button>
      {/* Cestino (delete) */}
      {canDelete && (
        <button 
          onClick={onDelete}
          className="text-red-400 hover:text-red-600 transition-colors"
          title="Delete row"
          style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer' }}
        >
          <Trash2 style={{ width: size, height: size }} />
        </button>
      )}
    </div>
  );
}; 