/**
 * Caret/selection adapters for backend path insert (textarea or Monaco).
 */

import type { RefObject } from 'react';
import type * as Monaco from 'monaco-editor';

export type TextSelectionRange = { start: number; end: number };

export type BackendPathSelectionAdapter = {
  getRange: () => TextSelectionRange;
  focus: () => void;
  setCaret: (offset: number) => void;
};

export function textareaSelectionAdapter(
  inputRef: RefObject<HTMLTextAreaElement | null>
): BackendPathSelectionAdapter {
  return {
    getRange: () => {
      const el = inputRef.current;
      const a = el?.selectionStart ?? 0;
      const b = el?.selectionEnd ?? a;
      return { start: Math.min(a, b), end: Math.max(a, b) };
    },
    focus: () => {
      inputRef.current?.focus();
    },
    setCaret: (offset) => {
      const el = inputRef.current;
      if (!el) return;
      try {
        el.setSelectionRange(offset, offset);
      } catch {
        /* ignore */
      }
    },
  };
}

export function monacoSelectionAdapter(
  editorRef: RefObject<Monaco.editor.IStandaloneCodeEditor | null>
): BackendPathSelectionAdapter {
  return {
    getRange: () => {
      const editor = editorRef.current;
      const model = editor?.getModel();
      const sel = editor?.getSelection();
      if (!model || !sel) return { start: 0, end: 0 };
      return {
        start: model.getOffsetAt(sel.getStartPosition()),
        end: model.getOffsetAt(sel.getEndPosition()),
      };
    },
    focus: () => {
      editorRef.current?.focus();
    },
    setCaret: (offset) => {
      const editor = editorRef.current;
      const model = editor?.getModel();
      if (!editor || !model) return;
      const clamped = Math.max(0, Math.min(offset, model.getValueLength()));
      const pos = model.getPositionAt(clamped);
      editor.setSelection({
        startLineNumber: pos.lineNumber,
        startColumn: pos.column,
        endLineNumber: pos.lineNumber,
        endColumn: pos.column,
      });
    },
  };
}
