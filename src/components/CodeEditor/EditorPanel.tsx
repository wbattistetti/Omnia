import React from 'react';
import MonacoEditor from 'react-monaco-editor';
import 'monaco-editor/min/vs/editor/editor.main.css';
import 'monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution';
import 'monaco-editor/esm/vs/language/typescript/monaco.contribution';

export default function EditorPanel({ code, onChange, fontSize = 13 }: { code: any; onChange: (s: string) => void; fontSize?: number }) {
  const safeCode: string = typeof code === 'string' ? code : (code == null ? '' : (() => { try { return JSON.stringify(code, null, 2); } catch { return String(code); } })());
  return (
    <div className="w-full h-full border border-slate-700 rounded">
      <MonacoEditor
        language="javascript"
        theme="vs-dark"
        value={safeCode}
        onChange={(v: string) => onChange(v || '')}
        options={{
          minimap: { enabled: false },
          automaticLayout: true,
          fontSize,
          wordWrap: 'on',
          scrollBeyondLastLine: false,
          fontLigatures: true,
        }}
        editorDidMount={(editor: any, monaco: any) => {
          try {
            // Custom high-contrast dark theme with vivid keywords
            monaco.editor.defineTheme('omnia-contrast', {
              base: 'vs-dark',
              inherit: true,
              rules: [
                { token: 'keyword', foreground: '7DD3FC', fontStyle: 'bold' }, // sky-300
                { token: 'type', foreground: 'A78BFA' }, // violet-400
                { token: 'number', foreground: 'FCA5A5' }, // red-300
                { token: 'string', foreground: '86EFAC' }, // green-300
                { token: 'comment', foreground: '94A3B8', fontStyle: 'italic' }, // slate-400
                { token: 'delimiter', foreground: 'E5E7EB' },
                { token: 'identifier', foreground: 'EAB308' }, // amber-500 for vars
              ],
              colors: {
                'editor.background': '#0B1220',
                'editor.foreground': '#E5E7EB',
                'editor.lineHighlightBackground': '#1F293733',
                'editorCursor.foreground': '#38BDF8',
                'editor.selectionBackground': '#2563EB55',
                'editorLineNumber.foreground': '#64748B',
                'editorLineNumber.activeForeground': '#E2E8F0',
                'editorIndentGuide.background': '#334155',
                'editorIndentGuide.activeBackground': '#475569',
                'editorBracketMatch.border': '#38BDF8',
              },
            });
            // Use Monaco built-in high-contrast theme to avoid any external CSS overrides
            monaco.editor.setTheme('hc-black');
            monaco.languages.typescript.javascriptDefaults.setEagerModelSync(true);
            editor.updateOptions({ renderLineHighlight: 'all', bracketPairColorization: { enabled: true } });
          } catch {}
        }}
        height="100%"
      />
    </div>
  );
}



