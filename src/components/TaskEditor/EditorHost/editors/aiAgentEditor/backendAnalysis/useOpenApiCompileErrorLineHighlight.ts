/**
 * Decorazioni Monaco: ogni riga del report errori compilazione OpenAPI in rosso.
 */

import React from 'react';
import * as monaco from 'monaco-editor';
import './openapiCompileErrorHighlight.css';

const LINE_CLASS = 'omnia-openapi-compile-error-line';

function wholeLineDecorations(
  model: monaco.editor.ITextModel,
  lineMatches?: (lineText: string) => boolean
): monaco.editor.IModelDeltaDecoration[] {
  const match = lineMatches ?? ((t) => t.trim().length > 0);
  const lineCount = model.getLineCount();
  const out: monaco.editor.IModelDeltaDecoration[] = [];
  for (let line = 1; line <= lineCount; line++) {
    const text = model.getLineContent(line);
    if (!match(text)) continue;
    out.push({
      range: {
        startLineNumber: line,
        startColumn: 1,
        endLineNumber: line,
        endColumn: model.getLineMaxColumn(line),
      },
      options: {
        isWholeLine: true,
        inlineClassName: LINE_CLASS,
        className: LINE_CLASS,
      },
    });
  }
  return out;
}

export type UseOpenApiCompileErrorLineHighlightParams = {
  editorRef: React.RefObject<monaco.editor.IStandaloneCodeEditor | null>;
  value: string;
  enabled: boolean;
  /** Default: ogni riga non vuota (report errori). Per prompt: solo righe con MISSING. */
  lineMatches?: (lineText: string) => boolean;
};

export function useOpenApiCompileErrorLineHighlight({
  editorRef,
  value,
  enabled,
  lineMatches,
}: UseOpenApiCompileErrorLineHighlightParams): { applyDecorations: () => void } {
  const decorationIdsRef = React.useRef<string[]>([]);

  const applyDecorations = React.useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const clear = () => {
      decorationIdsRef.current = editor.deltaDecorations(decorationIdsRef.current, []);
    };

    if (!enabled || !value.trim()) {
      clear();
      return;
    }

    const model = editor.getModel();
    if (!model) {
      clear();
      return;
    }

    const decs = wholeLineDecorations(model, lineMatches);
    decorationIdsRef.current = editor.deltaDecorations(decorationIdsRef.current, decs);
  }, [editorRef, enabled, lineMatches, value]);

  React.useEffect(() => {
    applyDecorations();
  }, [applyDecorations]);

  React.useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !enabled) return undefined;
    const disposable = editor.onDidChangeModelContent(() => applyDecorations());
    return () => disposable.dispose();
  }, [editorRef, enabled, applyDecorations]);

  return { applyDecorations };
}
