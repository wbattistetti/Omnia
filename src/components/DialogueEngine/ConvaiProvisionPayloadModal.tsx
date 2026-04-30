/**
 * Modale globale: JSON effettivo inviato da ApiServer a ElevenLabs agents/create (merge default + IA Runtime),
 * con fallback al body della fetch browser se il server non espone `elevenLabsRequestJson`.
 */

import React from 'react';
import {
  CONVAI_PROVISION_PAYLOAD_PREVIEW_EVENT,
  type ConvaiProvisionPayloadPreviewDetail,
  type ConvaiProvisionPayloadPreviewItem,
} from '@utils/iaAgentRuntime/convaiPayloadPreviewEvents';

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }
}

export function ConvaiProvisionPayloadModal(): React.ReactElement | null {
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<ConvaiProvisionPayloadPreviewItem[]>([]);
  const [copied, setCopied] = React.useState<string | null>(null);

  React.useEffect(() => {
    const onPreview = (ev: Event) => {
      const ce = ev as CustomEvent<ConvaiProvisionPayloadPreviewDetail>;
      const next = ce.detail?.items;
      if (!Array.isArray(next) || next.length === 0) return;
      setItems(next);
      setOpen(true);
      setCopied(null);
    };
    window.addEventListener(CONVAI_PROVISION_PAYLOAD_PREVIEW_EVENT, onPreview as EventListener);
    return () =>
      window.removeEventListener(CONVAI_PROVISION_PAYLOAD_PREVIEW_EVENT, onPreview as EventListener);
  }, []);

  const allText = React.useMemo(
    () => items.map((i) => `// ${i.displayName} (task ${i.taskId})\n${i.bodyText}`).join('\n\n---\n\n'),
    [items]
  );

  const handleCopyAll = React.useCallback(async () => {
    const ok = await copyText(allText);
    setCopied(ok ? 'all' : null);
    if (ok) window.setTimeout(() => setCopied(null), 2000);
  }, [allText]);

  const handleCopyOne = React.useCallback(async (idx: number, text: string) => {
    const ok = await copyText(text);
    setCopied(ok ? `one-${idx}` : null);
    if (ok) window.setTimeout(() => setCopied(null), 2000);
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 px-3 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="convai-payload-modal-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-lg border border-slate-600 bg-slate-950 shadow-xl">
        <div className="flex shrink-0 flex-row items-center justify-between gap-2 border-b border-slate-700 px-3 py-2">
          <h2 id="convai-payload-modal-title" className="text-sm font-semibold text-slate-100">
            Payload createAgent ElevenLabs ({items.length})
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleCopyAll()}
              className="rounded border border-cyan-700 bg-cyan-950/50 px-2 py-1 text-xs font-medium text-cyan-100 hover:bg-cyan-900/40"
            >
              {copied === 'all' ? 'Copiato' : 'Copia tutto'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
            >
              Chiudi
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
          <p className="mb-2 text-[11px] leading-snug text-slate-400">
            Payload mergeato inviato da ApiServer a ElevenLabs{' '}
            <code className="text-slate-300">POST …/v1/convai/agents/create</code> (campo{' '}
            <code className="text-slate-300">elevenLabsRequestJson</code>). Se assente (proxy vecchio), vedi il
            body client verso <code className="text-slate-300">/elevenlabs/createAgent</code>.
          </p>
          <div className="flex flex-col gap-4">
            {items.map((it, idx) => (
              <div
                key={`${it.taskId}-${idx}`}
                className="rounded border border-slate-700/80 bg-slate-900/50 p-2"
              >
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-slate-200">{it.displayName}</span>
                  <span className="font-mono text-[10px] text-slate-500">{it.taskId}</span>
                  <button
                    type="button"
                    onClick={() => void handleCopyOne(idx, it.bodyText)}
                    className="ml-auto rounded border border-slate-600 px-1.5 py-px text-[10px] text-slate-300 hover:bg-slate-800"
                  >
                    {copied === `one-${idx}` ? 'Copiato' : 'Copia'}
                  </button>
                </div>
                <pre className="max-h-[40vh] overflow-auto whitespace-pre-wrap break-all rounded bg-black/40 p-2 font-mono text-[10px] leading-relaxed text-slate-200">
                  {it.bodyText}
                </pre>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
