import React, { useState, useRef } from 'react';
import { Check, X } from 'lucide-react';
import ActionRowActions from './ActionRowActions';
import ActionText from './ActionText';
import styles from './ActionRow.module.css';

interface ActionRowProps {
  icon?: React.ReactNode;
  label?: string;
  text: string;
  color?: string;
  onEdit?: (newText: string) => void;
  onDelete?: () => void;
  draggable?: boolean;
  selected?: boolean;
  dndPreview?: 'before' | 'after';
  actionId?: string;
  isDragging?: boolean;
  autoEdit?: boolean; // when true, open editor and focus input
}

function ActionRowInner({
  icon,
  label,
  text,
  color = '#a21caf',
  onEdit,
  onDelete,
  draggable,
  selected,
  dndPreview,
  actionId,
  isDragging = false,
  autoEdit = false
}: ActionRowProps) {
  const [editing, setEditing] = useState(false);
  const [wasConfirmed, setWasConfirmed] = useState(false);
  const [editValue, setEditValue] = useState(text);
  const inputRef = useRef<HTMLInputElement>(null);

  // Open editor automatically when asked
  React.useEffect(() => {
    if (autoEdit && actionId === 'sayMessage') {
      setEditValue(text || '');
      setEditing(true);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [autoEdit, text, actionId]);

  const handleEdit = () => {
    if (actionId !== 'sayMessage') return;
    setEditValue(text);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };
  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Conferma come se si premesse la spunta
      if (onEdit && editValue !== text) onEdit(editValue);
      setEditing(false);
      try { inputRef.current?.blur(); } catch { }
      setWasConfirmed(true);
    }
    if (e.key === 'Escape') {
      // If this row is newly added and still empty, ESC removes it
      if (!wasConfirmed && !text && (!editValue || editValue.trim().length === 0)) {
        if (onDelete) {
          e.preventDefault();
          onDelete();
          return;
        }
      }
      setEditing(false);
      setEditValue(text);
    }
  };
  const handleEditConfirm = () => {
    if (onEdit && editValue !== text) onEdit(editValue);
    setEditing(false);
    setWasConfirmed(true);
  };
  const handleEditCancel = () => {
    setEditing(false);
    setEditValue(text);
  };

  return (
    <div>
      <div
        className={styles.row}
        style={{
          background: selected ? '#ede9fe' : 'transparent',
          border: selected ? `2px solid ${color}` : 'none',
          borderRadius: 8,
          padding: '8px 0',
          marginBottom: 6,
          boxShadow: selected ? `0 2px 8px 0 ${color}22` : undefined,
          cursor: isDragging ? 'grabbing' : (draggable ? 'grab' : 'default'),
          transition: 'background 0.15s, border 0.15s',
          position: 'relative',
          borderTop: dndPreview === 'before' ? '2px solid #2563eb' : undefined,
          borderBottom: dndPreview === 'after' ? '2px solid #2563eb' : undefined,
        }}
      >
        {icon && <span style={{ color, display: 'flex', alignItems: 'center', marginRight: 8 }}>{icon}</span>}
        {actionId && actionId !== 'sayMessage' && actionId !== 'askQuestion' && label && (
          <span
            style={{
              background: '#222',
              color: '#fff',
              borderRadius: 8,
              padding: '2px 8px',
              fontSize: 15,
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
        {actionId === 'sayMessage' && (
          <ActionText
            text={text}
            editing={editing}
            inputRef={inputRef}
            editValue={editValue}
            onChange={setEditValue}
            onKeyDown={handleEditKeyDown}
          />
        )}
        {editing && actionId === 'sayMessage' ? (
          <>
            <button
              onClick={handleEditConfirm}
              style={{ background: 'none', border: 'none', color: '#22c55e', cursor: 'pointer', marginRight: 6, fontSize: 18, display: 'flex', alignItems: 'center' }}
              tabIndex={-1}
              title="Conferma modifica"
              aria-label="Conferma modifica"
            >
              <Check size={18} />
            </button>
            <button
              onClick={handleEditCancel}
              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center' }}
              tabIndex={-1}
              title="Annulla modifica"
              aria-label="Annulla modifica"
            >
              <X size={18} />
            </button>
          </>
        ) : (
          <ActionRowActions
            onEdit={actionId === 'sayMessage' ? handleEdit : undefined}
            onDelete={onDelete}
            color={'#94a3b8'}
            style={{ marginLeft: 10 }}
          />
        )}
      </div>
    </div>
  );
}

const areEqual = (prev: ActionRowProps, next: ActionRowProps) => (
  prev.text === next.text &&
  prev.label === next.label &&
  prev.selected === next.selected &&
  prev.isDragging === next.isDragging &&
  prev.actionId === next.actionId
);

export default React.memo(ActionRowInner, areEqual);