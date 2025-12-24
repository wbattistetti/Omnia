import React from 'react';
import MonacoEditor from 'react-monaco-editor';
import 'monaco-editor/min/vs/editor/editor.main.css';
import 'monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution';
import 'monaco-editor/esm/vs/language/typescript/monaco.contribution';
import 'monaco-editor/esm/vs/editor/contrib/suggest/browser/suggestController.js';
import 'monaco-editor/esm/vs/editor/contrib/snippet/browser/snippetController2.js';
import { useFontContext } from '../../context/FontContext';
import { VariablesTreeMenu } from './VariablesTreeMenu';

const TEMPLATE = `// Describe below, in detail, when the condition should be TRUE.
// You can write pseudo-code or a plain natural-language description.
// Right-click to view and insert the available variables the code must use.
//
// Example of pseudo-code for the condition "USER MUST BE ADULT"
// PSEUDO-CODE:
// Now - vars["Agent asks for user's name.DateOfBirth"] > 18 years
`;

export interface CustomLanguage {
  id: string;
  tokenizer: any;
  theme?: {
    base?: string;
    inherit?: boolean;
    rules?: Array<{ token: string; foreground?: string; fontStyle?: string }>;
    colors?: Record<string, string>;
  };
  themeName?: string; // Name of the theme to apply (defaults to id + 'Theme')
}

interface EditorPanelProps {
  code: any;
  onChange: (s: string) => void;
  fontSize?: number;
  varKeys?: string[];
  language?: string;
  customLanguage?: CustomLanguage;
  useTemplate?: boolean; // Whether to inject template for empty code (default: true for conditions)
  onEditorMount?: (editor: any) => void; // ✅ Callback quando l'editor è montato
}

