import React from 'react';
import { MessageCircle } from 'lucide-react';

interface NoteDisplayProps {
  text: string;
}

/**
 * Display component for saved notes
 * Shows note text with icon
 */
export default function NoteDisplay({ text }: NoteDisplayProps) {
  return (
    <div
      style={{
        fontSize: 11,
        fontStyle: 'italic',
        color: '#666',
        display: 'flex',
        gap: 4,
        alignItems: 'start',
      }}
    >
      <MessageCircle size={10} style={{ marginTop: 2, flexShrink: 0 }} />
      <span style={{ wordBreak: 'break-word' }}>{text}</span>
    </div>
  );
}

