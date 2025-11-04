import React, { useEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import { createPortal } from 'react-dom';
import { NodeRowActionsOverlay } from './NodeRowActionsOverlay';
import { NodeRowData } from '../../types/project';

// Invisible overlay for empty space between end of text and node right edge
const EmptySpaceOverlay: React.FC<{
  labelRef: React.RefObject<HTMLSpanElement>;
  iconPos: { top: number; left: number };
  onHoverEnter: () => void;
  onHoverLeave: () => void;
}> = ({ labelRef, iconPos, onHoverEnter, onHoverLeave }) => {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!labelRef.current || !overlayRef.current) {
      if (overlayRef.current) {
        overlayRef.current.style.display = 'none';
      }
      return;
    }

    const updateOverlay = () => {
      if (!labelRef.current || !overlayRef.current) {
        if (overlayRef.current) {
          overlayRef.current.style.display = 'none';
        }
        return;
      }

      const labelRect = labelRef.current.getBoundingClientRect();
      const nodeEl = labelRef.current.closest('.react-flow__node') as HTMLElement | null;
      if (!nodeEl) {
        overlayRef.current.style.display = 'none';
        return;
      }

      const nodeRect = nodeEl.getBoundingClientRect();

      // Calculate empty space: from end of label text to right edge of node
      const labelEnd = labelRect.right;
      const nodeRight = nodeRect.right;
      const emptyWidth = nodeRight - labelEnd;

      if (emptyWidth > 0) {
        overlayRef.current.style.position = 'fixed';
        overlayRef.current.style.left = `${labelEnd}px`;
        overlayRef.current.style.top = `${labelRect.top}px`;
        overlayRef.current.style.width = `${emptyWidth}px`;
        overlayRef.current.style.height = `${labelRect.height}px`;
        overlayRef.current.style.pointerEvents = 'auto';
        overlayRef.current.style.zIndex = '998';
        overlayRef.current.style.display = 'block';
      } else {
        overlayRef.current.style.display = 'none';
      }
    };

    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(updateOverlay);
    window.addEventListener('resize', updateOverlay);
    window.addEventListener('scroll', updateOverlay, true);

    return () => {
      window.removeEventListener('resize', updateOverlay);
      window.removeEventListener('scroll', updateOverlay, true);
    };
  }, [labelRef, iconPos]);

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'fixed',
        background: 'transparent',
        pointerEvents: 'auto',
        zIndex: 998,
      }}
      onMouseEnter={onHoverEnter}
      onMouseLeave={onHoverLeave}
      onMouseDown={(e) => {
        // Prevent default but don't stop propagation - this allows hover to work
        // but doesn't interfere with drag on label
        e.preventDefault();
      }}
    />
  );
};

interface NodeRowLabelProps {
  row: NodeRowData;
  included: boolean;
  setIncluded: (val: boolean) => void;
  labelRef: React.RefObject<HTMLSpanElement>;
  Icon: React.ComponentType<any> | null;
  showIcons: boolean;
  iconPos: { top: number; left: number } | null;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onDrag: (e: React.MouseEvent) => void;
  onLabelDragStart?: (e: React.MouseEvent) => void;
  isEditing: boolean;
  setIsEditing: (val: boolean) => void;
  bgColor: string;
  labelTextColor: string;
  iconSize?: number;
  hasDDT?: boolean;
  gearColor?: string;
  onOpenDDT?: () => void;
  onDoubleClick: () => void;
  onIconsHoverChange?: (v: boolean) => void;
  onLabelHoverChange?: (v: boolean) => void;
  onTypeChangeRequest?: (anchor?: DOMRect) => void; // NEW: request to open type picker with anchor rect
  onRequestClosePicker?: () => void; // NEW: ask parent to close type picker
  overlayRef?: React.RefObject<HTMLDivElement>;
}

