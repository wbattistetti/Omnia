import React from 'react';
import { Check } from 'lucide-react';
import { createPortal } from 'react-dom';
import { NodeRowActionsOverlay } from './NodeRowActionsOverlay';
import { NodeRowData } from '../../types/project';

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
  onDoubleClick: () => void;
  onIconsHoverChange?: (v: boolean) => void;
  onLabelHoverChange?: (v: boolean) => void;
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
  onDoubleClick,
  onIconsHoverChange,
  onLabelHoverChange
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
        onClick={(e) => { e.stopPropagation(); setIncluded(!included); }}
      >
        {included ? (
          <Check className="w-3 h-3" style={{ color: 'rgba(0,0,0,0.9)' }} />
        ) : null}
      </span>
    )}
    <span
      ref={labelRef}
      className="block text-[8px] cursor-pointer transition-colors flex items-center relative nodrag"
      style={{ background: included ? 'transparent' : '#f3f4f6', color: included ? labelTextColor : '#9ca3af', borderRadius: 4, paddingLeft: row.categoryType && Icon ? 4 : 0, paddingRight: 8, minHeight: '18px', lineHeight: 1.1, marginTop: 0, marginBottom: 0, whiteSpace: 'nowrap', userSelect: 'none', cursor: 'grab' }}
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
        <Icon
          className="inline-block"
          style={{
            width: typeof iconSize === 'number' ? iconSize : 12,
            height: typeof iconSize === 'number' ? iconSize : 12,
            marginRight: 4,
            color: included ? labelTextColor : '#9ca3af'
          }}
        />
      )}
      {/* Gear icon intentionally omitted next to label; shown only in the external actions strip */}
      {row.text}
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
          onHoverChange={onIconsHoverChange}
          iconSize={iconSize}
          hasDDT={hasDDT}
          gearColor={gearColor || labelTextColor}
        />, 
        document.body
      )}
    </span>
  </>
); 