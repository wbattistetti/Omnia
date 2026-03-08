// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as monacoNS from 'monaco-editor';
import { registerDslLanguage } from './registerDslLanguage';
import { registerDSLIntellisense, disposeDSLIntellisense } from './DSLIntellisense';
import { DSLParser } from '../parser/DSLParser';
import { InsertMenu } from '../menu/InsertMenu';
import { DSLContextMenu } from '../menu/DSLContextMenu';
import { Plus } from 'lucide-react';

interface DSLEditorProps {
  value: string;
  onChange: (value: string) => void;
  onCompile?: (dsl: string, jsCode: string, errors: any[]) => void;
  variables?: Record<string, any>;
  variablesTree?: any[];
  fontSize?: number;
}

export function DSLEditor({
  value,
  onChange,
  onCompile,
  variables = {},
  variablesTree,
  fontSize = 13,
}: DSLEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const monacoEditorRef = useRef<monacoNS.editor.IStandaloneCodeEditor | null>(null);
  const monacoInstanceRef = useRef<typeof monacoNS | null>(null);
  const [showInsertMenu, setShowInsertMenu] = useState(false);
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [parseErrors, setParseErrors] = useState<any[]>([]);
  const parserRef = useRef<DSLParser>(new DSLParser());
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastParsedValueRef = useRef<string>('');

  // Initialize Monaco
  useEffect(() => {
    if (!editorRef.current) return;

    const initializeMonaco = async () => {
      try {
        const monaco = (window as any).monaco || monacoNS;
        if (!monaco) {
          console.error('[DSLEditor] Monaco not available');
          return;
        }

        monacoInstanceRef.current = monaco;

        // Register DSL language
        registerDslLanguage(monaco);

        // Register intellisense
        registerDSLIntellisense(monaco, variables, variablesTree);

        // Create editor
        const editor = monaco.editor.create(editorRef.current, {
          value: value || '',
          language: 'dsl-condition',
          theme: 'dsl-condition-theme',
          fontSize: fontSize,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          wordWrap: 'on',
          lineNumbers: 'on',
          renderWhitespace: 'selection',
          contextmenu: false, // Disable Monaco's default context menu
        });

        monacoEditorRef.current = editor;

        // Handle content changes with debounce
        editor.onDidChangeModelContent(() => {
          const newValue = editor.getValue();
          onChange(newValue);

          // Clear previous timeout
          if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
          }

          // Debounce parsing (200ms)
          debounceTimeoutRef.current = setTimeout(() => {
            parseAndValidate(newValue);
          }, 200);
        });

        // ✅ SOLUTION: Block browser context menu in capture phase
        // This MUST be done on the DOM node directly, BEFORE Monaco handles it
        const dom = editor.getDomNode();
        if (dom) {
          // Simple handler that ONLY blocks the browser menu
          const blockBrowserContextMenu = (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            return false;
          };

          // Register in capture phase to intercept BEFORE browser
          dom.addEventListener('contextmenu', blockBrowserContextMenu, { capture: true });

          // ✅ SOLUTION: Use Monaco's onMouseDown to detect right-click and show custom menu
          editor.onMouseDown((e: any) => {
            if (e.target && e.event.rightButton) {
              // Right mouse button clicked
              e.event.preventDefault();
              e.event.stopPropagation();

              const pos = editor.getPosition();
              if (pos) {
                setContextMenuPosition({
                  x: e.event.browserEvent.clientX,
                  y: e.event.browserEvent.clientY
                });
                setContextMenuOpen(true);
              }
            }
          });

          // Cleanup
          editor.onDidDispose(() => {
            dom.removeEventListener('contextmenu', blockBrowserContextMenu, { capture: true });
          });
        }

        // Initial parse
        if (value) {
          parseAndValidate(value);
        }
      } catch (error) {
        console.error('[DSLEditor] Error initializing Monaco', error);
      }
    };

    initializeMonaco();

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      if (monacoEditorRef.current) {
        monacoEditorRef.current.dispose();
      }
      // Dispose intellisense provider on unmount
      disposeDSLIntellisense();
    };
  }, []); // Only run once on mount

  // Update value when prop changes
  useEffect(() => {
    if (monacoEditorRef.current && value !== lastParsedValueRef.current) {
      const editor = monacoEditorRef.current;
      const currentValue = editor.getValue();
      if (currentValue !== value) {
        editor.setValue(value || '');
        parseAndValidate(value);
      }
    }
  }, [value]);

  // Update font size
  useEffect(() => {
    if (monacoEditorRef.current) {
      monacoEditorRef.current.updateOptions({ fontSize });
    }
  }, [fontSize]);

  // Parse and validate DSL
  const parseAndValidate = useCallback((dsl: string) => {
    if (!dsl || !dsl.trim()) {
      setParseErrors([]);
      clearMonacoMarkers();
      return;
    }

    const parser = parserRef.current;
    const result = parser.parse(dsl);

    setParseErrors(result.errors);

    // Update Monaco markers
    updateMonacoMarkers(result.errors);

    // Notify compilation if valid
    if (result.ast && result.errors.length === 0 && onCompile) {
      // Compile would be done by ScriptManagerService, but we can notify here
      // The actual compilation happens in ScriptManagerService.saveScript
    }

    lastParsedValueRef.current = dsl;
  }, [onCompile]);

  // Update Monaco error markers
  const updateMonacoMarkers = (errors: any[]) => {
    if (!monacoEditorRef.current || !monacoInstanceRef.current) return;

    const monaco = monacoInstanceRef.current;
    const model = monacoEditorRef.current.getModel();
    if (!model) return;

    const markers = errors.map((error) => ({
      startLineNumber: error.position.line,
      startColumn: error.position.column,
      endLineNumber: error.position.line,
      endColumn: error.position.column + 10, // Approximate end
      message: error.message,
      severity: monaco.MarkerSeverity.Error,
    }));

    monaco.editor.setModelMarkers(model, 'dsl-parser', markers);
  };

  // Clear Monaco markers
  const clearMonacoMarkers = () => {
    if (!monacoEditorRef.current || !monacoInstanceRef.current) return;

    const monaco = monacoInstanceRef.current;
    const model = monacoEditorRef.current.getModel();
    if (!model) return;

    monaco.editor.setModelMarkers(model, 'dsl-parser', []);
  };

  // Handle insert from menu
  const handleInsert = (text: string) => {
    if (!monacoEditorRef.current) return;

    const editor = monacoEditorRef.current;
    const selection = editor.getSelection();
    if (selection) {
      editor.executeEdits('insert', [
        {
          range: selection,
          text: text,
        },
      ]);
    } else {
      // Insert at cursor
      const position = editor.getPosition();
      if (position) {
        editor.executeEdits('insert', [
          {
            range: {
              startLineNumber: position.lineNumber,
              startColumn: position.column,
              endLineNumber: position.lineNumber,
              endColumn: position.column,
            },
            text: text,
          },
        ]);
      }
    }

    setShowInsertMenu(false);
    setContextMenuOpen(false);
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-gray-900">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">DSL Editor</span>
          {parseErrors.length > 0 && (
            <span className="text-xs text-red-400">
              {parseErrors.length} error{parseErrors.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="relative">
          <button
            className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 rounded"
            onClick={() => setShowInsertMenu(!showInsertMenu)}
            title="Insert variable, function, or constant"
          >
            <Plus size={14} />
            Insert
          </button>
          {showInsertMenu && (
            <InsertMenu
              variables={variables}
              variablesTree={variablesTree}
              onInsert={handleInsert}
              onClose={() => setShowInsertMenu(false)}
            />
          )}
        </div>
      </div>

      {/* Editor */}
      <div ref={editorRef} className="flex-1 min-h-0" />

      {/* Context Menu (right-click) */}
      {contextMenuOpen && contextMenuPosition && monacoEditorRef.current && monacoInstanceRef.current && (
        <DSLContextMenu
          position={contextMenuPosition}
          variables={variables}
          variablesTree={variablesTree}
          onInsert={handleInsert}
          onClose={() => {
            setContextMenuOpen(false);
            setContextMenuPosition(null);
          }}
          editor={monacoEditorRef.current}
          monaco={monacoInstanceRef.current}
        />
      )}

      {/* Error panel */}
      {parseErrors.length > 0 && (
        <div className="px-3 py-2 bg-red-900/20 border-t border-red-700/50 max-h-32 overflow-auto">
          {parseErrors.map((error, idx) => (
            <div key={idx} className="text-xs text-red-300 mb-1">
              Line {error.position.line}, Col {error.position.column}: {error.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
