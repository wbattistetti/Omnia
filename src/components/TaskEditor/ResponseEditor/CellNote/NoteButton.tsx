import React from 'react';
import { MessageCircle } from 'lucide-react';

interface NoteButtonProps {
  hasNote: boolean;
  onClick: () => void;
}

/**
 * Button to add/edit notes in test grid cells
 * Always visible when there's a test result (Approach B)
 */
export default function NoteButton({ hasNote, onClick }: NoteButtonProps) {
  return (
    <button
      onClick={(e) => {
        console.log('[NOTE] NoteButton clicked!', { hasNote });
        e.stopPropagation();
        console.log('[NOTE] Calling onClick handler');
        onClick();
        console.log('[NOTE] onClick handler called');
      }}
      title={hasNote ? "Edit note" : "Add note"}
      style={{
        background: hasNote ? '#3b82f6' : 'rgba(255,255,255,0.5)',
        border: 'none',
        borderRadius: 4,
        padding: 4,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        marginLeft: 4,
        flexShrink: 0,
      }}
    >
      <MessageCircle size={12} color={hasNote ? '#fff' : '#666'} />
    </button>
  );
}

