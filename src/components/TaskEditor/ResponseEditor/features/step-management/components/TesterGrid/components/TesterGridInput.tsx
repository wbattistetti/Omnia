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
      onChange={(e) => {
        // ✅ CRITICAL: Permetti sempre l'input, anche durante batch
        // setNewExample non modifica la struttura del nodo, quindi è sicuro
        const newValue = e.target.value;
        console.log('[TesterGridInput] onChange', { newValue, value });
        onChange(newValue);
      }}
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
        position: 'relative',
        zIndex: 1001, // ✅ CRITICAL: zIndex più alto dell'overlay (1000) per garantire che l'input sia sempre cliccabile
      }}
    />
  );
}
