/**
 * Componenti di rendering condivisi per il report ad albero delle chiamate IA.
 *
 * Vivono qui (non dentro `AiCallLogDialog.tsx`) perch\u00e9 vengono riusati da:
 *   - `AiCallLogDialog`               (dialog globale "$") — vista cross-task
 *   - `EditorTaskCostsPanel`          (pannello inline dello step 6 "Costi" del task editor) —
 *                                      vista filtrata per il singolo `taskId` del task corrente
 *
 * Estratti seguendo la regola "DRY + SRP": ogni file fa una sola cosa, ogni componente \u00e8
 * stateless e pilotato da props. Nessun hook context — chi consuma decide la fonte dati.
 */

import React from 'react';
import { AlertTriangle, Bot, ChevronDown, ChevronRight } from 'lucide-react';
import { describeAiCallPurpose } from '@domain/aiCalls/purposes';
import {
  AI_CALL_REPORT_GLOBAL_NODE_ID,
  type AiCallReportNode,
} from '@domain/aiCalls/aiCallReportTree';
import { formatCost } from '@domain/aiCost/formatCost';
import type { AiCallRecord } from '@services/aiCallsApi';

/**
 * Format costi: tutti i valori (riga + aggregato) usano la regola "10 centesimi" di
 * `formatCost` per evitare drift visivo tra dialog globale e pannello task.
 */
export function formatUsd(value: number): string {
  return formatCost(value, 'USD');
}
export function formatEur(value: number | null): string {
  return value === null ? '—' : formatCost(value, 'EUR');
}

