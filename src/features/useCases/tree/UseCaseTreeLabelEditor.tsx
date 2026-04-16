import React, { forwardRef } from 'react';
import {
  LabelWithPencilEdit,
  type LabelWithPencilEditHandle,
} from '@components/FlowMappingPanel/LabelWithPencilEdit';

/**
 * Shared inline label editor with confirm/cancel UX (ref exposes startEditing for toolbar).
 */
export const UseCaseTreeLabelEditor = forwardRef<LabelWithPencilEditHandle, {
  value: string;
  editable: boolean;
  editIntent?: boolean;
  onConsumeEditIntent?: () => void;
  onCommit: (nextValue: string) => void;
  onEditingChange?: (editing: boolean) => void;
}>(function UseCaseTreeLabelEditor(props, ref) {
  const { value, editable, editIntent, onConsumeEditIntent, onCommit, onEditingChange } = props;
  return (
    <LabelWithPencilEdit
      ref={ref}
      segment={value}
      displayLabel={value}
      editable={editable}
      editIntent={editIntent}
      onConsumeEditIntent={onConsumeEditIntent}
      onCommit={onCommit}
      inlinePencil={false}
      viewTitle={value}
      onEditingChange={onEditingChange}
    />
  );
});

