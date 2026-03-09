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
  const autoInsertMenuTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isFormattingRef = useRef<boolean>(false); // Prevent recursive formatting
  const contextMenuOpenRef = useRef<boolean>(false); // Track menu state in ref for closures

  // Sync ref with state
  useEffect(() => {
    contextMenuOpenRef.current = contextMenuOpen;
  }, [contextMenuOpen]);

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

        // Helper: Check if cursor is inside a string
        const isInsideString = (model: monacoNS.editor.ITextModel, position: monacoNS.Position): boolean => {
          try {
            const tokens = model.getLineTokens(position.lineNumber);
            const tokenIndex = tokens.findTokenIndexAtOffset(position.column - 1);
            if (tokenIndex >= 0) {
              const token = tokens.getToken(tokenIndex);
              return token?.type === 'string' || token?.type?.includes('string');
            }
          } catch (e) {
            // Fallback: check if position is between quotes
            const line = model.getLineContent(position.lineNumber);
            const before = line.substring(0, position.column - 1);
            const after = line.substring(position.column - 1);
            const quoteCountBefore = (before.match(/"/g) || []).length;
            const quoteCountAfter = (after.match(/"/g) || []).length;
            // If odd number of quotes before, we're inside a string
            return quoteCountBefore % 2 === 1;
          }
          return false;
        };

        // Helper: Auto-format operators (=, <>, >=, <=)
        const autoFormatOperator = (model: monacoNS.editor.ITextModel, position: monacoNS.Position): boolean => {
          if (isFormattingRef.current) return false; // Prevent recursion
          if (isInsideString(model, position)) return false; // Don't format inside strings

          const line = model.getLineContent(position.lineNumber);
          const before = line.substring(0, position.column - 1);

          // Check if operator is already formatted (has spaces around it)
          if (/\s=\s$|\s<>\s$|\s>=\s$|\s<=\s$/.test(before)) {
            return false; // Already formatted
          }

          // Check for operators that need formatting (at the end of before, user just typed them)
          let operatorStart = -1;
          let operatorLength = 0;
          let replacement = '';

          // Check for = (but not if part of <=, >=, <>)
          if (before.endsWith('=') && !before.endsWith('<>') && !before.endsWith('>=') && !before.endsWith('<=')) {
            operatorStart = before.length - 1;
            operatorLength = 1;
            replacement = ' = ';
          }
          // Check for <> (must check before =)
          else if (before.endsWith('<>')) {
            operatorStart = before.length - 2;
            operatorLength = 2;
            replacement = ' <> ';
          }
          // Check for >=
          else if (before.endsWith('>=')) {
            operatorStart = before.length - 2;
            operatorLength = 2;
            replacement = ' >= ';
          }
          // Check for <=
          else if (before.endsWith('<=')) {
            operatorStart = before.length - 2;
            operatorLength = 2;
            replacement = ' <= ';
          }

          if (operatorStart >= 0) {
            isFormattingRef.current = true;

            const range = new monaco.Range(
              position.lineNumber,
              operatorStart + 1,
              position.lineNumber,
              operatorStart + operatorLength + 1
            );

            editor.executeEdits('format-operator', [
              {
                range,
                text: replacement,
              },
            ]);

            // Move cursor after the formatted operator
            const newColumn = operatorStart + replacement.length + 1;
            setTimeout(() => {
              editor.setPosition({
                lineNumber: position.lineNumber,
                column: newColumn,
              });
              isFormattingRef.current = false;
            }, 0);

            return true;
          }

          return false;
        };

        // Handle content changes with debounce
        editor.onDidChangeModelContent((e) => {
          if (isFormattingRef.current) {
            // Skip processing if we're in the middle of auto-formatting
            return;
          }

          const model = editor.getModel();
          const position = editor.getPosition();
          if (!model || !position) return;

          const newValue = editor.getValue();
          onChange(newValue);

          // Auto-format operators
          const wasFormatted = autoFormatOperator(model, position);
          if (wasFormatted) {
            // After formatting, re-check position for menu trigger
            setTimeout(() => {
              const newPos = editor.getPosition();
              if (newPos) {
                checkAndShowInsertMenu(editor, model, newPos);
              }
            }, 10);
          } else {
            // Check for menu triggers
            checkAndShowInsertMenu(editor, model, position);
          }

          // Clear previous timeout
          if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
          }

          // Debounce parsing (200ms)
          debounceTimeoutRef.current = setTimeout(() => {
            parseAndValidate(newValue);
          }, 200);
        });

        // Helper: Check if we should show Insert menu and show it
        const checkAndShowInsertMenu = (
          editor: monacoNS.editor.IStandaloneCodeEditor,
          model: monacoNS.editor.ITextModel,
          position: monacoNS.Position
        ) => {
          // Don't show if menu is already open
          if (contextMenuOpenRef.current) return;

          // Don't show if inside string
          if (isInsideString(model, position)) {
            // Close menu if open
            if (contextMenuOpenRef.current) {
              setContextMenuOpen(false);
              setContextMenuPosition(null);
            }
            return;
          }

          const line = model.getLineContent(position.lineNumber);
          const before = line.substring(0, position.column - 1);

          // Check if we just typed a trigger pattern
          const triggers = [
            /AND\s+$/,  // "AND " at end
            /OR\s+$/,   // "OR " at end
            /NOT\s+$/,  // "NOT " at end
            /\($/,      // "(" at end
            /\s=\s$/,   // " = " at end (after formatting)
            /\s<>\s$/,  // " <> " at end (after formatting)
            /\s>=\s$/,  // " >= " at end (after formatting)
            /\s<=\s$/,  // " <= " at end (after formatting)
          ];

          const shouldShowMenu = triggers.some(regex => regex.test(before));

          if (shouldShowMenu) {
            // Clear any existing timeout
            if (autoInsertMenuTimeoutRef.current) {
              clearTimeout(autoInsertMenuTimeoutRef.current);
            }

            // Show menu after a short delay (to avoid showing on every keystroke)
            autoInsertMenuTimeoutRef.current = setTimeout(() => {
              // Double-check menu is still not open
              if (contextMenuOpenRef.current) return;

              // Get cursor position in pixels for menu placement
              const coords = editor.getScrolledVisiblePosition(position);
              if (coords) {
                const domNode = editor.getDomNode();
                if (domNode) {
                  const rect = domNode.getBoundingClientRect();
                  setContextMenuPosition({
                    x: rect.left + coords.left,
                    y: rect.top + coords.top + 20, // Below cursor
                  });
                  setContextMenuOpen(true);
                }
              }
            }, 300); // Small delay to avoid flickering
          } else {
            // Close menu if user typed something invalid
            if (contextMenuOpenRef.current) {
              // Check if user typed a non-whitespace character after trigger
              const invalidAfterTrigger = /(AND|OR|NOT|\(|\s=\s|\s<>\s|\s>=\s|\s<=\s)\s*[A-Za-z0-9_\[\]"]/.test(before);
              if (invalidAfterTrigger) {
                setContextMenuOpen(false);
                setContextMenuPosition(null);
              }
            }
          }
        };

        // Handle ESC key to close menu
        editor.onKeyDown((e: any) => {
          if (e.keyCode === monaco.KeyCode.Escape) {
            if (contextMenuOpen) {
              setContextMenuOpen(false);
              setContextMenuPosition(null);
              e.preventDefault();
              e.stopPropagation();
            }
          }
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
      if (autoInsertMenuTimeoutRef.current) {
        clearTimeout(autoInsertMenuTimeoutRef.current);
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

    let insertRange: any;
    if (selection) {
      insertRange = selection;
    } else {
      // Insert at cursor
      const position = editor.getPosition();
      if (position) {
        insertRange = {
          startLineNumber: position.lineNumber,
          startColumn: position.column,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        };
      } else {
        return; // No valid position
      }
    }

    // Execute edit to insert text
    editor.executeEdits('insert', [
      {
        range: insertRange,
        text: text,
      },
    ]);

    // Focus editor and position cursor after inserted text
    editor.focus();

    // Calculate new cursor position (after inserted text)
    const newLineNumber = insertRange.startLineNumber;
    const newColumn = insertRange.startColumn + text.length;

    // Set cursor position after inserted text
    editor.setPosition({ lineNumber: newLineNumber, column: newColumn });

    // Ensure cursor is visible
    editor.revealPosition({ lineNumber: newLineNumber, column: newColumn });

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
