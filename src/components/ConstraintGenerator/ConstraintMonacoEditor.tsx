import React from 'react';
// Se Monaco non è installato, mostra un placeholder
// In produzione, importa: import MonacoEditor from 'react-monaco-editor';

interface ConstraintMonacoEditorProps {
  script: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

const ConstraintMonacoEditor: React.FC<ConstraintMonacoEditorProps> = ({ script, onChange, readOnly }) => {
  // Placeholder: sostituisci con MonacoEditor se disponibile
  return (
    <textarea
      value={script}
      onChange={e => onChange(e.target.value)}
      readOnly={readOnly}
      style={{
        width: '100%',
        minHeight: 80,
        fontFamily: 'Fira Mono, Menlo, monospace',
        fontSize: 15,
        background: '#18181b',
        color: '#f3f3f3',
        border: '1.5px solid #a21caf',
        borderRadius: 8,
        padding: 12,
        marginTop: 8,
        marginBottom: 8,
        outline: 'none',
        resize: 'vertical',
      }}
      spellCheck={false}
      placeholder="Scrivi qui lo script di validazione (JavaScript semplice)..."
    />
  );
};

export default ConstraintMonacoEditor; 