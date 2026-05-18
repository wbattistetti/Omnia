/**
 * Monaco helpers per il pannello «Compilazione conversazionale» (pannello DX «Mostra JSON»)
 * e per il dialog «Crea prompt conversazionale».
 *
 * Espone:
 *  - {@link ensureConversationalJsonTheme}: tema dark per il Monaco JSON con coloritura coerente.
 *  - {@link computeSemanticJsonDecorations}: decorations inline per evidenziare le chiavi
 *    semantiche dello use case (`useCaseId`, `label`, `scenario`, `tokenizedExample`, `tokens`).
 *  - {@link ensureConversationalPromptLanguage}: registra il linguaggio Monarch dedicato al
 *    prompt completo (header + regole numerate + blocchi JSON) e il tema associato.
 *
 * Tutte le funzioni sono idempotenti: usano flag interni o controllano lo stato Monaco prima
 * di registrare nuovamente. Pensate per essere chiamate dentro `useEffect` / `editorDidMount`.
 *
 * Le classi CSS riferite dalle decorations vivono in `conversationalMonaco.css`.
 */

import type { ConversationalCatalogFormat } from '@domain/useCaseGeneratorWizard/catalogFormat';
import type * as Monaco from 'monaco-editor';

const JSON_THEME_ID = 'omnia-conversational-json';
const PROMPT_LANGUAGE_ID = 'omnia-conversational-prompt';
const PROMPT_THEME_ID = 'omnia-conversational-prompt-theme';

/** Chiavi top-level del JSON {@link UseCaseConversationalJson} con la classe CSS associata. */
const SEMANTIC_KEYS: ReadonlyArray<{ key: string; keyClass: string; valueClass: string }> = [
  { key: 'useCaseId', keyClass: 'omnia-key-useCaseId', valueClass: 'omnia-value-useCaseId' },
  { key: 'label', keyClass: 'omnia-key-label', valueClass: 'omnia-value-label' },
  { key: 'scenario', keyClass: 'omnia-key-scenario', valueClass: 'omnia-value-scenario' },
  {
    key: 'tokenizedExample',
    keyClass: 'omnia-key-tokenizedExample',
    valueClass: 'omnia-value-tokenizedExample',
  },
  { key: 'tokens', keyClass: 'omnia-key-tokens', valueClass: 'omnia-value-tokens' },
  { key: 'template', keyClass: 'omnia-key-template', valueClass: 'omnia-value-template' },
  {
    key: 'tokens_stile',
    keyClass: 'omnia-key-tokens_stile',
    valueClass: 'omnia-value-tokens_stile',
  },
  { key: 'style_rule', keyClass: 'omnia-key-style_rule', valueClass: 'omnia-value-style_rule' },
];

let jsonThemeRegistered = false;
let promptLanguageRegistered = false;

/**
 * Registra (una sola volta) il tema dark del Monaco JSON.
 *
 * Tutte le chiavi JSON hanno un colore base neutro: l'evidenza semantica per chiave specifica
 * arriva da {@link computeSemanticJsonDecorations} via `inlineClassName`, perché Monaco non
 * supporta `monarch token` per chiavi specifiche dentro il linguaggio JSON nativo.
 */
export function ensureConversationalJsonTheme(monaco: typeof Monaco): void {
  if (jsonThemeRegistered) return;
  monaco.editor.defineTheme(JSON_THEME_ID, {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'string.key.json', foreground: '94a3b8' },
      { token: 'string.value.json', foreground: 'cbd5e1' },
      { token: 'number.json', foreground: 'fcd34d' },
      { token: 'keyword.json', foreground: '93c5fd' },
      { token: 'delimiter.bracket.json', foreground: '64748b' },
      { token: 'delimiter.array.json', foreground: '64748b' },
      { token: 'delimiter.colon.json', foreground: '64748b' },
      { token: 'delimiter.comma.json', foreground: '475569' },
    ],
    colors: {
      'editor.background': '#0c0c0f',
      'editor.foreground': '#cbd5e1',
      'editorLineNumber.foreground': '#475569',
      'editorLineNumber.activeForeground': '#94a3b8',
      'editorIndentGuide.background1': '#1e293b',
      'editor.lineHighlightBackground': '#11151d',
    },
  });
  jsonThemeRegistered = true;
}

export function getConversationalJsonThemeId(): string {
  return JSON_THEME_ID;
}

export interface SemanticDecoration {
  range: Monaco.IRange;
  options: Monaco.editor.IModelDecorationOptions;
}

/**
 * Calcola le decorations inline per evidenziare le chiavi semantiche del JSON e i loro valori.
 *
 * Strategia: scansione lineare riga-per-riga del modello, riconoscimento del pattern
 * `"<key>":` ad inizio riga (con indentazione), poi del valore associato (stringa, array
 * inline o array multi-linea). Per gli array multi-linea coloriamo solo l'apertura/chiusura
 * sulla stessa riga della chiave; gli elementi interni mantengono il colore base degli string.
 *
 * Pure function rispetto al modello (non muta nulla, restituisce le decorations da applicare).
 */
