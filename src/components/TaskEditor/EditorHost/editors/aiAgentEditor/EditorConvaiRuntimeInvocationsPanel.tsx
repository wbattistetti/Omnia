/**
 * Guardalog runtime ConvAI V2 nel Task Editor AI Agent.
 */

import React from 'react';
import { Activity, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { useConvaiRuntimeInvocationLog } from '@context/ConvaiRuntimeInvocationLogContext';
import { RuntimeInvocationAccordionList } from '@features/debugger/ui/RuntimeInvocationAccordionList';

export interface EditorConvaiRuntimeInvocationsPanelProps {
  readonly projectId: string;
  readonly agentTaskId: string;
  readonly taskLabel: string;
  readonly backendTaskIds?: readonly string[];
}

export function EditorConvaiRuntimeInvocationsPanel({
  projectId,
  agentTaskId,
  taskLabel,
  backendTaskIds = [],
}: EditorConvaiRuntimeInvocationsPanelProps): React.ReactElement {
  const { invocations, loading, error, refreshNow, clear } = useConvaiRuntimeInvocationLog();
  const [backendFilter, setBackendFilter] = React.useState<string>('');
  const [kindFilter, setKindFilter] = React.useState<string>('');

  const refreshFilters = React.useMemo(
    () => ({
      projectId,
      agentTaskId,
      ...(backendFilter.trim() ? { backendTaskId: backendFilter.trim() } : {}),
      ...(kindFilter.trim() ? { kind: kindFilter.trim() } : {}),
    }),
    [projectId, agentTaskId, backendFilter, kindFilter]
  );

  React.useEffect(() => {
    void refreshNow(refreshFilters);
  }, [refreshNow, refreshFilters]);

  const filtered = React.useMemo(
    () =>
      invocations.filter(
        (r) =>
          r.projectId === projectId &&
          r.agentTaskId === agentTaskId &&
          (!backendFilter.trim() || r.backendTaskId === backendFilter.trim()) &&
          (!kindFilter.trim() || r.kind === kindFilter.trim())
      ),
    [invocations, projectId, agentTaskId, backendFilter, kindFilter]
  );

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-slate-950 text-slate-100">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/40 px-5 py-3">
        <div className="min-w-0 flex items-center gap-2">
          <Activity size={18} className="shrink-0 text-sky-300" aria-hidden />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-100">
              Log runtime ConvAI — <span className="text-violet-200">{taskLabel || '(senza nome)'}</span>
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Invocazioni ElevenLabs → Express (omnia_dialog_step + gateway backend). Schema V2.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value)}
            className="h-8 rounded-md border border-slate-600 bg-slate-800 px-2 text-xs text-slate-200"
            aria-label="Filtra per kind"
          >
            <option value="">Tutti i kind</option>
            <option value="omnia_dialog_step">omnia_dialog_step</option>
            <option value="convai_webhook_gateway">convai_webhook_gateway</option>
          </select>
          {backendTaskIds.length > 0 ? (
            <select
              value={backendFilter}
              onChange={(e) => setBackendFilter(e.target.value)}
              className="h-8 rounded-md border border-slate-600 bg-slate-800 px-2 text-xs text-slate-200"
              aria-label="Filtra per backend"
            >
              <option value="">Tutti i backend</option>
              {backendTaskIds.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          ) : null}
          <button
            type="button"
            onClick={() => void refreshNow(refreshFilters)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-600 bg-slate-800 px-2.5 text-xs text-slate-200 hover:bg-slate-700"
          >
            {loading ? (
              <Loader2 size={13} className="animate-spin" aria-hidden />
            ) : (
              <RefreshCw size={13} aria-hidden />
            )}
            Aggiorna
          </button>
          <button
            type="button"
            onClick={() => {
              if (!window.confirm('Svuotare tutto il log runtime ConvAI?')) return;
              void clear().then(() => refreshNow(refreshFilters));
            }}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-600 bg-slate-800 px-2.5 text-xs text-slate-300 hover:bg-slate-700"
          >
            <Trash2 size={13} aria-hidden />
            Svuota
          </button>
        </div>
      </header>

      {error ? (
        <div className="px-5 py-4 text-sm text-rose-200">Errore caricamento log: {error}</div>
      ) : null}

      {!error && filtered.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-center text-sm text-slate-400">
          <Activity size={28} className="text-slate-600" aria-hidden />
          <div className="max-w-lg">
            Nessuna invocazione runtime registrata per questo agente.
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto px-5 py-4">
          <RuntimeInvocationAccordionList invocations={filtered} />
        </div>
      )}

      <footer className="border-t border-slate-800/70 px-5 py-2 text-[11px] text-slate-500">
        {filtered.length} eventi · agentTaskId{' '}
        <span className="font-mono text-slate-400">{agentTaskId}</span>
      </footer>
    </div>
  );
}
