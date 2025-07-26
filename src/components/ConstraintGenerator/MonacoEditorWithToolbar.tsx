import React, { useRef, useEffect } from 'react';
import { MonacoEditorWithToolbarProps, LanguageKey } from './types';
import MonacoEditor from 'react-monaco-editor';
import { ThumbsUp, ThumbsDown, Bot, Eye, EyeOff } from 'lucide-react';
import jsIcon from './icons/js.svg';
import pythonIcon from './icons/python.svg';
import tsIcon from './icons/ts.svg';
import { LANGUAGES } from './constants';
import * as monaco from 'monaco-editor';
import MonacoToolbar from './MonacoToolbar';
import PanelHeader from './PanelHeader';

const LANGUAGE_ICONS: Record<string, React.ReactNode> = {
  js: <img src={jsIcon} alt="JS" width={20} height={20} />,
  py: <img src={pythonIcon} alt="Python" width={20} height={20} />,
  ts: <img src={tsIcon} alt="TS" width={20} height={20} />,
};

function filterComments(code: string, lang: string, show: boolean) {
  if (show) return code;
  if (lang === 'py') {
    return code.split('\n').filter(line => !line.trim().startsWith('#')).join('\n');
  }
  // JS/TS: rimuovi // e /* ... */
  return code.split('\n').filter(line => !line.trim().startsWith('//')).join('\n');
}

const MonacoEditorWithToolbar: React.FC<MonacoEditorWithToolbarProps & { panelHeight: number; onPanelHeightChange: (h: number) => void }> = ({
  scriptsByLanguage,
  summary,
  currentLanguage,
  onLanguageChange,
  showComments,
  onToggleComments,
  onAIClick,
  panelHeight,
  onPanelHeightChange
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  // Define custom Monaco theme for better highlighting
  useEffect(() => {
    monaco.editor.defineTheme('custom-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'keyword', foreground: 'C586C0', fontStyle: 'bold' },
        { token: 'identifier', foreground: '9CDCFE' },
        { token: 'type.identifier', foreground: '4EC9B0' },
        { token: 'number', foreground: 'B5CEA8' },
        { token: 'string', foreground: 'CE9178' },
        { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
        { token: 'variable', foreground: '9CDCFE' },
        { token: 'function', foreground: 'DCDCAA' },
        { token: 'delimiter', foreground: 'D4D4D4' },
      ],
      colors: {
        'editor.foreground': '#D4D4D4',
        'editor.background': '#18181b',
        'editorLineNumber.foreground': '#858585',
        'editorCursor.foreground': '#A7A7A7',
        'editor.selectionBackground': '#264F78',
        'editor.inactiveSelectionBackground': '#3A3D41',
        'editorIndentGuide.background': '#404040',
        'editorIndentGuide.activeBackground': '#707070',
      },
    });
  }, []);
  // ResizeObserver per aggiornare panelHeight solo su vero resize
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const observer = new window.ResizeObserver(entries => {
      for (let entry of entries) {
        if (entry.target === el) {
          const newHeight = entry.contentRect.height;
          onPanelHeightChange(newHeight);
        }
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [onPanelHeightChange]);
  const code = (scriptsByLanguage && scriptsByLanguage[currentLanguage]) || '';
  const filteredCode = filterComments(code, currentLanguage, showComments);
  return (
    <div
      ref={panelRef}
      style={{
        background: '#18181b',
        border: '1.5px solid #a21caf',
        borderRadius: 8,
        padding: 0,
        marginBottom: 16,
        resize: 'vertical',
        overflow: 'auto',
        minHeight: 140,
        maxHeight: 900,
        height: panelHeight,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <PanelHeader color={'rgba(162,28,175,0.85)'} style={{ borderBottom: '1px solid #a21caf' }}>
        Script di validazione
      </PanelHeader>
      {/* Toolbar */}
      <MonacoToolbar
        currentLanguage={currentLanguage}
        onLanguageChange={(lang: string) => onLanguageChange(lang as LanguageKey)}
        showComments={showComments}
        onToggleComments={onToggleComments}
        onAIClick={onAIClick}
      />
      {/* Summary */}
      {summary && (
        <div style={{ color: '#fbbf24', fontSize: 15, padding: '8px 16px', borderBottom: '1px solid #a21caf', background: '#23232b' }}>{summary}</div>
      )}
      {/* Monaco Editor */}
      <div style={{ padding: 8, flex: 1, minHeight: 0 }}>
        {filteredCode ? (
          <MonacoEditor
            width="100%"
            height={panelHeight - 90} // lascia spazio per header+toolbar+summary
            language={currentLanguage === 'py' ? 'python' : currentLanguage === 'ts' ? 'typescript' : 'javascript'}
            theme="custom-dark"
            value={filteredCode}
            options={{
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
          />
        ) : (
          <div style={{ color: '#888', fontStyle: 'italic', padding: 24, textAlign: 'center' }}>
            Nessuno script generato per questo linguaggio.
          </div>
        )}
      </div>
    </div>
  );
};

export default MonacoEditorWithToolbar; 