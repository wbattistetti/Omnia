/**
 * Barra endpoint: toggle espansione URL, combo metodo HTTP, input URL con larghezza proporzionale al contenuto.
 */

import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export type EndpointUrlMethodBarProps = {
  url: string;
  method: string;
  onUrlChange: (url: string) => void;
  onMethodChange: (method: string) => void;
  placeholder?: string;
  controlStyle?: React.CSSProperties;
  labelStyle?: React.CSSProperties;
};

export function EndpointUrlMethodBar({
  url,
  method,
  onUrlChange,
  onMethodChange,
  placeholder = 'https://… — discovery /openapi.json sulla stessa origine',
  controlStyle,
  labelStyle,
}: EndpointUrlMethodBarProps) {
  const [expanded, setExpanded] = React.useState(true);
  const measureRef = React.useRef<HTMLSpanElement>(null);
  const [inputW, setInputW] = React.useState(160);

  const sample = (url.trim() || placeholder).slice(0, 400);

  React.useLayoutEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    const raw = el.offsetWidth + 28;
    const cap = typeof window !== 'undefined' ? Math.min(window.innerWidth * 0.62, 920) : 620;
    setInputW(Math.min(Math.max(raw, 96), cap));
  }, [sample, expanded]);

  const preview =
    url.trim().length > 0
      ? url.trim().length > 64
        ? `${url.trim().slice(0, 64)}…`
        : url.trim()
      : null;

  return (
    <div className="flex min-w-0 flex-wrap items-end gap-2">
      <label className="sr-only" htmlFor="omnia-endpoint-url" style={labelStyle}>
        URL endpoint
      </label>
      <button
        type="button"
        className="shrink-0 rounded border border-slate-600 bg-slate-800 p-1.5 text-slate-300 hover:bg-slate-700"
        aria-expanded={expanded}
        title={expanded ? 'Comprimi URL' : 'Espandi URL'}
        onClick={() => setExpanded((e) => !e)}
      >
        {expanded ? <ChevronDown className="h-4 w-4" aria-hidden /> : <ChevronRight className="h-4 w-4" aria-hidden />}
      </button>
      <select
        value={method}
        onChange={(e) => onMethodChange(e.target.value)}
        className="shrink-0 rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label="Metodo HTTP"
      >
        <option value="GET">GET</option>
        <option value="POST">POST</option>
        <option value="PUT">PUT</option>
        <option value="DELETE">DELETE</option>
        <option value="PATCH">PATCH</option>
      </select>

      <div className="relative min-w-0 flex-1 basis-[min(100%,14rem)]">
        <span
          ref={measureRef}
          className="invisible absolute left-0 top-0 z-[-1] inline-block max-w-none whitespace-nowrap px-2 py-1.5 text-sm"
          aria-hidden
        >
          {sample}
        </span>

        {expanded ? (
          <input
            id="omnia-endpoint-url"
            type="text"
            style={{ ...controlStyle, width: inputW, maxWidth: '100%' }}
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            placeholder={placeholder}
            className="min-w-0 rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        ) : (
          <button
            type="button"
            className="min-h-[2.25rem] w-full min-w-[8rem] max-w-full truncate rounded border border-slate-600 bg-slate-800/90 px-2 py-1.5 text-left text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            onClick={() => setExpanded(true)}
            title={url.trim() || placeholder}
          >
            {preview ? (
              <span className="text-slate-100">{preview}</span>
            ) : (
              <span className="text-slate-500 italic">{placeholder}</span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