const EditorPanel = React.forwardRef<{ format: () => void }, EditorPanelProps>(({ code, onChange, fontSize: propFontSize, varKeys = [], language = 'javascript', customLanguage, useTemplate = true, onEditorMount }, ref) => {
  // Use font from Context if available, otherwise fallback to prop
  let fontSize: number;
  try {
    const { fontSize: contextFontSize } = useFontContext();
    // Convert fontSize from 'xs' | 'sm' | 'base' | 'md' | 'lg' to pixels
    const fontSizeMap: Record<string, number> = {
      xs: 11,
      sm: 12,
      base: 13,
      md: 14,
      lg: 15,
    };
    fontSize = fontSizeMap[contextFontSize] || propFontSize || 13;
  } catch {
    // Not within FontProvider, use prop or default
    fontSize = propFontSize || 13;
  }

  const safeCode: string = typeof code === 'string' ? code : (code == null ? '' : (() => { try { return JSON.stringify(code, null, 2); } catch { return String(code); } })());
  // If customLanguage is provided, use its id. Otherwise use language prop (or 'javascript' as fallback)
  const editorLanguage = customLanguage ? customLanguage.id : (language || 'javascript');
  const editorTheme = customLanguage?.themeName || `${customLanguage?.id || ''}Theme` || 'vs-dark';

  // Store refs to editor and monaco for useEffect
  const editorRef = React.useRef<any>(null);
  const monacoRef = React.useRef<any>(null);

  // Expose format method via ref
  React.useImperativeHandle(ref, () => ({
    format: () => {
      try {
        const editor = editorRef.current;
        const monaco = monacoRef.current;
        if (!editor || !monaco) {
          console.warn('[EditorPanel] Format failed: editor or monaco not ready');
          return;
        }
        const model = editor.getModel();
        if (!model) {
          console.warn('[EditorPanel] Format failed: model not ready');
          return;
        }
        // Use Monaco's format document action (most reliable)
        const formatAction = editor.getAction('editor.action.formatDocument');
        if (formatAction && formatAction.isSupported()) {
          formatAction.run();
        } else {
          // Fallback: try async formatting using Monaco's formatting provider
          const language = model.getLanguageId();
          if (language === 'javascript' || language === 'typescript') {
            // Monaco's formatting is async, so we need to use the provider
            const provider = monaco.languages.getDocumentFormattingEditProvider(language);
            if (provider) {
              Promise.resolve(provider.provideDocumentFormattingEdits(
                model,
                { insertSpaces: true, tabSize: 2 },
                { insertSpaces: true, tabSize: 2 }
              )).then((edits) => {
                if (edits && edits.length > 0) {
                  editor.executeEdits('format', edits);
                }
              }).catch((e) => {
                console.warn('[EditorPanel] Async format failed:', e);
              });
            } else {
              // Last resort: retry action after delay
              setTimeout(() => {
                try {
                  const retryAction = editor.getAction('editor.action.formatDocument');
                  if (retryAction) retryAction.run();
                } catch { }
              }, 100);
            }
          }
        }
      } catch (e) {
        console.warn('[EditorPanel] Format failed:', e);
      }
    }
  }), []);

  // ✅ State for variables tree menu
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [menuPosition, setMenuPosition] = React.useState({ x: 0, y: 0 });

  // CRITICAL: Pre-register custom language BEFORE MonacoEditor renders
  // This ensures the tokenizer is available when Monaco loads the initial content
  React.useEffect(() => {
    if (!customLanguage || typeof window === 'undefined') {
      return;
    }

    // Wait for Monaco to be available (react-monaco-editor loads it globally)
    let retryCount = 0;
    const maxRetries = 20; // 20 * 50ms = 1 second max wait

    const checkMonaco = () => {
      const monaco = (window as any).monaco;

      if (!monaco || !monaco.languages) {
        retryCount++;
        if (retryCount < maxRetries) {
          setTimeout(checkMonaco, 50);
        }
        return;
      }

      try {
        const langId = customLanguage.id;
        const existingLanguages = monaco.languages.getLanguages();
        const isRegistered = existingLanguages.some((l: any) => l.id === langId);

        if (!isRegistered) {
          monaco.languages.register({ id: langId });
        }

        // Register tokenizer
        const tokenizerConfig = {
          tokenizer: customLanguage.tokenizer
        };
        monaco.languages.setMonarchTokensProvider(langId, tokenizerConfig);

        // Define theme
        if (customLanguage.theme) {
          const themeName = customLanguage.themeName || `${langId}Theme`;
          monaco.editor.defineTheme(themeName, {
            base: customLanguage.theme.base || 'vs-dark',
            inherit: customLanguage.theme.inherit !== false,
            rules: customLanguage.theme.rules || [],
            colors: customLanguage.theme.colors || {},
          });
        }
      } catch (err) {
        console.error('[EditorPanel] ❌ Failed to pre-register language:', err);
      }
    };

    // Start checking immediately
    checkMonaco();
  }, [customLanguage?.id]); // Only run when language ID changes

  // Force tokenization whenever code/content changes (for custom languages)
  React.useEffect(() => {
    if (!customLanguage || !editorRef.current || !monacoRef.current) return;

    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const langId = customLanguage.id;
    const model = editor?.getModel();

    if (!model) return;

    // Force language update
    monaco.editor.setModelLanguage(model, langId);

    // Force tokenization by triggering a model change
    const currentValue = model.getValue();
    if (currentValue && currentValue.trim().length > 0) {
      // Use multiple strategies to ensure tokenization
      const forceTokenization = () => {
        try {
          // Strategy 1: Force model update
          const fullRange = model.getFullModelRange();
          model.pushEditOperations(
            [],
            [{
              range: fullRange,
              text: currentValue
            }],
            () => null
          );

          // Strategy 2: Force render
          editor.render(true);

          // Strategy 3: Trigger tokenization via deltaDecorations
          editor.deltaDecorations([], []);

          console.log('[EditorPanel] 🔄 Forced re-tokenization on content change');
        } catch (e) {
          console.warn('[EditorPanel] ⚠️ Error in useEffect tokenization:', e);
        }
      };

      // Execute immediately
      requestAnimationFrame(() => {
        requestAnimationFrame(forceTokenization);
      });
    }
  }, [safeCode, customLanguage?.id]); // Re-run when content or language changes

  return (
    <div className="w-full h-full">
      <MonacoEditor
        language={editorLanguage}
        theme={editorTheme}
        value={safeCode}
        onChange={(v: string) => onChange(v || '')}
        options={{
          minimap: { enabled: false },
          automaticLayout: true,
          fontSize,
          wordWrap: 'on',
          scrollBeyondLastLine: false,
          fontLigatures: true,
          contextmenu: false,
          folding: true,
          showFoldingControls: 'always',
          quickSuggestions: false, // ✅ Disabilita suggerimenti automatici predefiniti
          suggestOnTriggerCharacters: true, // ✅ Mantieni solo i nostri trigger characters per variabili OMNIA
          // ✅ Disabilita i suggerimenti predefiniti di JavaScript/TypeScript
          wordBasedSuggestions: false,
          wordBasedSuggestionsOnlySameLanguage: false,
          // Formatting options
          formatOnPaste: false,
          formatOnType: false,
          tabSize: 2,
          insertSpaces: true,
        }}
        editorDidMount={(editor: any, monaco: any) => {
          // Store refs for useEffect
          editorRef.current = editor;
          monacoRef.current = monaco;

          // ✅ Chiama callback se fornita
          if (onEditorMount) {
            onEditorMount(editor);
          }

          try {
            // z-index for Monaco widgets
            try {
              if (!document.querySelector('style[data-omnia="monaco-suggest-z"]')) {
                const style = document.createElement('style');
                style.setAttribute('data-omnia', 'monaco-suggest-z');
                style.textContent = `.monaco-editor .suggest-widget{z-index:99999 !important}.monaco-editor .context-view{z-index:99999 !important}`;
                document.head.appendChild(style);
              }
            } catch { }


            // Register custom language FIRST, before anything else

            if (customLanguage) {
              try {
                const langId = customLanguage.id;
                const existingLanguages = monaco.languages.getLanguages();
                const isRegistered = existingLanguages.some((l: any) => l.id === langId);

                if (!isRegistered) {
                  monaco.languages.register({ id: langId });
                }

                // Monaco expects: { tokenizer: { root: [...] } }
                // customLanguage.tokenizer already has { root: [...] }, so we wrap it in { tokenizer: ... }
                const tokenizerConfig = {
                  tokenizer: customLanguage.tokenizer
                };

                monaco.languages.setMonarchTokensProvider(langId, tokenizerConfig);

                // Define custom theme if provided
                if (customLanguage.theme) {
                  const themeName = customLanguage.themeName || `${langId}Theme`;
                  monaco.editor.defineTheme(themeName, {
                    base: customLanguage.theme.base || 'vs-dark',
                    inherit: customLanguage.theme.inherit !== false,
                    rules: customLanguage.theme.rules || [],
                    colors: customLanguage.theme.colors || {},
                  });
                  // Apply theme immediately
                  monaco.editor.setTheme(themeName);
                  editor.updateOptions({ theme: themeName });
                }

                // CRITICAL: Get model and set language BEFORE tokenization
                const model = editor.getModel();

                if (model) {
                  // Set language IMMEDIATELY
                  monaco.editor.setModelLanguage(model, langId);

                  // Get current content
                  const currentValue = model.getValue();

                  // AGGRESSIVE: Force tokenization multiple times with different strategies
                  const forceTokenizationAggressively = (attempt: number) => {
                    if (!model) return;

                    try {
                      // Always force language update
                      monaco.editor.setModelLanguage(model, langId);

                      if (currentValue && currentValue.trim().length > 0) {
                        // Strategy 1: Clear and reset content to force full tokenization
                        const savedValue = currentValue;
                        model.setValue('');

                        // Use setTimeout(0) to ensure Monaco processes the clear
                        setTimeout(() => {
                          if (model) {
                            model.setValue(savedValue);
                            monaco.editor.setModelLanguage(model, langId);

                            // Strategy 2: Force edit operation
                            setTimeout(() => {
                              if (model) {
                                const fullRange = model.getFullModelRange();
                                model.pushEditOperations(
                                  [],
                                  [{
                                    range: fullRange,
                                    text: savedValue
                                  }],
                                  () => null
                                );

                                // Strategy 3: Force multiple renders
                                editor.render(true);
                                editor.deltaDecorations([], []);
                                editor.render(true);
                              }
                            }, 5);
                          }
                        }, 5);
                      } else {
                        // Even for empty content, ensure language is set
                        monaco.editor.setModelLanguage(model, langId);
                        editor.render(true);
                      }
                    } catch (e) {
                      console.error(`[EditorPanel] ❌ Error in aggressive tokenization attempt ${attempt}:`, e);
                    }
                  };

                  // Execute IMMEDIATELY and MULTIPLE TIMES to ensure it works
                  forceTokenizationAggressively(1);

                  // Backup executions
                  setTimeout(() => forceTokenizationAggressively(2), 10);
                  setTimeout(() => forceTokenizationAggressively(3), 50);
                  setTimeout(() => forceTokenizationAggressively(4), 100);
                  setTimeout(() => forceTokenizationAggressively(5), 200);
                }
              } catch (err) {
                console.error('[EditorPanel] Failed to register custom language:', err);
              }
            } else {
              // Default theme tweaks (only for non-custom languages)
              monaco.editor.defineTheme('omnia-contrast', {
                base: 'vs-dark', inherit: true,
                rules: [
                  { token: 'keyword', foreground: '7DD3FC', fontStyle: 'bold' },
                  { token: 'type', foreground: 'A78BFA' },
                  { token: 'number', foreground: 'FCA5A5' },
                  { token: 'string', foreground: '86EFAC' },
                  { token: 'comment', foreground: '94A3B8', fontStyle: 'italic' },
                  { token: 'delimiter', foreground: 'E5E7EB' },
                  { token: 'identifier', foreground: 'EAB308' },
                ],
                colors: {
                  'editor.background': '#0B1220', 'editor.foreground': '#E5E7EB',
                  'editor.lineHighlightBackground': '#1F293733', 'editorCursor.foreground': '#38BDF8',
                  'editor.selectionBackground': '#2563EB55', 'editorLineNumber.foreground': '#64748B',
                  'editorLineNumber.activeForeground': '#E2E8F0', 'editorIndentGuide.background': '#334155',
                  'editorIndentGuide.activeBackground': '#475569', 'editorBracketMatch.border': '#38BDF8',
                },
              });
              monaco.editor.setTheme('hc-black');
            }

            monaco.languages.typescript.javascriptDefaults.setEagerModelSync(true);
            editor.updateOptions({ renderLineHighlight: 'all', bracketPairColorization: { enabled: true } });

            // Ensure simple template exists once (no duplication) - only if useTemplate is true
            if (useTemplate) {
              try {
                const model = editor.getModel();
                const txt: string = model.getValue() || '';
                const looksOld = /\/\/\#region|#region|#endregion/.test(txt);
                if (txt.trim().length === 0 || looksOld) {
                  editor.setValue(TEMPLATE);
                  onChange(TEMPLATE);
                }
              } catch { }
            }

            // No custom folding provider needed when regions are removed

            // Monaco provider (kept) — uses varKeys from props - only for JavaScript/TypeScript
            // Skip completion providers for custom languages (like regex)
            if (!customLanguage && (language === 'javascript' || language === 'typescript')) {
              const buildFallback = (range: any) => {
                const jsKeywords = ['if', 'else', 'return', 'const', 'let', 'var', 'function', 'try', 'catch', 'switch', 'case', 'for', 'while', 'do', 'break', 'continue', 'true', 'false', 'null', 'undefined'];
                return [
                  { label: 'vars["<key>"]', kind: monaco.languages.CompletionItemKind.Text, insertText: 'vars["<key>"]', detail: 'Insert OMNIA variable access', range },
                  ...jsKeywords.map((kw: string) => ({ label: kw, kind: monaco.languages.CompletionItemKind.Keyword, insertText: kw, range }))
                ];
              };
              try { (window as any).__omniaVarCompletionDispJS?.dispose?.(); } catch { }
              try { (window as any).__omniaVarCompletionDispTS?.dispose?.(); } catch { }
              const registerFor = (lang: string) => monaco.languages.registerCompletionItemProvider(lang, {
                triggerCharacters: ['"', '\'', '`', '.', '['],
                provideCompletionItems: (model: any, position: any) => {
                  try {
                    const keys: string[] = Array.from(new Set((varKeys || []).filter(Boolean)));
                    const word = model.getWordUntilPosition(position);

                    // ✅ Extract partial text after vars[" to filter variables
                    const lineText = model.getLineContent(position.lineNumber);
                    const textUntilPosition = lineText.substring(0, position.column - 1);

                    // Check if we're inside vars["..."]
                    const varsPattern = /vars\s*\[\s*["']([^"']*)$/;
                    const match = textUntilPosition.match(varsPattern);

                    // ✅ SOLO se siamo dentro vars["..."] mostriamo le variabili OMNIA
                    if (!match) {
                      // Non siamo dentro vars["..."], disabilita i suggerimenti predefiniti di Monaco
                      return { suggestions: [] };
                    }

                    // Siamo dentro vars["..."], filtra le variabili
                    let filteredKeys = keys;
                    const partialText = match[1].toLowerCase();
                    if (partialText.length > 0) {
                      filteredKeys = keys.filter(k =>
                        k.toLowerCase().startsWith(partialText)
                      );
                    }

                    const range = {
                      startLineNumber: position.lineNumber,
                      startColumn: word.startColumn,
                      endLineNumber: position.lineNumber,
                      endColumn: word.endColumn
                    };

                    const capped = filteredKeys.slice(0, 200);
                    const suggestions = capped.map((k: string) => ({
                      label: `vars["${k}"]`,
                      kind: monaco.languages.CompletionItemKind.Variable,
                      insertText: `vars["${k}"]`,
                      detail: 'OMNIA Variable',
                      range,
                      // ✅ Add filterText to help Monaco's built-in filtering
                      filterText: k
                    }));

                    // ✅ Mostra SOLO le variabili OMNIA, nessun fallback
                    return { suggestions };
                  } catch {
                    // ✅ In caso di errore, non mostrare nulla (disabilita suggerimenti predefiniti)
                    return { suggestions: [] };
                  }
                }
              });
              (window as any).__omniaVarCompletionDispJS = registerFor('javascript');
              (window as any).__omniaVarCompletionDispTS = registerFor('typescript');
            }

            // ✅ Custom variables tree menu - only for JavaScript/TypeScript
            if (!customLanguage && (language === 'javascript' || language === 'typescript')) {
              const dom = editor.getDomNode();
              let onCtx: any;
              let onMouseUp: any;

              if (dom) {
                // ✅ Open menu on right-click
                onCtx = (e: any) => {
                  try {
                    e.preventDefault();
                    e.stopPropagation();
                    editor.focus();
                    const pos = editor.getPosition();
                    const coords = editor.getScrolledVisiblePosition(pos);
                    if (coords) {
                      setMenuPosition({ x: e.clientX, y: e.clientY });
                      setMenuOpen(true);
                    }
                  } catch (err) {
                    console.error('🔍 [EditorPanel] Error in right-click handler:', err);
                  }
                  return false;
                };

                // ✅ Open menu on right mouse button
                onMouseUp = (e: MouseEvent) => {
                  if (e.button === 2) {
                    try {
                      e.preventDefault();
                      e.stopPropagation();
                      setMenuPosition({ x: e.clientX, y: e.clientY });
                      setMenuOpen(true);
                    } catch (err) {
                      console.error('🔍 [EditorPanel] Error in mouseup handler:', err);
                    }
                  }
                };

                // ✅ Open menu when typing '[' (trigger for variables)
                editor.onKeyDown((e: any) => {
                  if (e.keyCode === monaco.KeyCode.BracketLeft) {
                    // Check if we're inside vars["..."] context
                    const pos = editor.getPosition();
                    const model = editor.getModel();
                    if (pos && model) {
                      const lineText = model.getLineContent(pos.lineNumber);
                      const textUntilPosition = lineText.substring(0, pos.column - 1);
                      const varsPattern = /vars\s*\[\s*["']([^"']*)$/;
                      const match = textUntilPosition.match(varsPattern);

                      if (match) {
                        // We're inside vars["..."], open menu
                        setTimeout(() => {
                          const coords = editor.getScrolledVisiblePosition(pos);
                          if (coords) {
                            const domNode = editor.getDomNode();
                            if (domNode) {
                              const rect = domNode.getBoundingClientRect();
                              const newPos = {
                                x: rect.left + coords.left,
                                y: rect.top + coords.top + 20 // Position below cursor
                              };
                              setMenuPosition(newPos);
                              setMenuOpen(true);
                            }
                          }
                        }, 100); // Small delay to let Monaco process the '[' character
                      }
                    }
                  }
                });

                dom.addEventListener('contextmenu', onCtx, { capture: true } as any);
                dom.addEventListener('mouseup', onMouseUp as any, { capture: true });
              }

              // ✅ Cleanup on dispose
              editor.onDidDispose(() => {
                if (dom) {
                  try { dom.removeEventListener('contextmenu', onCtx as any, { capture: true } as any); } catch { }
                  try { dom.removeEventListener('mouseup', onMouseUp as any, { capture: true } as any); } catch { }
                }
              });
            }

            // (template guard already installed above)

            // Cleanup on dispose to avoid leaks
            editor.onDidDispose(() => {
              if (!customLanguage && (language === 'javascript' || language === 'typescript')) {
                try { (window as any).__omniaVarCompletionDispJS?.dispose?.(); } catch { }
                try { (window as any).__omniaVarCompletionDispTS?.dispose?.(); } catch { }
              }
            });
          } catch { }
        }}
        height="100%"
      />
      {/* ✅ Variables Tree Menu */}
      {(() => {
        const shouldRender = !customLanguage && (language === 'javascript' || language === 'typescript') && editorRef.current && monacoRef.current;
        // console.log('🔍 [EditorPanel] Should render menu?', {
        //   shouldRender,
        //   customLanguage,
        //   language,
        //   hasEditor: !!editorRef.current,
        //   hasMonaco: !!monacoRef.current,
        //   menuOpen,
        //   varKeysCount: varKeys?.length
        // });

        if (shouldRender) {
          return (
            <VariablesTreeMenu
              isOpen={menuOpen}
              position={menuPosition}
              variables={varKeys}
              editor={editorRef.current}
              monaco={monacoRef.current}
              onClose={() => {
                setMenuOpen(false);
              }}
            />
          );
        }
        return null;
      })()}
    </div>
  );
});

export default EditorPanel;



