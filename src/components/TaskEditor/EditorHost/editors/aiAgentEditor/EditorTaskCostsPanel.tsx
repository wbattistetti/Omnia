/**
 * Pannello inline "Costi" del task editor AI Agent.
 *
 * Vive come "vista extra" dello stepper di costruzione (sempre disponibile, non gating, separato
 * dai 5 step ufficiali — vedi `AIAgentConstructionStepper`). Mostra il **report dei costi IA
 * filtrato per il `taskId` del task corrente**: un solo macro-task, gi\u00e0 espanso, con tabella
 * delle singole chiamate sotto. \u00c8 una **vista del solo task** complementare al dialog globale
 * `$` della toolbar (che mostra cross-task tutto lo storico).
 *
 * Design pulito (DRY + SRP):
 *   - Componenti di rendering riusati da `aiCallReport/aiCallReportRendering` (single source).
 *   - Solo logica di filtro/empty-state vive qui.
 *   - Nessuna persistenza locale (espansione, sort, ecc.): il pannello mostra **un solo** nodo
 *     gi\u00e0 espanso \u2014 niente sort multinodo, niente expand/collapse persistente.
 */

import React from 'react';
import { DollarSign, RefreshCw, Loader2 } from 'lucide-react';
import { useAiCallLog } from '@context/AiCallLogContext';
import {
  buildAiCallReportTree,
  AI_CALL_REPORT_GLOBAL_NODE_ID,
} from '@domain/aiCalls/aiCallReportTree';
import {
  Badge,
  NodeRecordsTable,
  formatDurationMs,
  formatEur,
  formatUsd,
} from '@components/common/aiCallReport/aiCallReportRendering';

export interface EditorTaskCostsPanelProps {
  /** TaskTreeNode.taskId del task corrente: chiave del filtro lato dominio. */
  readonly taskId: string;
  /** Snapshot della label del task (mostrato nell'header del pannello e in empty state). */
  readonly taskLabel: string;
}

export function EditorTaskCostsPanel({
  taskId,
  taskLabel,
}: EditorTaskCostsPanelProps): React.ReactElement {
  const { calls, loading, error, refreshNow, exchangeRate } = useAiCallLog();

  /**
   * Filtro task-only: prendiamo solo le call con `taskId` esattamente uguale a quello del task
   * corrente. Il resto (call globali / call di altri task) viene scartato. Costruiamo poi
   * l'albero — produrr\u00e0 esattamente 0 o 1 nodo (mai globale, gli orfani sono filtrati via).
   */
  const tree = React.useMemo(() => {
    const filtered = calls.filter((c) => typeof c.taskId === 'string' && c.taskId === taskId);
    return buildAiCallReportTree(filtered, 'date');
  }, [calls, taskId]);

  /** Refresh on mount: il context fa polling, ma qui forziamo un fetch fresco appena entriamo. */
  React.useEffect(() => {
    void refreshNow();
  }, [refreshNow]);

  const node = tree.nodes.find((n) => n.id !== AI_CALL_REPORT_GLOBAL_NODE_ID) || null;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-slate-950 text-slate-100">
      <header className="flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/40 px-5 py-3">
        <div className="min-w-0 flex items-center gap-2">
          <DollarSign size={18} className="shrink-0 text-amber-300" aria-hidden />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-100">
              Costi IA — <span className="text-violet-200">{taskLabel || '(senza nome)'}</span>
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Solo le chiamate IA originate da questo task. Per la vista cross-task usa il
              pulsante <span className="font-mono">$</span> nella toolbar.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void refreshNow()}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-600 bg-slate-800 px-2.5 text-xs text-slate-200 hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          title="Ricarica lo storico"
        >
          {loading ? (
            <Loader2 size={13} className="animate-spin" aria-hidden />
          ) : (
            <RefreshCw size={13} aria-hidden />
          )}
          Aggiorna
        </button>
      </header>

      {error ? (
        <div className="px-5 py-4 text-sm text-rose-200">Errore caricando lo storico: {error}</div>
      ) : null}

      {!error && !node ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-center text-sm text-slate-400">
          <DollarSign size={28} className="text-slate-600" aria-hidden />
          <div className="max-w-md">
            Non ci sono ancora chiamate IA registrate per questo task.
            <br />
            Lancia una qualunque azione IA (Crea task, Genera use case, Tokenizza, ecc.) e i
            costi appariranno qui in tempo reale.
          </div>
        </div>
      ) : null}

      {node ? (
        <div className="flex flex-1 flex-col overflow-hidden">
          {/*
            Header degli aggregati del task: identico al "header del nodo" del dialog globale,
            ma sempre espanso (no toggle). Coerenza visiva = stessi badge, stesso stile, stessi
            formattatori (`formatUsd`/`formatEur` con regola "10 cent").
          */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/70 bg-slate-900/60 px-5 py-3">
            <div className="min-w-0 text-[11px] text-slate-400">
              {node.aggregates.callCount} chiamate · prima:{' '}
              {new Date(node.aggregates.firstTs).toLocaleString('it-IT')} · ultima:{' '}
              {new Date(node.aggregates.lastTs).toLocaleString('it-IT')}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                label="Token"
                value={`${node.aggregates.inputTokens.toLocaleString('it-IT')} in / ${node.aggregates.outputTokens.toLocaleString('it-IT')} out`}
              />
              <Badge label="Costo $" value={formatUsd(node.aggregates.costUsd)} highlight bold />
              <Badge label="Costo €" value={formatEur(node.aggregates.costEur)} highlight bold />
              <Badge label="Durata" value={formatDurationMs(node.aggregates.durationMs)} />
              {node.aggregates.errorCount > 0 ? (
                <Badge
                  label="Errori"
                  value={node.aggregates.errorCount.toLocaleString('it-IT')}
                />
              ) : null}
            </div>
          </div>

          {/* Tabella delle singole chiamate del task. */}
          <div className="flex-1 overflow-auto">
            <NodeRecordsTable records={node.records} />
          </div>
        </div>
      ) : null}

      <footer className="border-t border-slate-800/70 px-5 py-2 text-[11px] text-slate-400">
        {exchangeRate?.usdToEur != null
          ? `Cambio applicato: 1 USD = ${exchangeRate.usdToEur.toFixed(4)} EUR (ECB ${
              exchangeRate.ecbDate ?? ''
            })`
          : 'Cambio EUR non disponibile (n/d) — i totali in € possono mancare.'}
      </footer>
    </div>
  );
}
