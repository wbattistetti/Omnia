import React from 'react';

interface NoteEditorProps {
  value: string;
  onSave: (text: string) => void;
  onDelete?: () => void;
  onCancel: () => void;
}

/**
 * Inline editor for cell notes
 * Textarea with save/delete/cancel buttons
 */
export default function NoteEditor({
  value,
  onSave,
  onDelete,
  onCancel
}: NoteEditorProps) {
  const [text, setText] = React.useState(value);

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSave(text);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete();
    }
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCancel();
  };

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          // Auto-resize textarea
          e.target.style.height = 'auto';
          e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
        }}
        placeholder="Aggiungi una nota..."
        rows={2}
        autoFocus
        style={{
          width: '100%',
          padding: 4,
          fontSize: 11,
          border: '1px solid #ddd',
          borderRadius: 4,
          background: 'rgba(255,255,255,0.9)',
          resize: 'vertical',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          lineHeight: 1.5,
          minHeight: '2em',
          maxHeight: '200px',
        }}
      />
      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
        <button
          onClick={handleSave}
          style={{
            padding: '2px 6px',
            fontSize: 11,
            cursor: 'pointer',
            borderRadius: 3,
            border: '1px solid #ddd',
          }}
        >
          💾
        </button>
        {value && onDelete && (
          <button
            onClick={handleDelete}
            style={{
              padding: '2px 6px',
              fontSize: 11,
              cursor: 'pointer',
              borderRadius: 3,
              border: '1px solid #ddd',
            }}
          >
            🗑️
          </button>
        )}
        <button
          onClick={handleCancel}
          style={{
            padding: '2px 6px',
            fontSize: 11,
            cursor: 'pointer',
            borderRadius: 3,
            border: '1px solid #ddd',
          }}
        >
          ❌
        </button>
      </div>
    </div>
  );
}