export function formatTimestamp(iso: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * Badge dell'header del nodo macro-task. `highlight` = sfondo viola (per i totali costo).
 * `bold` = valore in **grassetto pi\u00f9 grande** (richiesta UX di evidenziare i totali).
 */
export function Badge({
  label,
  value,
  highlight = false,
  bold = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  bold?: boolean;
}): React.ReactElement {
  return (
    <span
      className={
        'inline-flex flex-col items-end rounded border border-slate-700 px-2 py-0.5 text-[10px] leading-tight ' +
        (highlight ? 'bg-violet-950/40 text-violet-100' : 'bg-slate-900/60 text-slate-300')
      }
    >
      <span className="text-[9px] uppercase tracking-wide opacity-70">{label}</span>
      <span
        className={
          'tabular-nums ' + (bold ? 'text-[12px] font-bold text-violet-100' : 'font-medium')
        }
      >
        {value}
      </span>
    </span>
  );
}

/**
 * Riga di badge aggregati del nodo: chiamate, token in/out, costo € (in grassetto), durata.
 * EUR è la divisa unica di display (default progetto): USD resta la sorgente canonica
 * lato backend (`costUsd` nel record) e viene mostrato solo come tooltip/cambio nel footer
 * del dialog. Vedi feedback designer 2026-05-13: «Inutile mettere due colonne di costo».
 * Nasconde i badge in viewport stretti per non sfondare il layout (`hidden sm:flex`).
 */
export function NodeAggregateBadges({
  callCount,
  inputTokens,
  outputTokens,
  costEur,
  durationMs,
}: {
  callCount: number;
  inputTokens: number;
  outputTokens: number;
  costEur: number | null;
  durationMs: number;
}): React.ReactElement {
  return (
    <div className="hidden shrink-0 items-center gap-2 sm:flex">
      <Badge label="Chiamate" value={callCount.toLocaleString('it-IT')} />
      <Badge
        label="Token"
        value={`${inputTokens.toLocaleString('it-IT')} in / ${outputTokens.toLocaleString('it-IT')} out`}
      />
      <Badge label="Costo" value={formatEur(costEur)} highlight bold />
      <Badge label="Durata" value={formatDurationMs(durationMs)} />
    </div>
  );
}

/**
 * Riga accordion per un nodo macro-task. Header con icona Bot (per i task) + label snapshot
 * + badge "rinominato"/"errori" + aggregati + tabella record interna quando espanso.
 */
export function TreeNodeRow({
  node,
  expanded,
  onToggle,
}: {
  node: AiCallReportNode;
  expanded: boolean;
  onToggle: () => void;
}): React.ReactElement {
  const isGlobal = node.id === AI_CALL_REPORT_GLOBAL_NODE_ID;
  const isRenamed = node.labelHistory.length > 1 && !isGlobal;
  const errorPill = node.aggregates.errorCount > 0;

  return (
    <li className="overflow-hidden rounded-lg border border-slate-700/60 bg-slate-800/40">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-800/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
      >
        {expanded ? (
          <ChevronDown size={14} className="shrink-0 text-slate-400" aria-hidden />
        ) : (
          <ChevronRight size={14} className="shrink-0 text-slate-400" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {!isGlobal ? (
              <Bot size={16} className="shrink-0 text-violet-300" aria-hidden />
            ) : null}
            <span
              className={
                'truncate text-sm ' +
                (isGlobal
                  ? 'italic text-slate-300'
                  : 'font-semibold text-violet-100')
              }
              title={isGlobal ? undefined : `Macro-task IA \u00b7 taskId: ${node.id}`}
            >
              {node.label}
            </span>
            {isRenamed ? (
              <span
                className="rounded bg-amber-900/50 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-amber-200"
                title={`Storia: ${node.labelHistory.join(' \u2192 ')}`}
              >
                rinominato
              </span>
            ) : null}
            {errorPill ? (
              <span
                className="inline-flex items-center gap-1 rounded bg-rose-900/50 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-rose-200"
                title={`${node.aggregates.errorCount} chiamate in errore`}
              >
                <AlertTriangle size={10} aria-hidden />
                {node.aggregates.errorCount}
              </span>
            ) : null}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-400">
            Ultima: {formatTimestamp(node.aggregates.lastTs)} · Prima:{' '}
            {formatTimestamp(node.aggregates.firstTs)}
          </div>
        </div>
        <NodeAggregateBadges
          callCount={node.aggregates.callCount}
          inputTokens={node.aggregates.inputTokens}
          outputTokens={node.aggregates.outputTokens}
          costEur={node.aggregates.costEur}
          durationMs={node.aggregates.durationMs}
        />
      </button>
      {expanded ? <NodeRecordsTable records={node.records} /> : null}
    </li>
  );
}

/**
 * Tabella delle singole chiamate (records) di un nodo. Layout coerente tra dialog globale e
 * pannello task: data/ora, scopo, provider/modello, token in/out, costo €, durata.
 *
 * Solo EUR (vedi {@link NodeAggregateBadges}). Il valore USD canonico resta nel record per
 * eventuali tooltip — qui il `title` della cella mostra «USD: $X.YY» come hint, così il
 * designer può sempre verificare la conversione senza una colonna in più.
 */
export function NodeRecordsTable({
  records,
}: {
  records: readonly AiCallRecord[];
}): React.ReactElement {
  return (
    <div className="border-t border-slate-700/60 bg-slate-900/40">
      <table className="w-full table-auto border-separate border-spacing-0 text-xs">
        <thead className="bg-slate-900/80">
          <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
            <th className="px-3 py-1.5">Data / Ora</th>
            <th className="px-3 py-1.5">Scopo</th>
            <th className="px-3 py-1.5">Provider / Modello</th>
            <th className="px-3 py-1.5 text-right">Token in</th>
            <th className="px-3 py-1.5 text-right">Token out</th>
            <th className="px-3 py-1.5 text-right">Costo €</th>
            <th className="px-3 py-1.5 text-right">Durata</th>
          </tr>
        </thead>
        <tbody>
          {records.map((c) => (
            <tr key={c.id} className="text-slate-200 odd:bg-slate-800/30">
              <td className="px-3 py-1.5 align-top text-slate-300">{formatTimestamp(c.ts)}</td>
              <td className="px-3 py-1.5 align-top">
                <div className="font-medium text-slate-100">{describeAiCallPurpose(c.purpose)}</div>
                {c.error ? (
                  <div className="mt-0.5 text-[10px] text-rose-300">Errore: {c.error}</div>
                ) : null}
              </td>
              <td className="px-3 py-1.5 align-top text-slate-300">
                <span className="text-slate-400">{c.providerId}</span> / {c.modelId}
                {!c.pricingFound ? (
                  <span className="ml-1 inline-block rounded bg-amber-900/50 px-1 py-0 text-[10px] text-amber-200">
                    n/p
                  </span>
                ) : null}
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums">
                {c.inputTokens.toLocaleString('it-IT')}
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums">
                {c.outputTokens.toLocaleString('it-IT')}
              </td>
              <td
                className="px-3 py-1.5 text-right tabular-nums"
                title={`USD canonico: ${formatUsd(c.costUsd)}`}
              >
                {formatEur(c.costEur)}
              </td>
              <td className="px-3 py-1.5 text-right text-slate-400 tabular-nums">
                {c.durationMs} ms
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