export const NodeRowLabel: React.FC<NodeRowLabelProps> = ({
  row,
  included,
  setIncluded,
  labelRef,
  Icon,
  showIcons,
  iconPos,
  canDelete,
  onEdit,
  onDelete,
  onDrag,
  onLabelDragStart,
  isEditing,
  setIsEditing,
  bgColor,
  labelTextColor,
  iconSize,
  hasDDT,
  gearColor,
  onOpenDDT,
  onDoubleClick,
  onIconsHoverChange,
  onLabelHoverChange,
  onTypeChangeRequest,
  onRequestClosePicker,
  overlayRef
}) => (
  <>
    {/* Checkbox: show only when label/text is present. Default is a black tick; unchecked shows grey box. */}
    {(row.text && row.text.trim().length > 0) && (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 14,
          height: 14,
          marginRight: 6,
          borderRadius: 3,
          border: '1px solid rgba(0,0,0,0.6)',
          background: included ? 'transparent' : '#e5e7eb',
        }}
        title="Include this row in the flow"
        onClick={(e) => {
          e.stopPropagation();
          setIncluded(!included);
        }}
      >
        {included ? (
          <Check className="w-3 h-3" style={{ color: 'rgba(0,0,0,0.9)' }} />
        ) : null}
      </span>
    )}
    <span
      ref={labelRef}
      className="block cursor-pointer transition-colors flex items-center relative nodrag"
      style={{ background: included ? 'transparent' : '#f3f4f6', color: included ? labelTextColor : '#9ca3af', borderRadius: 4, paddingLeft: row.categoryType && Icon ? 4 : 0, paddingRight: 8, minHeight: '1.5em', lineHeight: 1.1, marginTop: 0, marginBottom: 0, whiteSpace: 'nowrap', userSelect: 'none', cursor: 'grab' }}
      onDoubleClick={onDoubleClick}
      onPointerDown={(e) => { e.stopPropagation(); }}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        // consenti drag diretto sulla label quando non si è in editing
        if (!isEditing && typeof onLabelDragStart === 'function') {
          onLabelDragStart(e);
        }
      }}
      onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onMouseEnter={() => onLabelHoverChange && onLabelHoverChange(true)}
      onMouseLeave={() => onLabelHoverChange && onLabelHoverChange(false)}
      title="Double-click to edit, start typing for intellisense"
    >
      {Icon && (
        <button
          type="button"
          title="Change act type"
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            try {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              console.log('[TypePicker][labelIcon][click]', { rect, labelRect: labelRef.current?.getBoundingClientRect() });
              onTypeChangeRequest && onTypeChangeRequest(rect);
            } catch (err) { try { console.warn('[TypePicker][labelIcon][err]', err); } catch { } }
          }}
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', padding: 0, marginRight: 4, cursor: 'pointer' }}
        >
          <Icon
            className="inline-block"
            style={{
              width: typeof iconSize === 'number' ? iconSize : 12,
              height: typeof iconSize === 'number' ? iconSize : 12,
              color: included ? labelTextColor : '#9ca3af'
            }}
          />
        </button>
      )}
      {/* Gear icon intentionally omitted next to label; shown only in the external actions strip */}
      {row.text}
      {/* Invisible overlay for empty space - only when toolbar is visible */}
      {showIcons && createPortal(
        <EmptySpaceOverlay
          labelRef={labelRef}
          iconPos={iconPos}
          onHoverEnter={() => onLabelHoverChange && onLabelHoverChange(true)}
          onHoverLeave={() => onLabelHoverChange && onLabelHoverChange(false)}
        />,
        document.body
      )}
      {showIcons && iconPos && createPortal(
        <NodeRowActionsOverlay
          iconPos={iconPos}
          showIcons={showIcons}
          canDelete={canDelete}
          onEdit={onEdit}
          onDelete={onDelete}
          onDrag={onDrag}
          isEditing={isEditing}
          setIsEditing={setIsEditing}
          labelRef={labelRef}
          onHoverChange={(v) => { onIconsHoverChange && onIconsHoverChange(v); }}
          iconSize={iconSize}
          hasDDT={hasDDT}
          gearColor={gearColor || labelTextColor}
          onOpenDDT={onOpenDDT}
          isCondition={String((row as any)?.categoryType || '').toLowerCase() === 'conditions'}
          onWrenchClick={async () => {
            try {
              const variables = (window as any).__omniaVars || {};
              (await import('../../../../ui/events')).emitConditionEditorOpen({ variables });
            } catch { }
          }}
          ActIcon={Icon}
          actColor={labelTextColor}
          onTypeChangeRequest={onTypeChangeRequest}
          onRequestClosePicker={onRequestClosePicker}
          outerRef={overlayRef}
        />,
        document.body
      )}
    </span>
  </>
);