import React from 'react';
import { Trash2 } from 'lucide-react';

type EscalationHeaderProps = {
  name: string;
  color: string;
  isHovered: boolean;
  onDelete?: () => void;
};

export function EscalationHeader({
  name,
  color,
  isHovered,
  onDelete
}: EscalationHeaderProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '0.75rem'
    }}>
      <span style={{
        fontSize: '0.875rem',
        fontWeight: 500,
        color: color
      }}>
        {name}
      </span>
      {onDelete && (
        <button
          onClick={onDelete}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '24px',
            height: '24px',
            padding: 0,
            backgroundColor: 'transparent',
            border: 'none',
            borderRadius: '4px',
            color: '#ef4444',
            cursor: 'pointer',
            opacity: isHovered ? 1 : 0.6,
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#ef444415';
            e.currentTarget.style.opacity = '1';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.opacity = isHovered ? '1' : '0.6';
          }}
          title="Elimina escalation"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}
