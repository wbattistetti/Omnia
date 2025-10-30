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
  onTypeChangeRequest?: (anchor: DOMRect) => void;
  onRequestClosePicker?: () => void;
  outerRef?: React.RefObject<HTMLDivElement>;
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
  onTypeChangeRequest,
  onRequestClosePicker,
  outerRef
}) => {
  if (!showIcons || !iconPos) return null;
  const size = typeof iconSize === 'number' ? iconSize : (labelRef.current ? Math.max(12, Math.min(20, Math.round(labelRef.current.getBoundingClientRect().height * 0.7))) : 14);
  return (
    <div
      ref={outerRef}
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
      onMouseEnter={() => { onHoverChange && onHoverChange(true); console.log('[Toolbar][enter][overlay]'); }}
      onMouseLeave={() => { onHoverChange && onHoverChange(false); console.log('[Toolbar][leave][overlay]'); }}
    >
      {/* Current ActType icon → opens inline type picker below */}
      {ActIcon && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            // Anchor to the icon itself (client coordinates for fixed positioning)
            const anchor = (e.currentTarget as HTMLElement).getBoundingClientRect();
            onTypeChangeRequest && onTypeChangeRequest(anchor);
          }}
          onMouseEnter={(e) => {
            const anchor = (e.currentTarget as HTMLElement).getBoundingClientRect();
            onTypeChangeRequest && onTypeChangeRequest(anchor);
            console.log('[Picker][trigger] icon hover → open');
          }}
          title="Change act type"
          style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', display: 'flex', alignItems: 'center', opacity: 0.9, transition: 'opacity 120ms linear, transform 120ms ease' }}
          className="hover:opacity-100 hover:scale-110"
        >
          <ActIcon style={{ width: size, height: size, color: actColor || '#fbbf24', filter: 'drop-shadow(0 0 2px rgba(251,191,36,0.6))' }} />
        </button>
      )}
      {/* Drag handle */}
      <span
        className="cursor-grab nodrag hover:opacity-100 hover:scale-110"
        title="Trascina la riga"
        style={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', padding: 2, userSelect: 'none', opacity: 0.9, transition: 'opacity 120ms linear, transform 120ms ease' }}
        draggable={false}
        onDragStart={(e) => { e.preventDefault(); }}
        onPointerDown={(e) => { onDrag(e as any); }}
        onMouseDown={(e) => { onDrag(e); }}
        onMouseEnter={() => onRequestClosePicker && onRequestClosePicker()}
      >
        <GripVertical className="text-slate-300 hover:text-amber-300 transition-colors" style={{ width: size, height: size, filter: 'drop-shadow(0 0 2px rgba(251,191,36,0.6))' }} />
      </span>
      {/* Matita (edit) */}
      <button
        onClick={onEdit}
        className="text-slate-300 hover:text-amber-300 transition-colors hover:opacity-100 hover:scale-110"
        title="Edit row"
        style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', opacity: 0.9, transition: 'opacity 120ms linear, transform 120ms ease' }}
        onMouseEnter={() => onRequestClosePicker && onRequestClosePicker()}
      >
        <Edit3 style={{ width: size, height: size }} />
      </button>
      {/* Wrench (Condition) - subito dopo la matita se è una condition */}
      {isCondition && (
        <button
          onClick={onWrenchClick}
          className="text-slate-300 hover:text-amber-300 transition-colors hover:opacity-100 hover:scale-110"
          title="Edit condition"
          style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', opacity: 0.9, transition: 'opacity 120ms linear, transform 120ms ease' }}
          onMouseEnter={() => onRequestClosePicker && onRequestClosePicker()}
        >
          <Wrench style={{ width: size, height: size }} />
        </button>
      )}
      {/* Gear (DDT) */}
      <button
        title={hasDDT ? 'Open DDT' : 'No DDT linked'}
        style={{ display: 'flex', alignItems: 'center', padding: 2, background: 'none', border: 'none', cursor: 'pointer', opacity: 0.9, transition: 'opacity 120ms linear, transform 120ms ease' }}
        className="hover:opacity-100 hover:scale-110"
        onMouseEnter={() => onRequestClosePicker && onRequestClosePicker()}
        onMouseDown={(e) => { try { console.log('[DDT][gear][mouseDown]', { x: e.clientX, y: e.clientY }); } catch { } }}
        onClick={(e) => {
          console.log('🔥🔥🔥 GEAR CLICKED 🔥🔥🔥', { x: e.clientX, y: e.clientY });
          alert('🔥 GEAR CLICKED! Check console for logs 🔥');
          onOpenDDT();
        }}
      >
        <Settings style={{ width: size, height: size, color: hasDDT ? (gearColor || '#fbbf24') : '#9ca3af', filter: hasDDT ? 'drop-shadow(0 0 2px rgba(251,191,36,0.6))' : undefined }} />
      </button>
      {/* Cestino (delete) */}
      {canDelete && (
        <button
          onClick={onDelete}
          className="text-red-400 hover:text-red-500 transition-colors hover:opacity-100 hover:scale-110"
          title="Delete row"
          style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', opacity: 0.95, transition: 'opacity 120ms linear, transform 120ms ease' }}
          onMouseEnter={() => onRequestClosePicker && onRequestClosePicker()}
        >
          <Trash2 style={{ width: size, height: size }} />
        </button>
      )}
    </div>
  );
};