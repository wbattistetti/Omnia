/**
 * Read-only inline Monaco DiffEditor overlay: previous IA prompt vs new IA prompt (decorative only).
 *
 * Mount is deferred (setTimeout 0) so React Strict Mode's mount→unmount→mount does not create
 * a DiffEditor that is immediately disposed while the diff worker is still computing (avoids
 * uncaught "Canceled" from Monaco). Model text updates use setValue instead of recreating the
 * editor when only old/new strings change.
 */

import React from 'react';
import * as monaco from 'monaco-editor';
import 'monaco-editor/min/vs/editor/editor.main.css';
import { setupMonacoEnvironment } from '@utils/monacoWorkerSetup';
import { ensureAIAgentRevisionDiffTheme } from './aiAgentRevisionMonacoTheme';

export type AIAgentIaRevisionOverlayChrome = 'card' | 'none';

export interface AIAgentIaRevisionOverlayProps {
  modelUriSuffix: string;
  oldIaPrompt: string;
  newIaPrompt: string;
  onDismiss: () => void;
  /** `card`: bordered block with title + Nascondi. `none`: diff area only (toolbar lives in parent). */
  chrome?: AIAgentIaRevisionOverlayChrome;
}

type EditorBundle = {
  diffEditor: monaco.editor.IStandaloneDiffEditor;
  original: monaco.editor.ITextModel;
  modified: monaco.editor.ITextModel;
};

function disposeDiffEditorBundle(cur: EditorBundle | null) {
  if (!cur) return;
  try {
    cur.diffEditor.setModel(null);
  } catch {
    /* Monaco may throw if already disposed */
  }
  try {
    cur.original.dispose();
  } catch {
    /* ignore */
  }
  try {
    cur.modified.dispose();
  } catch {
    /* ignore */
  }
  try {
    cur.diffEditor.dispose();
  } catch {
    /* ignore */
  }
}

export function AIAgentIaRevisionOverlay({
  modelUriSuffix,
  oldIaPrompt,
  newIaPrompt,
  onDismiss,
  chrome = 'card',
}: AIAgentIaRevisionOverlayProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const editorRef = React.useRef<EditorBundle | null>(null);
  const oldRef = React.useRef(oldIaPrompt);
  const newRef = React.useRef(newIaPrompt);
  oldRef.current = oldIaPrompt;
  newRef.current = newIaPrompt;

  React.useLayoutEffect(() => {
    let cancelled = false;
    const el = containerRef.current;
    if (!el) {
      return undefined;
    }

    const mountId = window.setTimeout(() => {
      if (cancelled) {
        return;
      }
      try {
        setupMonacoEnvironment();
      } catch {
        /* optional */
      }

      ensureAIAgentRevisionDiffTheme(monaco);

      disposeDiffEditorBundle(editorRef.current);
      editorRef.current = null;

      const original = monaco.editor.createModel(
        oldRef.current,
        'plaintext',
        monaco.Uri.parse(`inmemory://omnia/ai-agent-ia-old/${encodeURIComponent(modelUriSuffix)}`)
      );
      const modified = monaco.editor.createModel(
        newRef.current,
        'plaintext',
        monaco.Uri.parse(`inmemory://omnia/ai-agent-ia-new/${encodeURIComponent(modelUriSuffix)}`)
      );

      const diffEditor = monaco.editor.createDiffEditor(el, {
        renderSideBySide: false,
        originalEditable: false,
        readOnly: true,
        renderOverviewRuler: false,
        renderMarginRevertIcon: false,
        diffWordWrap: 'on',
        fontSize: 12,
        lineHeight: 18,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        wrappingIndent: 'same',
        automaticLayout: true,
        padding: { top: 6, bottom: 6 },
        renderIndicators: true,
        compactMode: true,
        experimental: { useTrueInlineView: true },
        renderLineHighlight: 'none',
        selectionHighlight: false,
      });

      diffEditor.setModel({ original, modified });
      const lineOpts = {
        readOnly: true,
        domReadOnly: true,
        renderLineHighlight: 'none' as const,
        selectionHighlight: false,
      };
      diffEditor.getOriginalEditor().updateOptions(lineOpts);
      diffEditor.getModifiedEditor().updateOptions(lineOpts);

      editorRef.current = { diffEditor, original, modified };
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(mountId);
      disposeDiffEditorBundle(editorRef.current);
      editorRef.current = null;
    };
  }, [modelUriSuffix, chrome]);

  React.useEffect(() => {
    const cur = editorRef.current;
    if (!cur) {
      return;
    }
    if (cur.original.getValue() !== oldIaPrompt) {
      cur.original.setValue(oldIaPrompt);
    }
    if (cur.modified.getValue() !== newIaPrompt) {
      cur.modified.setValue(newIaPrompt);
    }
  }, [oldIaPrompt, newIaPrompt]);

  if (chrome === 'none') {
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div
          ref={containerRef}
          className="min-h-0 flex-1 opacity-95"
          style={{ minHeight: 120 }}
          aria-label="Anteprima differenze generate dall IA"
        />
      </div>
    );
  }

  return (
    <div className="rounded-md border border-violet-900/50 bg-slate-950/90 overflow-hidden">
      <div className="flex items-center gap-2 px-2 py-1 border-b border-violet-900/40 bg-violet-950/20">
        <span className="text-[10px] uppercase tracking-wide text-violet-300/90">
          Modifiche IA (confronto versione precedente)
        </span>
        <button
          type="button"
          onClick={onDismiss}
          className="ml-auto text-[11px] text-violet-300 hover:text-violet-100 underline"
        >
          Nascondi
        </button>
      </div>
      <div
        ref={containerRef}
        className="opacity-95"
        style={{ minHeight: 120, maxHeight: 200, height: 160 }}
        aria-label="Anteprima differenze generate dall IA"
      />
    </div>
  );
}
