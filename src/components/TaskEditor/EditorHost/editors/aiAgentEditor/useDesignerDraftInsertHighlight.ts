/**
 * Applies Monaco inline decorations for designer-added text vs agent baseline.
 */

import React from 'react';
import * as monaco from 'monaco-editor';
import { computeDesignerAddedCharRanges } from '@domain/aiAgent/designerDraftInsertRanges';
import './designerDraftInsertHighlight.css';

const DECORATION_CLASS = 'omnia-designer-insert-highlight';

function rangesToDecorations(
  model: monaco.editor.ITextModel,
  charRanges: readonly { start: number; end: number }[]
): monaco.editor.IModelDeltaDecoration[] {
  const out: monaco.editor.IModelDeltaDecoration[] = [];

  for (const { start, end } of charRanges) {
    if (end <= start) continue;
    const maxOffset = model.getValueLength();
    const s = Math.max(0, Math.min(start, maxOffset));
    const e = Math.max(s, Math.min(end, maxOffset));
    if (e <= s) continue;

    try {
      const startPos = model.getPositionAt(s);
      const endPos = model.getPositionAt(e);
      out.push({
        range: {
          startLineNumber: startPos.lineNumber,
          startColumn: startPos.column,
          endLineNumber: endPos.lineNumber,
          endColumn: endPos.column,
        },
        options: {
          inlineClassName: DECORATION_CLASS,
          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      });
    } catch {
      /* invalid offset after model sync */
    }
  }

  return out;
}

export type UseDesignerDraftInsertHighlightParams = {
  editorRef: React.RefObject<monaco.editor.IStandaloneCodeEditor | null>;
  agentBaseline: string;
  draft: string;
  enabled: boolean;
};

/** Recomputes orange highlight on draft vs baseline when the editor or text changes. */
export function useDesignerDraftInsertHighlight({
  editorRef,
  agentBaseline,
  draft,
  enabled,
}: UseDesignerDraftInsertHighlightParams): { applyDecorations: () => void } {
  const decorationIdsRef = React.useRef<string[]>([]);

  const applyDecorations = React.useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const clear = () => {
      decorationIdsRef.current = editor.deltaDecorations(decorationIdsRef.current, []);
    };

    if (!enabled || !agentBaseline.trim()) {
      clear();
      return;
    }

    const model = editor.getModel();
    if (!model) {
      clear();
      return;
    }

    const modelText = model.getValue();
    const charRanges = computeDesignerAddedCharRanges(agentBaseline, modelText);
    const decs = rangesToDecorations(model, charRanges);
    decorationIdsRef.current = editor.deltaDecorations(decorationIdsRef.current, decs);
  }, [editorRef, agentBaseline, draft, enabled]);

  React.useEffect(() => {
    applyDecorations();
  }, [applyDecorations]);

  React.useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return undefined;
    const disposable = editor.onDidChangeModelContent(() => {
      applyDecorations();
    });
    return () => disposable.dispose();
  }, [editorRef, applyDecorations]);

  return { applyDecorations };
}
