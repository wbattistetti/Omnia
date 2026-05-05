/**
 * Monaco incastonato in pannelli con overflow/backdrop: widget (menu contestuale, suggest) sopra la UI.
 * Allinea EditorPanel e editor di ricalcolo backend.
 */

const STYLE_ATTR = 'data-omnia-monaco-embedded-ui';

/** Applica opzioni e foglio di stile una tantum per z-index contestuali Monaco. */
export function applyMonacoEmbeddedEditorUi(
  editor: import('monaco-editor').editor.IStandaloneCodeEditor
): void {
  editor.updateOptions({
    fixedOverflowWidgets: true,
    ...(typeof document !== 'undefined' ? { overflowWidgetsDomNode: document.body } : {}),
  });
  ensureMonacoEmbeddedOverlayStyles();
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
