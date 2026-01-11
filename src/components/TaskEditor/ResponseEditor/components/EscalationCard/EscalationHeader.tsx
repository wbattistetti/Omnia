import React from 'react';
import { Trash2, ChevronDown, ChevronRight } from 'lucide-react';

type EscalationHeaderProps = {
  name: string;
  color: string;
  isHovered: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onDelete?: () => void;
};

export function EscalationHeader({
  name,
  color,
  isHovered,
  isExpanded,
  onToggleExpand,
  onDelete
}: EscalationHeaderProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: isExpanded ? '0.75rem' : '0',
      cursor: 'pointer',
      userSelect: 'none'
    }}
    onClick={onToggleExpand}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        flex: 1
      }}>
        {isExpanded ? (
          <ChevronDown size={16} color={color} style={{ transition: 'transform 0.2s' }} />
        ) : (
          <ChevronRight size={16} color={color} style={{ transition: 'transform 0.2s' }} />
        )}
        <span style={{
          fontSize: '0.875rem',
          fontWeight: 500,
          color: color
        }}>
          {name}
        </span>
      </div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.25rem'
      }}
      onClick={(e) => e.stopPropagation()}
      >
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
    </div>
  );
}
