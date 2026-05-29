/**
 * Monaco read-only: report errori compilazione OpenAPI (righe in rosso) per handoff al team backend.
 */

import React from 'react';
import type * as Monaco from 'monaco-editor';
import { KbMarkdownMonaco } from '@components/workspaces/elevenlabs/kb/KbMarkdownMonaco';
import { formatOpenApiCompileErrorsReport } from '@domain/openApi/collectOpenApiCompileErrors';
import { useOpenApiCompileErrorLineHighlight } from './useOpenApiCompileErrorLineHighlight';

export type OpenApiCompileErrorsMonacoProps = {
  errors: readonly string[];
  minHeightPx?: number;
};

export function OpenApiCompileErrorsMonaco({
  errors,
  minHeightPx = 120,
}: OpenApiCompileErrorsMonacoProps): React.ReactElement | null {
  const report = formatOpenApiCompileErrorsReport(errors);
  const editorRef = React.useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);

  const { applyDecorations } = useOpenApiCompileErrorLineHighlight({
    editorRef,
    value: report,
    enabled: errors.length > 0,
  });

  if (!report.trim()) return null;

  const lineCount = report.split('\n').length;
  const height = Math.min(320, Math.max(minHeightPx, 24 + lineCount * 20));

  return (
    <div className="min-w-0 shrink-0 rounded-md border border-red-900/55 bg-red-950/25">
      <p className="border-b border-red-900/40 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-red-200/95">
        Errori compilazione specifiche
      </p>
      <div className="p-2" style={{ height }}>
        <KbMarkdownMonaco
          value={report}
          readOnly
          language="plaintext"
          heightPx={height - 16}
          appearance="plain"
          ariaLabel="Errori compilazione OpenAPI"
          editorDidMount={(editor) => {
            editorRef.current = editor;
            applyDecorations();
          }}
        />
      </div>
    </div>
  );
}
