import React from 'react';
import MonacoEditor from 'react-monaco-editor';
import * as monaco from 'monaco-editor';
import { setMonacoMarkers } from '../../utils/monacoMarkers';
// Se Monaco non è installato, mostra un placeholder
// In produzione, importa: import MonacoEditor from 'react-monaco-editor';

interface ConstraintMonacoEditorProps {
  script: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  markers?: monaco.editor.IMarkerData[];
}

const ConstraintMonacoEditor: React.FC<ConstraintMonacoEditorProps> = ({ script, onChange, readOnly, markers }) => {
  function handleEditorDidMount(editor: any, monacoInstance: typeof monaco) {
    if (markers && markers.length > 0) {
      setMonacoMarkers(editor, monacoInstance, markers);
    }
  }
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
      editorDidMount={handleEditorDidMount}
    />
  );
};

export default ConstraintMonacoEditor; 