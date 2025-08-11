import React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import styles from './ActionRow.module.css';

interface ActionRowActionsProps {
  onEdit?: (() => void) | ((...args: any[]) => void);
  onDelete?: () => void;
  color?: string;
  style?: React.CSSProperties;
}

const ActionRowActions: React.FC<ActionRowActionsProps> = ({ onEdit, onDelete, color = '#94a3b8', style }) => {
  return (
    <span
      className={styles.actionRowActions}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        transition: 'opacity 0.15s',
        ...style,
      }}
    >
      {onEdit && (
        <button
          onClick={() => (typeof onEdit === 'function' ? onEdit() : undefined)}
          style={{ background: 'none', border: 'none', color, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', padding: 0 }}
          tabIndex={-1}
          title="Modifica messaggio"
          aria-label="Edit message"
        >
          <Pencil size={18} />
        </button>
      )}
      {onDelete && (
        <button
          onClick={onDelete}
          style={{ background: 'none', border: 'none', color, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', padding: 0 }}
          tabIndex={-1}
          title="Elimina messaggio"
          aria-label="Delete message"
        >
          <Trash2 size={18} />
        </button>
      )}
    </span>
  );
};

export default ActionRowActions;
