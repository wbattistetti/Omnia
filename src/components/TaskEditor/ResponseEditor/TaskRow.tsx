/**
 * Orchestrates escalation task row layout: header slot, body slot, actions.
 * Does not know about task.parameters — body is built by the parent.
 */

import React from 'react';
import TaskRowActions from './TaskRowActions';
import styles from './TaskRow.module.css';
import { useFontContext } from '@context/FontContext';

export type TaskRowProps = {
  header: React.ReactNode;
  body: React.ReactNode;
  color?: string;
  onDelete?: () => void;
  draggable?: boolean;
  selected?: boolean;
  dndPreview?: 'before' | 'after';
  isDragging?: boolean;
  /** Open primary translated field (e.g. message text) — pencil action */
  onEditPrimary?: () => void;
  /** True when any inline editor in the row is active — hides row actions, adjusts cursor */
  rowEditorActive?: boolean;
};

function TaskRowInner({
  header,
  body,
  color = '#a21caf',
  onDelete,
  draggable,
  selected,
  dndPreview,
  isDragging = false,
  onEditPrimary,
  rowEditorActive = false,
}: TaskRowProps) {
  const { combinedClass } = useFontContext();

  return (
    <div className={combinedClass}>
      <div
        className={styles.row}
        style={{
          background: selected ? '#ede9fe' : 'transparent',
          border: selected ? `2px solid ${color}` : 'none',
          borderRadius: 8,
          padding: '8px 0',
          marginBottom: 6,
          boxShadow: selected ? `0 2px 8px 0 ${color}22` : undefined,
          cursor: rowEditorActive ? 'text' : isDragging ? 'grabbing' : draggable ? 'grab' : 'default',
          transition: 'background 0.15s, border 0.15s',
          position: 'relative',
          borderTop: dndPreview === 'before' ? '2px solid #2563eb' : undefined,
          borderBottom: dndPreview === 'after' ? '2px solid #2563eb' : undefined,
          alignItems: 'flex-start',
        }}
      >
        {header}
        {body}
        {!rowEditorActive && (
          <TaskRowActions
            onEdit={onEditPrimary}
            onDelete={onDelete}
            color="#94a3b8"
            style={{ marginLeft: 10, alignSelf: 'flex-start' }}
          />
        )}
      </div>
    </div>
  );
}

const areEqual = (prev: TaskRowProps, next: TaskRowProps) =>
  prev.header === next.header &&
  prev.body === next.body &&
  prev.selected === next.selected &&
  prev.isDragging === next.isDragging &&
  prev.rowEditorActive === next.rowEditorActive &&
  prev.color === next.color &&
  prev.onEditPrimary === next.onEditPrimary &&
  prev.onDelete === next.onDelete;

export default React.memo(TaskRowInner, areEqual);
