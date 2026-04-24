import React from 'react';
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import type { OrchestratorSseErrorPayload } from '@components/DialogueEngine/orchestratorAdapter';

type Props = { detail: OrchestratorSseErrorPayload };

function Collapsible(props: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="min-w-0">
      <button
        type="button"
        className="flex items-center gap-1 text-left text-[11px] font-medium text-amber-100/90 hover:text-amber-50"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {props.label}
      </button>
      {open ? props.children : null}
    </div>
  );
}

function formatJsonBlock(label: string, raw: string | undefined): React.ReactNode {
  if (raw == null || raw === '') return null;
  let text = raw;
  try {
    text = JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    /* testo non-JSON */
  }
  return (
    <Collapsible label={label}>
      <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-slate-950/80 p-2 font-mono text-[11px] text-slate-200">
        {text}
      </pre>
    </Collapsible>
  );
}

/**
 * Card runtime per errori ConvAI **startAgent** (payload SSE strutturato), separata da IaProvisionProviderError nel report compilazione.
 */
export function StartAgentErrorCard(props: Props) {
  const d = props.detail;
  const rows: { k: string; v: React.ReactNode }[] = [];
  if (d.phase != null && d.phase !== '') rows.push({ k: 'Fase', v: d.phase });
  if (d.httpStatus != null) rows.push({ k: 'HTTP', v: String(d.httpStatus) });
  if (d.agentId != null && d.agentId !== '') rows.push({ k: 'Agent ID', v: d.agentId });
  if (d.baseUrl != null && d.baseUrl !== '') rows.push({ k: 'Base URL', v: d.baseUrl });
  if (d.timestamp != null && d.timestamp !== '')
    rows.push({ k: 'Timestamp', v: d.timestamp });

  return (
    <div
      className="mt-2 rounded-md border border-amber-700/60 bg-amber-950/40 px-3 py-2 text-xs text-amber-50 shadow-sm min-w-0"
      role="alert"
    >
      <div className="flex items-start gap-2 font-semibold text-amber-100">
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-400" aria-hidden />
        <span className="min-w-0 break-words">Errore avvio agente ConvAI (startAgent)</span>
      </div>
      {d.error ? (
        <p className="mt-2 text-[11px] leading-snug text-amber-50/95 break-words">{d.error}</p>
      ) : null}
      {rows.length > 0 ? (
        <dl className="mt-2 grid gap-1 text-[11px]">
          {rows.map(({ k, v }) => (
            <div key={k} className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 min-w-0">
              <dt className="font-medium text-amber-200/90 shrink-0">{k}</dt>
              <dd className="min-w-0 break-all text-amber-50/90">{v}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <div className="mt-2 space-y-2">
        {formatJsonBlock('Body ApiServer (JSON)', d.apiServerBody)}
        {formatJsonBlock('Risposta grezza ElevenLabs', d.elevenlabsRawBody)}
      </div>
    </div>
  );
}
