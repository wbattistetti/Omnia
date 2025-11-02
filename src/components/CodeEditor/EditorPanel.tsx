import React from 'react';
import MonacoEditor from 'react-monaco-editor';
import 'monaco-editor/min/vs/editor/editor.main.css';
import 'monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution';
import 'monaco-editor/esm/vs/language/typescript/monaco.contribution';
import 'monaco-editor/esm/vs/editor/contrib/suggest/browser/suggestController.js';
import 'monaco-editor/esm/vs/editor/contrib/snippet/browser/snippetController2.js';

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
}

export default function EditorPanel({ code, onChange, fontSize = 13, varKeys = [], language = 'javascript', customLanguage, useTemplate = true }: EditorPanelProps) {
  const safeCode: string = typeof code === 'string' ? code : (code == null ? '' : (() => { try { return JSON.stringify(code, null, 2); } catch { return String(code); } })());
  // If customLanguage is provided, use its id. Otherwise use language prop (or 'javascript' as fallback)
  const editorLanguage = customLanguage ? customLanguage.id : (language || 'javascript');
  const editorTheme = customLanguage?.themeName || `${customLanguage?.id || ''}Theme` || 'vs-dark';

  // Store refs to editor and monaco for useEffect
  const editorRef = React.useRef<any>(null);
  const monacoRef = React.useRef<any>(null);

  // CRITICAL: Pre-register custom language BEFORE MonacoEditor renders
  // This ensures the tokenizer is available when Monaco loads the initial content
  React.useEffect(() => {
    console.log('[EditorPanel] 🔍 PRE-REGISTRATION useEffect triggered', {
      hasCustomLanguage: !!customLanguage,
      langId: customLanguage?.id,
      windowAvailable: typeof window !== 'undefined'
    });

    if (!customLanguage || typeof window === 'undefined') {
      console.log('[EditorPanel] ⚠️ Skipping pre-registration:', {
        noCustomLanguage: !customLanguage,
        noWindow: typeof window === 'undefined'
      });
      return;
    }

    // Wait for Monaco to be available (react-monaco-editor loads it globally)
    let retryCount = 0;
    const maxRetries = 20; // 20 * 50ms = 1 second max wait

    const checkMonaco = () => {
      const monaco = (window as any).monaco;
      console.log(`[EditorPanel] 🔍 Checking Monaco availability (attempt ${retryCount + 1}/${maxRetries})`, {
        monacoExists: !!monaco,
        hasLanguages: !!(monaco && monaco.languages),
        hasEditor: !!(monaco && monaco.editor)
      });

      if (!monaco || !monaco.languages) {
        retryCount++;
        if (retryCount < maxRetries) {
          setTimeout(checkMonaco, 50);
        } else {
          console.error('[EditorPanel] ❌ Monaco not available after max retries');
        }
        return;
      }

      try {
        const langId = customLanguage.id;
        console.log('[EditorPanel] 🔍 Starting pre-registration for:', langId);

        const existingLanguages = monaco.languages.getLanguages();
        const isRegistered = existingLanguages.some((l: any) => l.id === langId);
        console.log('[EditorPanel] 🔍 Language registration check:', {
          langId,
          isRegistered,
          totalLanguages: existingLanguages.length,
          existingIds: existingLanguages.slice(0, 5).map((l: any) => l.id)
        });

        if (!isRegistered) {
          monaco.languages.register({ id: langId });
          console.log('[EditorPanel] ✅ Registered new language:', langId);
        }

        // Register tokenizer
        const tokenizerConfig = {
          tokenizer: customLanguage.tokenizer
        };
        console.log('[EditorPanel] 🔍 Registering tokenizer:', {
          langId,
          hasTokenizer: !!customLanguage.tokenizer,
          hasRoot: !!customLanguage.tokenizer?.root,
          rootRules: customLanguage.tokenizer?.root?.length || 0
        });

        monaco.languages.setMonarchTokensProvider(langId, tokenizerConfig);
        console.log('[EditorPanel] ✅ Tokenizer registered for:', langId);

        // Verify tokenizer was registered
        const tokenizerProvider = (monaco.languages as any).getEncodedTokensProvider(langId);
        console.log('[EditorPanel] 🔍 Tokenizer verification:', {
          langId,
          hasProvider: !!tokenizerProvider,
          providerType: typeof tokenizerProvider
        });

        // Define theme
        if (customLanguage.theme) {
          const themeName = customLanguage.themeName || `${langId}Theme`;
          console.log('[EditorPanel] 🔍 Defining theme:', {
            themeName,
            base: customLanguage.theme.base,
            rulesCount: customLanguage.theme.rules?.length || 0,
            colorsCount: Object.keys(customLanguage.theme.colors || {}).length
          });

          monaco.editor.defineTheme(themeName, {
            base: customLanguage.theme.base || 'vs-dark',
            inherit: customLanguage.theme.inherit !== false,
            rules: customLanguage.theme.rules || [],
            colors: customLanguage.theme.colors || {},
          });

          console.log('[EditorPanel] ✅ Theme defined:', themeName);
        }

        console.log('[EditorPanel] ✅✅✅ PRE-registration COMPLETE for:', langId);
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
    <div className="w-full h-full border border-slate-700 rounded">
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
          quickSuggestions: { other: true, comments: true, strings: true },
          suggestOnTriggerCharacters: true,
        }}
        editorDidMount={(editor: any, monaco: any) => {
          // Store refs for useEffect
          editorRef.current = editor;
          monacoRef.current = monaco;

          try {
            // z-index for Monaco widgets
            try {
              if (!document.querySelector('style[data-omnia="monaco-suggest-z"]')) {
                const style = document.createElement('style');
                style.setAttribute('data-omnia', 'monaco-suggest-z');
                style.textContent = `.monaco-editor .suggest-widget{z-index:99999 !important}.monaco-editor .context-view{z-index:99999 !important}`;
                document.head.appendChild(style);
              }
            } catch {}

            // Register custom language FIRST, before anything else
            console.log('[EditorPanel] 🔍 editorDidMount called', {
              hasCustomLanguage: !!customLanguage,
              langId: customLanguage?.id,
              editorLanguage,
              safeCodeLength: safeCode?.length || 0
            });

            if (customLanguage) {
              try {
                const langId = customLanguage.id;
                console.log('[EditorPanel] 🔍 Starting registration in editorDidMount:', langId);

                const existingLanguages = monaco.languages.getLanguages();
                const isRegistered = existingLanguages.some((l: any) => l.id === langId);
                console.log('[EditorPanel] 🔍 Language check in editorDidMount:', {
                  langId,
                  isRegistered,
                  wasPreRegistered: isRegistered
                });

                if (!isRegistered) {
                  monaco.languages.register({ id: langId });
                  console.log('[EditorPanel] ✅ Registered language in editorDidMount:', langId);
                }

                // Monaco expects: { tokenizer: { root: [...] } }
                // customLanguage.tokenizer already has { root: [...] }, so we wrap it in { tokenizer: ... }
                const tokenizerConfig = {
                  tokenizer: customLanguage.tokenizer
                };

                monaco.languages.setMonarchTokensProvider(langId, tokenizerConfig);
                console.log('[EditorPanel] ✅ Set tokenizer in editorDidMount:', langId);

                // Verify tokenizer
                try {
                  const tokenizerProvider = (monaco.languages as any).getEncodedTokensProvider(langId);
                  console.log('[EditorPanel] 🔍 Tokenizer verification in editorDidMount:', {
                    langId,
                    hasProvider: !!tokenizerProvider,
                    canGetProvider: !!tokenizerProvider
                  });
                } catch (verifyErr) {
                  console.warn('[EditorPanel] ⚠️ Cannot verify tokenizer:', verifyErr);
                }

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
                  console.log('[EditorPanel] ✅ Applied theme in editorDidMount:', themeName);
                }

                // CRITICAL: Get model and set language BEFORE tokenization
                const model = editor.getModel();
                console.log('[EditorPanel] 🔍 Model check:', {
                  hasModel: !!model,
                  modelUri: model?.uri?.toString(),
                  currentLanguage: model?.getLanguageId(),
                  expectedLanguage: langId
                });

                if (model) {
                  const previousLanguage = model.getLanguageId();
                  console.log('[EditorPanel] 🔍 Setting model language:', {
                    from: previousLanguage,
                    to: langId,
                    willChange: previousLanguage !== langId
                  });

                  // Set language IMMEDIATELY
                  monaco.editor.setModelLanguage(model, langId);

                  const afterLanguage = model.getLanguageId();
                  console.log('[EditorPanel] ✅ Set model language:', {
                    before: previousLanguage,
                    after: afterLanguage,
                    success: afterLanguage === langId
                  });

                  // Get current content
                  const currentValue = model.getValue();
                  console.log('[EditorPanel] 📝 Current content:', {
                    length: currentValue?.length || 0,
                    preview: currentValue?.substring(0, 50) || '(empty)',
                    isEmpty: !currentValue || currentValue.trim().length === 0
                  });

                  // AGGRESSIVE: Force tokenization multiple times with different strategies
                  const forceTokenizationAggressively = (attempt: number) => {
                    console.log(`[EditorPanel] 🔄 Force tokenization attempt ${attempt}`);

                    if (!model) {
                      console.warn('[EditorPanel] ⚠️ No model for tokenization attempt', attempt);
                      return;
                    }

                    try {
                      const currentLang = model.getLanguageId();
                      console.log(`[EditorPanel] 🔍 Attempt ${attempt} - Current model language:`, currentLang);

                      // Always force language update
                      monaco.editor.setModelLanguage(model, langId);
                      const afterSetLang = model.getLanguageId();
                      console.log(`[EditorPanel] 🔍 Attempt ${attempt} - After setLanguage:`, {
                        expected: langId,
                        actual: afterSetLang,
                        match: afterSetLang === langId
                      });

                      if (currentValue && currentValue.trim().length > 0) {
                        console.log(`[EditorPanel] 🔄 Attempt ${attempt} - Has content, clearing and resetting`);

                        // Strategy 1: Clear and reset content to force full tokenization
                        const savedValue = currentValue;
                        model.setValue('');
                        console.log(`[EditorPanel] 🔄 Attempt ${attempt} - Cleared model`);

                        // Use setTimeout(0) to ensure Monaco processes the clear
                        setTimeout(() => {
                          if (model) {
                            model.setValue(savedValue);
                            monaco.editor.setModelLanguage(model, langId);
                            console.log(`[EditorPanel] 🔄 Attempt ${attempt} - Reset content and language`);

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
                                console.log(`[EditorPanel] 🔄 Attempt ${attempt} - Applied edit operations`);

                                // Strategy 3: Force multiple renders
                                editor.render(true);
                                editor.deltaDecorations([], []);
                                editor.render(true);

                                // Check if tokens are actually applied
                                try {
                                  const decorations = editor.getLineDecorations(1);
                                  console.log(`[EditorPanel] 🔍 Attempt ${attempt} - Decorations on line 1:`, decorations?.length || 0);
                                } catch (e) {
                                  console.warn(`[EditorPanel] ⚠️ Cannot check decorations:`, e);
                                }

                                console.log(`[EditorPanel] ✅✅✅ Attempt ${attempt} - AGGRESSIVE tokenization completed`);
                              }
                            }, 5);
                          }
                        }, 5);
                      } else {
                        console.log(`[EditorPanel] 🔄 Attempt ${attempt} - Empty content, just setting language`);
                        // Even for empty content, ensure language is set
                        monaco.editor.setModelLanguage(model, langId);
                        editor.render(true);
                        console.log(`[EditorPanel] ✅ Attempt ${attempt} - Language set and rendered`);
                      }
                    } catch (e) {
                      console.error(`[EditorPanel] ❌ Error in aggressive tokenization attempt ${attempt}:`, e);
                    }
                  };

                  // Execute IMMEDIATELY and MULTIPLE TIMES to ensure it works
                  console.log('[EditorPanel] 🚀 Starting aggressive tokenization sequence');
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
              } catch {}
            }

            // No custom folding provider needed when regions are removed

            // Monaco provider (kept) — uses varKeys from props - only for JavaScript/TypeScript
            // Skip completion providers for custom languages (like regex)
            if (!customLanguage && (language === 'javascript' || language === 'typescript')) {
              const buildFallback = (range: any) => {
                const jsKeywords = ['if','else','return','const','let','var','function','try','catch','switch','case','for','while','do','break','continue','true','false','null','undefined'];
                return [
                  { label: 'vars["<key>"]', kind: monaco.languages.CompletionItemKind.Text, insertText: 'vars["<key>"]', detail: 'Insert OMNIA variable access', range },
                  ...jsKeywords.map((kw: string) => ({ label: kw, kind: monaco.languages.CompletionItemKind.Keyword, insertText: kw, range }))
                ];
              };
              try { (window as any).__omniaVarCompletionDispJS?.dispose?.(); } catch {}
              try { (window as any).__omniaVarCompletionDispTS?.dispose?.(); } catch {}
              const registerFor = (lang: string) => monaco.languages.registerCompletionItemProvider(lang, {
                triggerCharacters: ['"', '\'', '`', '.', '['],
                provideCompletionItems: (model: any, position: any) => {
                  try {
                    const keys: string[] = Array.from(new Set((varKeys || []).filter(Boolean)));
                    const word = model.getWordUntilPosition(position);
                    const range = { startLineNumber: position.lineNumber, startColumn: word.startColumn, endLineNumber: position.lineNumber, endColumn: word.endColumn };
                    const capped = (keys || []).slice(0, 200);
                    const suggestions = capped.map((k: string) => ({
                      label: `vars["${k}"]`, kind: monaco.languages.CompletionItemKind.Variable,
                      insertText: `vars["${k}"]`, detail: 'OMNIA Variable', range
                    }));
                    const out = suggestions.length ? suggestions : buildFallback(range);
                    return { suggestions: out };
                  } catch {
                    try {
                      const word = model.getWordUntilPosition(position);
                      const range = { startLineNumber: position.lineNumber, startColumn: word.startColumn, endLineNumber: position.lineNumber, endColumn: word.endColumn };
                      return { suggestions: buildFallback(range) };
                    } catch {
                      return { suggestions: [] };
                    }
                  }
                }
              });
              (window as any).__omniaVarCompletionDispJS = registerFor('javascript');
              (window as any).__omniaVarCompletionDispTS = registerFor('typescript');
            }

            // Custom fallback menu (always works, single instance) - only for JavaScript/TypeScript
            // Skip context menu for custom languages (like regex)
            let menu: HTMLDivElement | null = null;
            let createdMenu = false;
            if (!customLanguage && (language === 'javascript' || language === 'typescript')) {
              menu = document.getElementById('omnia-var-menu') as HTMLDivElement | null;
              createdMenu = !menu;
              if (!menu) {
                menu = document.createElement('div');
                menu.id = 'omnia-var-menu';
                menu.style.position = 'fixed';
                menu.style.zIndex = '100000';
                menu.style.background = '#0f172a';
                menu.style.border = '1px solid #334155';
                menu.style.borderRadius = '8px';
                menu.style.padding = '6px';
                menu.style.minWidth = '260px';
                menu.style.maxHeight = '300px';
                menu.style.overflowY = 'auto';
                menu.style.boxShadow = '0 8px 28px rgba(2,6,23,0.5)';
                menu.style.display = 'none';
                // Use a smaller font than the editor by at least 3px (editor default ~13px)
                menu.style.fontSize = '10px';
                document.body.appendChild(menu);
              }

              const closeMenu = () => { if (menu) { menu.style.display = 'none'; menu.innerHTML = ''; } };
              const openMenu = (x: number, y: number) => {
                if (!menu) return;
              try { menu.innerHTML = ''; } catch {}
              const keys = Array.from(new Set((varKeys || []).filter(Boolean)));

              // Header
              const header = document.createElement('div');
              header.textContent = 'Variables';
              header.style.color = '#93c5fd'; header.style.fontWeight = '700'; header.style.margin = '4px 6px 6px 6px';
              menu.appendChild(header);

              // Search box
              const searchWrap = document.createElement('div');
              searchWrap.style.padding = '0 6px 6px 6px';
              const search = document.createElement('input');
              search.type = 'text';
              search.placeholder = 'Filter variables (type to search)';
              search.style.width = '100%';
              search.style.padding = '6px 8px';
              search.style.border = '1px solid #334155';
              search.style.borderRadius = '6px';
              search.style.background = 'transparent';
              search.style.color = '#e5e7eb';
              searchWrap.appendChild(search);
              menu.appendChild(searchWrap);

              // Container for results
              const list = document.createElement('div');
              list.style.padding = '4px 4px 8px 4px';
              menu.appendChild(list);

              const insertKey = (k: string) => {
                    try {
                      const pos = editor.getPosition();
                      const text = `vars["${k}"]`;
                      editor.executeEdits('omnia-var-insert', [{ range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column), text }]);
                      editor.focus();
                    } catch {}
                    closeMenu();
                  };

              const makeRow = (label: string, depth: number, isLeaf: boolean, fullKey?: string) => {
                const row = document.createElement('div');
                row.style.display = 'flex';
                row.style.alignItems = 'center';
                row.style.gap = '6px';
                row.style.padding = '6px 8px';
                row.style.borderRadius = '6px';
                row.style.color = '#e5e7eb';
                row.style.cursor = 'pointer';
                row.style.marginLeft = `${depth * 12}px`;
                row.style.userSelect = 'none';
                row.onmouseenter = () => { row.style.background = 'rgba(56,189,248,0.10)'; };
                row.onmouseleave = () => { row.style.background = 'transparent'; };
                const chevron = document.createElement('span');
                chevron.textContent = isLeaf ? '' : '▶';
                chevron.style.width = '12px';
                chevron.style.opacity = isLeaf ? '0' : '0.8';
                row.appendChild(chevron);
                const text = document.createElement('span');
                text.textContent = label;
                row.appendChild(text);
                if (isLeaf && fullKey) {
                  const insert = () => insertKey(fullKey);
                  row.onclick = insert;
                  row.ondblclick = insert;
                }
                return row;
              };

              // Build tree from dot keys
              type Node = { name: string; children: Record<string, Node>; full?: string };
              const root: Node = { name: '', children: {} };
              keys.forEach(k => {
                const parts = String(k).split('.');
                let cur = root;
                parts.forEach((p, i) => {
                  cur.children[p] = cur.children[p] || { name: p, children: {} };
                  cur = cur.children[p];
                  if (i === parts.length - 1) cur.full = k;
                });
              });

              // Expand state
              const expanded = new Set<string>();

              const renderTree = (filter: string) => {
                list.innerHTML = '';
                const f = (filter || '').toLowerCase();

                const walk = (node: Node, path: string[], depth: number) => {
                  const key = path.join('.');
                  const isLeaf = !!node.full;
                  const label = node.name;
                  const visible = f ? (node.full ? node.full.toLowerCase().includes(f) : key.toLowerCase().includes(f)) : true;

                  if (path.length > 0 && visible) {
                    const row = makeRow(label, depth, isLeaf, node.full);
                    if (!isLeaf) {
                      const k = key;
                      const chevron = row.firstChild as HTMLSpanElement;
                      const isOpen = expanded.has(k);
                      chevron.style.transform = isOpen ? 'rotate(90deg)' : 'rotate(0deg)';
                      row.onclick = () => { if (!isLeaf) { if (expanded.has(k)) expanded.delete(k); else expanded.add(k); renderTree(search.value); } };
                    }
                    list.appendChild(row);
                  }
                  const isOpen = expanded.has(key) || f.length > 0; // force-open during filtering
                  if (!isLeaf && isOpen) {
                    Object.values(node.children).forEach((child) => walk(child, path.concat(child.name), depth + 1));
                  }
                };

                Object.values(root.children).forEach((n) => walk(n, [n.name], 0));
                if (!list.childNodes.length) {
                  const empty = document.createElement('div');
                  empty.textContent = 'No variables match the filter';
                  empty.style.color = '#64748b'; empty.style.padding = '6px 8px';
                  list.appendChild(empty);
                }
              };

              // Initial render
              renderTree('');
              search.oninput = () => renderTree(search.value || '');

              // Position and show (anchor menu bottom to click line by default; flip if needed)
              const padding = 8;
              const viewportW = window.innerWidth || document.documentElement.clientWidth || 1280;
              const viewportH = window.innerHeight || document.documentElement.clientHeight || 800;
              // Prepare for measurement
              menu.style.left = `${x}px`;
              menu.style.top = `${y}px`;
              menu.style.visibility = 'hidden';
              menu.style.display = 'block';
              requestAnimationFrame(() => {
                try {
                  const rect = menu.getBoundingClientRect();
                  const spaceAbove = y - padding;
                  const spaceBelow = viewportH - y - padding;
                  // Default position: above the click line (bottom anchored to the line)
                  let top = y - rect.height - padding;
                  let left = x;
                  // If not enough room above, show below and cap max height
                  if (top < padding && spaceBelow > spaceAbove) {
                    const maxH = Math.max(160, Math.min(420, Math.floor(spaceBelow)));
                    menu.style.maxHeight = `${maxH}px`;
                    top = Math.min(viewportH - maxH - padding, y + padding);
                  }
                  // Clamp horizontally
                  if (left + rect.width > viewportW - padding) left = Math.max(padding, viewportW - rect.width - padding);
                  if (left < padding) left = padding;
                  if (top < padding) top = padding;
                  menu.style.left = `${left}px`;
                  menu.style.top = `${top}px`;
                } catch {}
                menu.style.visibility = 'visible';
              });
              };

              const dom = editor.getDomNode();
              let onCtx: any;
              let onMouseUp: any;
              let onDocKey: any;
              let onDocClick: any;
              if (dom && menu) {
                onCtx = (e: any) => { try { e.preventDefault(); e.stopPropagation(); } catch {}; try { editor.focus(); } catch {}; openMenu(e.clientX, e.clientY); return false; };
                onMouseUp = (e: MouseEvent) => { if (e.button === 2) { try { e.preventDefault(); e.stopPropagation(); } catch {}; openMenu(e.clientX, e.clientY); } };
                onDocKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeMenu(); };
                // Close only when clicking outside the menu
                onDocClick = (ev: MouseEvent) => {
                  try {
                    const target = ev.target as Node;
                    if (menu && !menu.contains(target)) {
                      if (menu.style.display === 'block') closeMenu();
                    }
                  } catch { closeMenu(); }
                };
                // Prevent inside clicks from bubbling to document (so expanding tree won't close the menu)
                try { menu.addEventListener('mousedown', (ev) => { ev.stopPropagation(); }); } catch {}
                try { menu.addEventListener('click', (ev) => { ev.stopPropagation(); }); } catch {}
                dom.addEventListener('contextmenu', onCtx, { capture: true } as any);
                dom.addEventListener('mouseup', onMouseUp as any, { capture: true });
                document.addEventListener('keydown', onDocKey as any);
                document.addEventListener('click', onDocClick as any, { capture: true } as any);
              }
            }

            // (template guard already installed above)

            // Cleanup on dispose to avoid leaks
            editor.onDidDispose(() => {
              if (!customLanguage && (language === 'javascript' || language === 'typescript')) {
                try { (window as any).__omniaVarCompletionDispJS?.dispose?.(); } catch {}
                try { (window as any).__omniaVarCompletionDispTS?.dispose?.(); } catch {}
              }
              // Use editor's DOM node instead of the captured 'dom' variable
              const editorDom = editor.getDomNode();
              if (editorDom && menu) {
                try { editorDom.removeEventListener('contextmenu', onCtx as any, { capture: true } as any); } catch {}
                try { editorDom.removeEventListener('mouseup', onMouseUp as any, { capture: true } as any); } catch {}
              }
              if (menu) {
                try { document.removeEventListener('keydown', onDocKey as any); } catch {}
                try { document.removeEventListener('click', onDocClick as any, { capture: true } as any); } catch {}
                // keep single menu instance for other editors; don't remove if not created by this mount
                try { if (createdMenu && menu && menu.parentElement) menu.parentElement.removeChild(menu); } catch {}
              }
            });
          } catch {}
        }}
        height="100%"
      />
    </div>
  );
}



