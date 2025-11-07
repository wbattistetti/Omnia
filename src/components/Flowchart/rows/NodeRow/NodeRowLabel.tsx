import React, { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { createPortal } from 'react-dom';
import { NodeRowActionsOverlay } from './NodeRowActionsOverlay';
import { NodeRowData } from '../../types/project';
import SmartTooltip from '../../../SmartTooltip';

// Component to render checkbox with dynamic size based on font
const CheckboxButton: React.FC<{
  labelRef: React.RefObject<HTMLSpanElement>;
  included: boolean;
  setIncluded: (val: boolean) => void;
}> = ({ labelRef, included, setIncluded }) => {
  const [checkboxSize, setCheckboxSize] = useState(16);
  const checkIconSize = Math.round(checkboxSize * 0.7);

  useEffect(() => {
    const updateSize = () => {
      if (labelRef.current) {
        const computedStyle = window.getComputedStyle(labelRef.current);
        const fontSize = parseFloat(computedStyle.fontSize) || 12;
        // Checkbox should be about 105.8% of font size (92% * 1.15), with min/max bounds
        const newSize = Math.max(18, Math.min(29, Math.round(fontSize * 1.058)));
        setCheckboxSize(newSize);
      } else {
        setCheckboxSize(16);
      }
    };

    updateSize();

    // Watch for font size changes
    const observer = new MutationObserver(updateSize);
    if (labelRef.current) {
      observer.observe(labelRef.current, {
        attributes: true,
        attributeFilter: ['style', 'class'],
        subtree: false
      });

      window.addEventListener('resize', updateSize);
      return () => {
        observer.disconnect();
        window.removeEventListener('resize', updateSize);
      };
    }
  }, [labelRef]);

  return (
    <SmartTooltip text="Include this row in the flow" tutorId="include_row_help" placement="bottom">
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: checkboxSize,
          height: checkboxSize,
          marginRight: 6,
          borderRadius: 3,
          border: '1px solid rgba(0,0,0,0.6)',
          background: included ? 'transparent' : '#e5e7eb',
        }}
        onClick={(e) => {
          e.stopPropagation();
          setIncluded(!included);
        }}
      >
        {included ? (
          <Check style={{ width: checkIconSize, height: checkIconSize, color: 'rgba(0,0,0,0.9)' }} />
        ) : null}
      </span>
    </SmartTooltip>
  );
};

