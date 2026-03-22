/**
 * Read-only inline Monaco DiffEditor overlay: previous IA prompt vs new IA prompt (decorative only).
 */

import React from 'react';
import * as monaco from 'monaco-editor';
import 'monaco-editor/min/vs/editor/editor.main.css';
import { setupMonacoEnvironment } from '@utils/monacoWorkerSetup';
import { ensureAIAgentRevisionDiffTheme } from './aiAgentRevisionMonacoTheme';

export interface AIAgentIaRevisionOverlayProps {
  modelUriSuffix: string;
  oldIaPrompt: string;
  newIaPrompt: string;
  onDismiss: () => void;
}

export function AIAgentIaRevisionOverlay({
  modelUriSuffix,
  oldIaPrompt,
  newIaPrompt,
  onDismiss,
}: AIAgentIaRevisionOverlayProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    try {
      setupMonacoEnvironment();
    } catch {
      /* optional */
    }

    const el = containerRef.current;
    if (!el) {
      return;
    }

    ensureAIAgentRevisionDiffTheme(monaco);

    const original = monaco.editor.createModel(
      oldIaPrompt,
      'plaintext',
      monaco.Uri.parse(`inmemory://omnia/ai-agent-ia-old/${encodeURIComponent(modelUriSuffix)}`)
    );
    const modified = monaco.editor.createModel(
      newIaPrompt,
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

    return () => {
      diffEditor.dispose();
      original.dispose();
      modified.dispose();
    };
  }, [modelUriSuffix, oldIaPrompt, newIaPrompt]);

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
