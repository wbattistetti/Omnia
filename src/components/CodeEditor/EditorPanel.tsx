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

export default function EditorPanel({ code, onChange, fontSize = 13, varKeys = [], language = 'javascript' }: { code: any; onChange: (s: string) => void; fontSize?: number; varKeys?: string[]; language?: string }) {
  const safeCode: string = typeof code === 'string' ? code : (code == null ? '' : (() => { try { return JSON.stringify(code, null, 2); } catch { return String(code); } })());
  return (
    <div className="w-full h-full border border-slate-700 rounded">
      <MonacoEditor
        language={language}
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
          contextmenu: false,
          folding: true,
          showFoldingControls: 'always',
          quickSuggestions: { other: true, comments: true, strings: true },
          suggestOnTriggerCharacters: true,
        }}
        editorDidMount={(editor: any, monaco: any) => {
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

            // theme tweaks
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
            monaco.languages.typescript.javascriptDefaults.setEagerModelSync(true);
            editor.updateOptions({ renderLineHighlight: 'all', bracketPairColorization: { enabled: true } });

            // Ensure simple template exists once (no duplication)
            try {
              const model = editor.getModel();
              const txt: string = model.getValue() || '';
              const looksOld = /\/\/\#region|#region|#endregion/.test(txt);
              if (txt.trim().length === 0 || looksOld) {
                editor.setValue(TEMPLATE);
                onChange(TEMPLATE);
              }
            } catch {}

            // No custom folding provider needed when regions are removed

            // Monaco provider (kept) — uses varKeys from props
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

            // Custom fallback menu (always works, single instance)
            let menu = document.getElementById('omnia-var-menu') as HTMLDivElement | null;
            const createdMenu = !menu;
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

            const closeMenu = () => { menu.style.display = 'none'; menu.innerHTML = ''; };
            const openMenu = (x: number, y: number) => {
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
            if (dom) {
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

            // (template guard already installed above)

            // Cleanup on dispose to avoid leaks
            editor.onDidDispose(() => {
              try { (window as any).__omniaVarCompletionDispJS?.dispose?.(); } catch {}
              try { (window as any).__omniaVarCompletionDispTS?.dispose?.(); } catch {}
              if (dom) {
                try { dom.removeEventListener('contextmenu', onCtx as any, { capture: true } as any); } catch {}
                try { dom.removeEventListener('mouseup', onMouseUp as any, { capture: true } as any); } catch {}
              }
              try { document.removeEventListener('keydown', onDocKey as any); } catch {}
              try { document.removeEventListener('click', onDocClick as any, { capture: true } as any); } catch {}
              // keep single menu instance for other editors; don't remove if not created by this mount
              try { if (createdMenu && menu && menu.parentElement) menu.parentElement.removeChild(menu); } catch {}
            });
          } catch {}
        }}
        height="100%"
      />
    </div>
  );
}



