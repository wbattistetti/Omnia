/**
 * Read-only Word (.docx) viewer via Mammoth HTML conversion.
 */

import React from 'react';
import mammoth from 'mammoth';

export type KbWordViewerProps = {
  fileUrl: string;
  className?: string;
};

export function KbWordViewer({ fileUrl, className = '' }: KbWordViewerProps): React.ReactElement {
  const [html, setHtml] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetch(fileUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      .then((buffer) =>
        mammoth.convertToHtml(
          { arrayBuffer: buffer },
          {
            styleMap: [
              "p[style-name='Heading 1'] => h1:fresh",
              "p[style-name='Heading 2'] => h2:fresh",
            ],
          }
        )
      )
      .then((result) => {
        if (cancelled) return;
        setHtml(result.value || '<p>(documento vuoto)</p>');
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setHtml('');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fileUrl]);

  if (loading) {
    return (
      <p className={'p-4 text-slate-400 ' + className}>Caricamento documento Word…</p>
    );
  }
  if (error) {
    return <p className={'p-4 text-rose-300 ' + className}>{error}</p>;
  }

  return (
    <div
      className={
        'kb-word-viewer min-h-0 flex-1 overflow-auto rounded border border-slate-800 bg-white p-4 text-slate-900 ' +
        className
      }
    >
      <div
        className="prose prose-sm max-w-none [&_table]:w-full [&_td]:border [&_td]:border-slate-300 [&_th]:border [&_th]:border-slate-400"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
