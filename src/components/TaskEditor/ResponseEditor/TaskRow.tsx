import React, { useState, useRef } from 'react';
import TaskRowActions from './TaskRowActions';
import { EditableText } from '../../common/EditableText';
import styles from './TaskRow.module.css';
import { useFontContext } from '@context/FontContext';

interface TaskRowProps {
  icon?: React.ReactNode;
  label?: string;
  text: string;
  color?: string;
  onEdit?: (newText: string) => void;
  onDelete?: () => void;
  draggable?: boolean;
  selected?: boolean;
  dndPreview?: 'before' | 'after';
  taskId?: string; // ✅ Renamed from actionId
  isDragging?: boolean;
  autoEdit?: boolean; // when true, open editor and focus input
  onEditingChange?: (isEditing: boolean) => void; // Callback when editing state changes
}

function TaskRowInner({
  icon,
  label,
  text,
  color = '#a21caf',
  onEdit,
  onDelete,
  draggable,
  selected,
  dndPreview,
  taskId,
  isDragging = false,
  autoEdit = false,
  onEditingChange
}: TaskRowProps) {
  const { combinedClass } = useFontContext();
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Removed verbose log
  React.useEffect(() => {
    // Removed verbose log - useEffect for side effects only
  }, [taskId, text, onEdit, editing, label]);

  // Notify parent when editing state changes
  React.useEffect(() => {
    onEditingChange?.(editing);
  }, [editing, onEditingChange]);

  // Open editor automatically when asked
  React.useEffect(() => {
    if (autoEdit && taskId === 'sayMessage' && !editing) {
      setEditing(true);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [autoEdit, taskId, editing]);

  const handleEdit = () => {
    if (taskId !== 'sayMessage') return;
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleSave = (newValue: string) => {
    setEditing(false);
    try { inputRef.current?.blur(); } catch { }

    // If the value is empty after trimming, delete the row
    if (newValue.length === 0 && onDelete) {
      onDelete();
      return;
    }

    // Always call onEdit when saving, regardless of whether value changed
    // This ensures edits are saved even if text prop hasn't updated yet
    if (onEdit) {
      onEdit(newValue);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    // Notify parent that editing was cancelled
    onEditingChange?.(false);
  };

  const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    if (!editing) {
      return;
    }

    // Check if clicking on confirm/cancel buttons - if so, let them handle it
    const clickedOnButton = e.relatedTarget && (e.relatedTarget as HTMLElement).tagName === 'BUTTON';
    if (clickedOnButton) {
      return;
    }

    // If we were editing and there's a value, save it
    const trimmedValue = e.target.value?.trim() || '';
    const trimmedText = text?.trim() || '';

    // Same check as ESC: if this row is newly added and still empty, remove it
    if (trimmedText.length === 0 && trimmedValue.length === 0) {
      setEditing(false);
      if (onDelete) {
        onDelete();
      }
      return;
    }

    setEditing(false);
    if (trimmedValue.length > 0) {
      // Save the new value if it's not empty
      if (onEdit) {
        onEdit(trimmedValue);
      }
    }
  };

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
          cursor: editing ? 'text' : (isDragging ? 'grabbing' : (draggable ? 'grab' : 'default')),
          transition: 'background 0.15s, border 0.15s',
          position: 'relative',
          borderTop: dndPreview === 'before' ? '2px solid #2563eb' : undefined,
          borderBottom: dndPreview === 'after' ? '2px solid #2563eb' : undefined,
        }}
      >
        {icon && <span style={{ color, display: 'flex', alignItems: 'center', marginRight: 8 }}>{icon}</span>}
        {taskId && taskId !== 'sayMessage' && label && (
          <span
            style={{
              background: '#222',
              color: '#fff',
              borderRadius: 8,
              padding: '2px 8px',
              fontWeight: 500,
              marginRight: 8,
              display: 'inline-block',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: 220
            }}
          >
            {label}
          </span>
        )}
        {taskId === 'sayMessage' ? (
          <EditableText
            value={text}
            editing={editing}
            onSave={handleSave}
            onCancel={handleCancel}
            onStartEditing={handleEdit}
            onBlur={handleBlur}
            inputRef={inputRef}
            placeholder="Scrivi un testo qui..."
            displayMode="text"
            showActionButtons={true}
            expectedLanguage="it"
            showLanguageWarning={true}
            enableVoice={true}
            multiline={true}
            style={{
              marginRight: 10,
            }}
          />
        ) : (
          <span style={{ color: '#fff', fontWeight: 500 }}>{text}</span>
        )}
        {!editing && (
          <TaskRowActions
            onEdit={taskId === 'sayMessage' ? handleEdit : undefined}
            onDelete={onDelete}
            color={'#94a3b8'}
            style={{ marginLeft: 10 }}
          />
        )}
      </div>
    </div>
  );
}

const areEqual = (prev: TaskRowProps, next: TaskRowProps) => (
  prev.text === next.text &&
  prev.label === next.label &&
  prev.selected === next.selected &&
  prev.isDragging === next.isDragging &&
  prev.taskId === next.taskId
);

export default React.memo(TaskRowInner, areEqual);



