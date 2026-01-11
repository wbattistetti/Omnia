import React from 'react';

interface TesterGridInputProps {
  value: string;
  onChange: (value: string) => void;
  onAdd: () => void;
  placeholder?: string;
}

/**
 * Input component for adding new test phrases
 */
export default function TesterGridInput({
  value,
  onChange,
  onAdd,
  placeholder = 'Aggiungi frase di test...',
}: TesterGridInputProps) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey && value.trim()) {
          e.preventDefault();
          onAdd();
        }
      }}
      placeholder={placeholder}
      style={{
        width: '100%',
        padding: '6px 8px',
        border: '1px solid #334155',
        borderRadius: 4,
        background: '#fff',
        color: '#111827',
      }}
    />
  );
}
