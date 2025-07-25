import React from 'react';
import MonacoEditor from 'react-monaco-editor';
// Se Monaco non è installato, mostra un placeholder
// In produzione, importa: import MonacoEditor from 'react-monaco-editor';

interface ConstraintMonacoEditorProps {
  script: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

const ConstraintMonacoEditor: React.FC<ConstraintMonacoEditorProps> = ({ script, onChange, readOnly }) => {
  return (
    <MonacoEditor
      width="100%"
      height="120"
      language="javascript"
      theme="vs-dark"
      value={script}
      options={{
        readOnly: !!readOnly,
        minimap: { enabled: false },
        fontSize: 15,
        fontFamily: 'Fira Mono, Menlo, monospace',
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        automaticLayout: true,
        scrollbar: { vertical: 'auto', horizontal: 'auto' },
        overviewRulerLanes: 0,
        renderLineHighlight: 'all',
        fixedOverflowWidgets: true,
        tabSize: 2
      }}
      onChange={onChange}
    />
  );
};

export default ConstraintMonacoEditor; 