// Component to render primary icon with dynamic size based on font
const PrimaryIconButton: React.FC<{
  Icon: React.ComponentType<any>;
  iconSize?: number;
  labelRef: React.RefObject<HTMLSpanElement>;
  included: boolean;
  iconColor: string; // Usa iconColor invece di labelTextColor
  onTypeChangeRequest?: (anchor?: DOMRect) => void;
}> = ({ Icon, iconSize, labelRef, included, iconColor, onTypeChangeRequest }) => {
  const [computedSize, setComputedSize] = useState(12);

  useEffect(() => {
    const updateSize = () => {
      if (typeof iconSize === 'number') {
        setComputedSize(iconSize);
        return;
      }
      if (labelRef.current) {
        const computedStyle = window.getComputedStyle(labelRef.current);
        const fontSize = parseFloat(computedStyle.fontSize) || 12;
        // Icon should be about 119% of font size (103.5% * 1.15), with min/max bounds
        const newSize = Math.max(16, Math.min(32, Math.round(fontSize * 1.19)));
        setComputedSize(newSize);
      } else {
        setComputedSize(12);
      }
    };

    updateSize();

    // Watch for font size changes
    const observer = new MutationObserver(updateSize);
    if (labelRef.current) {
      observer.observe(labelRef.current, {
        attributes: true,
        attributeFilter: ['style', 'class'],
        subtree: false
      });

      // Also listen to resize events
      window.addEventListener('resize', updateSize);
      return () => {
        observer.disconnect();
        window.removeEventListener('resize', updateSize);
      };
    }
  }, [iconSize, labelRef]);

  // Icon color applied (no logging to reduce console clutter)
  useEffect(() => {
    // Color is applied via inline style on the Icon component
  }, [iconColor, computedSize, labelRef]);

  return (
    <SmartTooltip text="Change act type" tutorId="change_act_type_help" placement="bottom">
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          try {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            onTypeChangeRequest && onTypeChangeRequest(rect);
          } catch (err) { try { console.warn('[TypePicker][labelIcon][err]', err); } catch { } }
        }}
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', padding: 0, marginRight: 4, cursor: 'pointer' }}
      >
        <Icon
          className="inline-block"
          style={{
            width: computedSize,
            height: computedSize,
            color: (!included) ? '#9ca3af' : iconColor // Grigio se unchecked, altrimenti usa iconColor
          }}
        />
      </button>
    </SmartTooltip>
  );
};

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
        border: 'none', // Transparent - no visible border
        borderRadius: '4px',
        pointerEvents: 'auto',
        zIndex: 998,
      }}
      onMouseEnter={onHoverEnter}
      onMouseLeave={onHoverLeave}
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
  iconColor?: string; // Colore dell'icona (grigio se no DDT, colore del tipo se ha DDT)
  iconSize?: number;
  hasDDT?: boolean;
  gearColor?: string;
  onOpenDDT?: () => void;
  onDoubleClick: () => void;
  onIconsHoverChange?: (v: boolean) => void;
  onLabelHoverChange?: (v: boolean) => void;
  onTypeChangeRequest?: (anchor?: DOMRect) => void; // NEW: request to open type picker with anchor rect
  onRequestClosePicker?: () => void; // NEW: ask parent to close type picker
  buttonCloseTimeoutRef?: React.MutableRefObject<NodeJS.Timeout | null>;
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
  iconColor,
  iconSize,
  hasDDT,
  gearColor,
  onOpenDDT,
  onDoubleClick,
  onIconsHoverChange,
  onLabelHoverChange,
  onTypeChangeRequest,
  onRequestClosePicker,
  buttonCloseTimeoutRef,
  overlayRef
}) => (
  <>
    <span
      ref={labelRef}
      className="block cursor-pointer transition-colors flex items-center relative nodrag"
      style={{ background: included ? 'transparent' : '#f3f4f6', color: included ? labelTextColor : '#9ca3af', borderRadius: 4, paddingLeft: row.categoryType && Icon ? 4 : 0, paddingRight: 8, minHeight: '1.5em', lineHeight: 1.1, marginTop: 0, marginBottom: 0, whiteSpace: 'nowrap', userSelect: 'none', cursor: 'grab' }}
      onDoubleClick={onDoubleClick}
      onMouseDown={(e) => {
        // consenti drag diretto sulla label quando non si è in editing
        if (!isEditing && typeof onLabelDragStart === 'function') {
          // ✅ IMPORTANTE: stopPropagation PRIMA di chiamare onLabelDragStart
          // per impedire che React Flow intercetti l'evento
          e.stopPropagation();
          onLabelDragStart(e);
        }
      }}
      onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onMouseEnter={() => onLabelHoverChange && onLabelHoverChange(true)}
      onMouseLeave={() => onLabelHoverChange && onLabelHoverChange(false)}
    >
      {Icon && (() => {
        const finalIconColor = iconColor || labelTextColor;
        return (
          <PrimaryIconButton
            Icon={Icon}
            iconSize={iconSize}
            labelRef={labelRef}
            included={included}
            iconColor={finalIconColor}
            onTypeChangeRequest={onTypeChangeRequest}
          />
        );
      })()}
      {/* Gear icon intentionally omitted next to label; shown only in the external actions strip */}
      {row.text}
      {/* Yellow bordered hover area - always visible to trigger toolbar */}
      {createPortal(
        <EmptySpaceOverlay
          labelRef={labelRef}
          iconPos={iconPos || { top: 0, left: 0 }}
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
          actColor={iconColor || labelTextColor}
          onTypeChangeRequest={onTypeChangeRequest}
          onRequestClosePicker={onRequestClosePicker}
          buttonCloseTimeoutRef={buttonCloseTimeoutRef}
          outerRef={overlayRef}
          included={included}
          setIncluded={setIncluded}
        />,
        document.body
      )}
    </span>
  </>
);