export function computeSemanticJsonDecorations(
  model: Monaco.editor.ITextModel
): SemanticDecoration[] {
  const decorations: SemanticDecoration[] = [];
  const lineCount = model.getLineCount();
  for (let lineNumber = 1; lineNumber <= lineCount; lineNumber++) {
    const text = model.getLineContent(lineNumber);
    for (const { key, keyClass, valueClass } of SEMANTIC_KEYS) {
      const match = text.match(new RegExp(`^(\\s*)"${key}"(\\s*:\\s*)(.*)$`));
      if (!match) continue;
      const indent = match[1].length;
      const keyStartCol = indent + 1;
      const keyEndCol = keyStartCol + key.length + 2;
      decorations.push({
        range: {
          startLineNumber: lineNumber,
          startColumn: keyStartCol,
          endLineNumber: lineNumber,
          endColumn: keyEndCol,
        },
        options: { inlineClassName: keyClass },
      });
      const afterKey = match[1].length + match[0].length - match[3].length;
      const valueStartCol = afterKey + 1;
      const valueEndCol = text.length + 1;
      if (valueStartCol < valueEndCol) {
        decorations.push({
          range: {
            startLineNumber: lineNumber,
            startColumn: valueStartCol,
            endLineNumber: lineNumber,
            endColumn: valueEndCol,
          },
          options: { inlineClassName: valueClass },
        });
      }
      break;
    }
  }
  return decorations;
}

/**
 * Registra (una sola volta) il linguaggio Monarch + tema per il prompt conversazionale completo.
 *
 * Riconosce:
 *  - heading di sezione (`Ruolo`, `Regole obbligatorie`, `Catalogo use case (JSON)`);
 *  - separatori `### Use case N`;
 *  - regole numerate iniziali (`1.`, `2.`, ...);
 *  - inline code in backtick (`` `tokenizedExample` ``);
 *  - blocchi JSON con coloritura coerente (chiavi violet/cyan/emerald/amber/pink per i campi
 *    noti; chiavi neutre slate per il resto).
 *
 * NB: il prompt è copiato verbatim al motore esterno — la coloritura è solo presentation-time
 * e non altera la stringa.
 */
