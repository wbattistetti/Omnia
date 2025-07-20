import React from 'react';
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
  isEditing: boolean;
  setIsEditing: (val: boolean) => void;
  bgColor: string;
  labelTextColor: string;
  onDoubleClick: () => void;
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
  isEditing,
  setIsEditing,
  bgColor,
  labelTextColor,
  onDoubleClick
}) => (
  <>
    {/* Checkbox per inclusione nel flusso */}
    <input
      type="checkbox"
      checked={included}
      onChange={e => setIncluded(e.target.checked)}
      style={{ marginRight: 6, accentColor: '#8b5cf6' }}
      title="Includi questa riga nel flusso"
    />
    <span
      ref={labelRef}
      className="block text-[8px] cursor-pointer hover:text-purple-300 transition-colors flex items-center relative"
      style={{ background: included ? bgColor : '#f3f4f6', color: included ? labelTextColor : '#b0b0b0', borderRadius: 4, paddingLeft: row.categoryType && Icon ? 4 : 0, paddingRight: 8, minHeight: '18px', lineHeight: 1.1, marginTop: 0, marginBottom: 0 }}
      onDoubleClick={onDoubleClick}
      title="Double-click to edit, start typing for intellisense"
    >
      {Icon && <Icon style={{ fontSize: '0.9em', marginRight: 4 }} />}
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
        />, 
        document.body
      )}
    </span>
  </>
); 