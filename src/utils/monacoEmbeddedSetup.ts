/**
 * Monaco incastonato in pannelli Omnia: overlay UI, zoom rotella (solo editor), cursore/selezione.
 */

const STYLE_ATTR = 'data-omnia-monaco-embedded-ui';
const WHEEL_GUARD_ATTR = 'data-omnia-monaco-wheel-guard';

/** Cursore e selezione — blu chiaro coerente su tutti i temi Omnia. */
export const OMNIA_MONACO_CHROME_COLORS: Readonly<Record<string, string>> = {
  'editorCursor.foreground': '#7dd3fc',
  'editor.selectionBackground': '#38bdf966',
  'editor.inactiveSelectionBackground': '#38bdf940',
  'editor.selectionHighlightBackground': '#7dd3fc44',
};

/** Unisce colori tema editor con chrome Omnia (cursore / selezione). */
export function withOmniaMonacoChromeColors(
  colors: Record<string, string>
): Record<string, string> {
  return { ...colors, ...OMNIA_MONACO_CHROME_COLORS };
}

/**
 * Blocca Ctrl/Cmd + rotella sul DOM Monaco così il browser non zooma tutta la pagina.
 * Richiede `mouseWheelZoom: true` su Monaco per lo zoom font editor.
 */
export function bindMonacoWheelZoomGuard(
  editor: import('monaco-editor').editor.IStandaloneCodeEditor
): void {
  const dom = editor.getDomNode();
  if (!dom || dom.hasAttribute(WHEEL_GUARD_ATTR)) return;
  dom.setAttribute(WHEEL_GUARD_ATTR, '1');
  const onWheel = (e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
    }
  };
  dom.addEventListener('wheel', onWheel, { passive: false });
}

/** Applica opzioni, guard rotella e foglio stile overlay (menu contestuale / suggest). */
export function applyMonacoEmbeddedEditorUi(
  editor: import('monaco-editor').editor.IStandaloneCodeEditor
): void {
  editor.updateOptions({
    fixedOverflowWidgets: true,
    mouseWheelZoom: true,
    ...(typeof document !== 'undefined' ? { overflowWidgetsDomNode: document.body } : {}),
  });
  bindMonacoWheelZoomGuard(editor);
  ensureMonacoEmbeddedOverlayStyles();
}

const CONSTRAINT_DARK_THEME_ID = 'custom-dark';
let constraintDarkThemeRegistered = false;

/** Tema constraint wizard (idempotente) — allineato a MonacoEditorWithToolbar. */
export function ensureConstraintDarkMonacoTheme(
  monaco: typeof import('monaco-editor')
): void {
  if (constraintDarkThemeRegistered) return;
  monaco.editor.defineTheme(CONSTRAINT_DARK_THEME_ID, {
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
    colors: withOmniaMonacoChromeColors({
      'editor.foreground': '#D4D4D4',
      'editor.background': '#18181b',
      'editorLineNumber.foreground': '#858585',
      'editorIndentGuide.background': '#404040',
      'editorIndentGuide.activeBackground': '#707070',
    }),
  });
  constraintDarkThemeRegistered = true;
}

/** Inietta regole z-index per `.context-view` e `.suggest-widget` (idempotente). */
export function ensureMonacoEmbeddedOverlayStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.querySelector(`style[${STYLE_ATTR}]`)) return;
  const style = document.createElement('style');
  style.setAttribute(STYLE_ATTR, '1');
  style.textContent =
    '.monaco-editor .suggest-widget{z-index:99999 !important}.monaco-editor .context-view{z-index:99999 !important}';
  document.head.appendChild(style);
}