export function ensureConversationalPromptLanguage(monaco: typeof Monaco): void {
  if (promptLanguageRegistered) return;

  const existing = monaco.languages.getLanguages();
  if (!existing.some((l) => l.id === PROMPT_LANGUAGE_ID)) {
    monaco.languages.register({ id: PROMPT_LANGUAGE_ID });
  }

  monaco.languages.setMonarchTokensProvider(PROMPT_LANGUAGE_ID, {
    defaultToken: 'omnia-text',
    tokenizer: {
      root: [
        [/^### Use case \d+\s*$/, 'omnia-section'],
        [/^###\d+\s*$/, 'omnia-section'],
        [/^### UC \d+\s*$/, 'omnia-section'],
        [
          /^(Ruolo|Regole obbligatorie|Catalogo use case \(JSON\)|Catalogo use case \(DSL\)|Indice use case \(scenario LLM\))\s*$/,
          'omnia-heading',
        ],
        [/^--- UC \d+:/, 'omnia-dsl-uc-header'],
        [/^\[\d+\.\d+\]/, 'omnia-dsl-ultra-id'],
        [/^VARIANT \d+:/, 'omnia-dsl-variant'],
        [/^\s*WHEN:/, 'omnia-dsl-when'],
        [/^\s*SAY:/, 'omnia-dsl-say'],
        [/^\s*TOKENS:/, 'omnia-dsl-tokens'],
        [/^LOG:/, 'omnia-dsl-log'],
        [/^STYLE:/, 'omnia-dsl-style'],
        [/^\d+\.\s+.+$/, 'omnia-scenario-index'],
        [/^\s*\d+\.\s/, 'omnia-rulenumber'],
        [/`[^`]+`/, 'omnia-inlinecode'],
        [/^\s*\{/, { token: 'omnia-json-bracket', next: '@json' }],
        [/^\s*\[\s*$/, { token: 'omnia-json-bracket', next: '@json' }],
        [/\[[a-z][a-z0-9]*\d*\]/, 'omnia-token-bracket'],
        [/«[^»]+»/, 'omnia-style-token'],
        [/[^`]+/, 'omnia-text'],
      ],
      json: [
        [/^\s*\}\s*,?\s*$/, { token: 'omnia-json-bracket', next: '@pop' }],
        [/^\s*\]\s*,?\s*$/, { token: 'omnia-json-bracket', next: '@pop' }],
        [/\}\s*,?\s*$/, { token: 'omnia-json-bracket', next: '@pop' }],
        [/"useCaseId"(?=\s*:)/, 'omnia-jsonkey-useCaseId'],
        [/"label"(?=\s*:)/, 'omnia-jsonkey-label'],
        [/"scenario"(?=\s*:)/, 'omnia-jsonkey-scenario'],
        [/"tokenizedExample"(?=\s*:)/, 'omnia-jsonkey-tokenizedExample'],
        [/"tokens"(?=\s*:)/, 'omnia-jsonkey-tokens'],
        [/"s"(?=\s*:)/, 'omnia-jsonkey-scenario'],
        [/"t"(?=\s*:)/, 'omnia-jsonkey-tokenizedExample'],
        [/"w"(?=\s*:)/, 'omnia-jsonkey-when'],
        [/"k"(?=\s*:)/, 'omnia-jsonkey-tokens'],
        [/"v"(?=\s*:)/, 'omnia-jsonkey-variants'],
        [/"l"(?=\s*:)/, 'omnia-jsonkey-log'],
        [/"ts"(?=\s*:)/, 'omnia-jsonkey-style'],
        [/"when"(?=\s*:)/, 'omnia-jsonkey-when'],
        [/"log"(?=\s*:)/, 'omnia-jsonkey-log'],
        [/"[^"]*"(?=\s*:)/, 'omnia-jsonkey'],
        [/"[^"]*"/, 'omnia-jsonstring'],
        [/-?\d+(?:\.\d+)?/, 'omnia-jsonnumber'],
        [/true|false|null/, 'omnia-jsonkeyword'],
        [/[{}[\]]/, 'omnia-json-bracket'],
        [/[,:]/, 'omnia-json-punct'],
        [/\[[a-z][a-z0-9]*\d*\]/, 'omnia-token-bracket'],
        [/\s+/, 'white'],
        [/./, 'omnia-text'],
      ],
    },
  });

  monaco.editor.defineTheme(PROMPT_THEME_ID, {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'omnia-text', foreground: 'd4d4d8' },
      { token: 'omnia-heading', foreground: 'c4b5fd', fontStyle: 'bold' },
      { token: 'omnia-section', foreground: '67e8f9', fontStyle: 'bold' },
      { token: 'omnia-rulenumber', foreground: 'fbbf24', fontStyle: 'bold' },
      { token: 'omnia-inlinecode', foreground: '6ee7b7' },
      { token: 'omnia-jsonkey', foreground: '94a3b8' },
      { token: 'omnia-jsonstring', foreground: 'cbd5e1' },
      { token: 'omnia-jsonnumber', foreground: 'fcd34d' },
      { token: 'omnia-jsonkeyword', foreground: '93c5fd' },
      { token: 'omnia-json-bracket', foreground: '64748b' },
      { token: 'omnia-json-punct', foreground: '475569' },
      { token: 'omnia-jsonkey-useCaseId', foreground: 'c4b5fd', fontStyle: 'bold' },
      { token: 'omnia-jsonkey-label', foreground: '67e8f9', fontStyle: 'bold' },
      { token: 'omnia-jsonkey-scenario', foreground: '6ee7b7', fontStyle: 'bold' },
      { token: 'omnia-jsonkey-tokenizedExample', foreground: 'fcd34d', fontStyle: 'bold' },
      { token: 'omnia-jsonkey-tokens', foreground: 'f9a8d4', fontStyle: 'bold' },
      { token: 'omnia-jsonkey-when', foreground: 'fb923c', fontStyle: 'bold' },
      { token: 'omnia-jsonkey-variants', foreground: 'a78bfa', fontStyle: 'bold' },
      { token: 'omnia-jsonkey-log', foreground: '94a3b8', fontStyle: 'bold' },
      { token: 'omnia-jsonkey-style', foreground: 'e879f9', fontStyle: 'bold' },
      { token: 'omnia-dsl-uc-header', foreground: '6ee7b7', fontStyle: 'bold' },
      { token: 'omnia-dsl-variant', foreground: 'a78bfa', fontStyle: 'bold' },
      { token: 'omnia-dsl-when', foreground: 'fb923c' },
      { token: 'omnia-dsl-say', foreground: 'fcd34d', fontStyle: 'bold' },
      { token: 'omnia-dsl-tokens', foreground: 'f9a8d4' },
      { token: 'omnia-dsl-log', foreground: '94a3b8' },
      { token: 'omnia-dsl-style', foreground: 'e879f9', fontStyle: 'bold' },
      { token: 'omnia-dsl-ultra-id', foreground: '67e8f9', fontStyle: 'bold' },
      { token: 'omnia-scenario-index', foreground: '6ee7b7' },
      { token: 'omnia-token-bracket', foreground: 'fbbf24' },
      { token: 'omnia-style-token', foreground: 'e879f9', fontStyle: 'italic' },
    ],
    colors: {
      'editor.background': '#0c0c0f',
      'editor.foreground': '#d4d4d8',
      'editorLineNumber.foreground': '#475569',
      'editorLineNumber.activeForeground': '#94a3b8',
      'editor.lineHighlightBackground': '#11151d',
    },
  });

  promptLanguageRegistered = true;
}

/** Linguaggio Monarch unico: supporta header + JSON (pretty/compact/minimal) + DSL. */
export function getConversationalPromptLanguageId(
  _format?: ConversationalCatalogFormat
): string {
  return PROMPT_LANGUAGE_ID;
}

export function getConversationalPromptThemeId(
  _format?: ConversationalCatalogFormat
): string {
  return PROMPT_THEME_ID;
}
