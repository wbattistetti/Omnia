/**
 * Modal di reportistica delle chiamate IA, presentate come **accordion ad albero per macro-task**.
 *
 * Modello (concordato con il prodotto, 2026-05-12):
 *   - L'utente percepisce la "creazione di un task" come una macro-attivit\u00e0 unica composta da
 *     molte chiamate IA (Create + Refine + N use case + N conversation + tokenization + ...).
 *   - Le chiamate originate dal task editor portano `(taskId, taskLabel)` propagati end-to-end
 *     via `callMeta`; qui le aggreghiamo per `taskId` (vedi `buildAiCallReportTree`).
 *   - I record senza `taskId` finiscono nel nodo "Globale (senza task)".
 *
 * UX:
 *   - **Vista a 2 livelli**: nodo macro-task (collapsable) -> elenco delle chiamate.
 *   - **Header del nodo**: label snapshot pi\u00f9 recente, badge "rinominato" se la storia
 *     contiene pi\u00f9 di una label, contatori (chiamate / errori / token / costi / durata).
 *   - **Toggle ordinamento**: Data desc (default) / Alfabetico. Persistito su `localStorage`.
 *   - **Stato espansione**: persistito su `localStorage` per non costringere l'utente a
 *     ri-espandere ogni volta che riapre il dialog.
 *   - **Footer**: cambio EUR + totali aggregati (numero chiamate e costi) calcolati dal root
 *     dell'albero.
 *
 * Componenti di rendering (TreeNodeRow, NodeRecordsTable, Badge, formatter) sono estratti in
 * `aiCallReport/aiCallReportRendering.tsx` perch\u00e9 condivisi col pannello inline del task editor
 * (`EditorTaskCostsPanel`).
 */

import React from 'react';
import {
  ChevronsDownUp,
  ChevronsUpDown,
  Loader2,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { useAiCallLog } from '../../context/AiCallLogContext';
import {
  buildAiCallReportTree,
  type AiCallReportSortMode,
} from '../../domain/aiCalls/aiCallReportTree';
import { TreeNodeRow, formatEur } from './aiCallReport/aiCallReportRendering';

const STORAGE_KEY_SORT = 'omnia.aiCallLog.sortMode';
const STORAGE_KEY_EXPANDED = 'omnia.aiCallLog.expanded';

function readSortMode(): AiCallReportSortMode {
  if (typeof window === 'undefined') return 'date';
  try {
    const v = window.localStorage.getItem(STORAGE_KEY_SORT);
    return v === 'alphabetical' ? 'alphabetical' : 'date';
  } catch {
    return 'date';
  }
}
function writeSortMode(mode: AiCallReportSortMode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY_SORT, mode);
  } catch {
    /* localStorage non disponibile (modalit\u00e0 privata): la perdita di preferenza UI non \u00e8 bloccante. */
  }
}

function readExpanded(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_EXPANDED);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const out: Record<string, boolean> = {};
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof k === 'string' && typeof v === 'boolean') out[k] = v;
      }
      return out;
    }
    return {};
  } catch {
    return {};
  }
}
function writeExpanded(state: Record<string, boolean>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY_EXPANDED, JSON.stringify(state));
  } catch {
    /* idem */
  }
}

export interface AiCallLogDialogProps {
  open: boolean;
  onClose: () => void;
}

export function AiCallLogDialog({ open, onClose }: AiCallLogDialogProps): React.ReactElement | null {
  const { calls, loading, error, refreshNow, clear, exchangeRate } = useAiCallLog();
  const [sortMode, setSortMode] = React.useState<AiCallReportSortMode>(() => readSortMode());
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>(() => readExpanded());

  React.useEffect(() => {
    if (!open) return undefined;
    void refreshNow();
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose, refreshNow]);

  React.useEffect(() => {
    writeSortMode(sortMode);
  }, [sortMode]);

  React.useEffect(() => {
    writeExpanded(expanded);
  }, [expanded]);

  const tree = React.useMemo(() => buildAiCallReportTree(calls, sortMode), [calls, sortMode]);

  const toggleNode = React.useCallback((id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  /**
   * Toggle "espandi/collassa tutto" in un solo pulsante (risparmia spazio nell'header).
   * Lo stato visivo segue `anyExpanded`: se almeno un nodo \u00e8 aperto, il pulsante \u00e8 "Comprimi"
   * e cliccandolo li chiude tutti; se tutti chiusi, \u00e8 "Espandi" e li apre tutti.
   */
  const anyExpanded = React.useMemo(
    () => tree.nodes.some((n) => expanded[n.id] === true),
    [tree.nodes, expanded]
  );
  const toggleAll = React.useCallback(() => {
    if (anyExpanded) {
      setExpanded({});
      return;
    }
    setExpanded(() => {
      const next: Record<string, boolean> = {};
      for (const n of tree.nodes) next[n.id] = true;
      return next;
    });
  }, [anyExpanded, tree.nodes]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Storico chiamate IA"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader
          loading={loading}
          sortMode={sortMode}
          onChangeSort={setSortMode}
          anyExpanded={anyExpanded}
          onToggleAll={toggleAll}
          onRefresh={refreshNow}
          onClear={clear}
          onClose={onClose}
        />
        <DialogBody
          tree={tree}
          error={error}
          expanded={expanded}
          onToggleNode={toggleNode}
        />
        <DialogFooter
          exchangeRateUsdToEur={exchangeRate?.usdToEur ?? null}
          totalCalls={tree.aggregates.callCount}
          totalEur={tree.aggregates.costEur}
          taskGroups={tree.nodes.length}
        />
      </div>
    </div>
  );
}

function DialogHeader({
  loading,
  sortMode,
  onChangeSort,
  anyExpanded,
  onToggleAll,
  onRefresh,
  onClear,
  onClose,
}: {
  loading: boolean;
  sortMode: AiCallReportSortMode;
  onChangeSort: (mode: AiCallReportSortMode) => void;
  /** True se almeno un nodo \u00e8 aperto (governa caption/icona del toggle). */
  anyExpanded: boolean;
  /** Toggle "comprimi tutto" (se `anyExpanded`) o "espandi tutto" (altrimenti). */
  onToggleAll: () => void;
  onRefresh: () => Promise<void>;
  onClear: () => Promise<void>;
  onClose: () => void;
}): React.ReactElement {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-slate-700/70 px-4 py-3">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-200">
          Storico chiamate IA
        </h2>
        <p className="mt-0.5 text-[11px] text-slate-400">
          Raggruppate per macro-task. Espandi un nodo per vedere le singole chiamate (costi
          in EUR al cambio ECB; USD canonico nel tooltip cella).
        </p>
      </div>
      <div className="flex items-center gap-2">
        <SortToggle mode={sortMode} onChange={onChangeSort} />
        <div className="hidden h-6 w-px bg-slate-700 sm:block" aria-hidden />
        <button
          type="button"
          onClick={onToggleAll}
          aria-pressed={anyExpanded}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-600 bg-slate-800 px-2.5 text-xs text-slate-200 hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          title={anyExpanded ? 'Comprimi tutti i gruppi' : 'Espandi tutti i gruppi'}
        >
          {anyExpanded ? (
            <ChevronsDownUp size={13} aria-hidden />
          ) : (
            <ChevronsUpDown size={13} aria-hidden />
          )}
          {anyExpanded ? 'Comprimi' : 'Espandi'}
        </button>
        <button
          type="button"
          onClick={() => void onRefresh()}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-600 bg-slate-800 px-2.5 text-xs text-slate-200 hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
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
            if (window.confirm('Vuoi davvero cancellare tutto lo storico delle chiamate IA?')) {
              void onClear();
            }
          }}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-rose-700/60 bg-rose-950/40 px-2.5 text-xs text-rose-100 hover:bg-rose-900/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
        >
          <Trash2 size={13} aria-hidden />
          Pulisci log
        </button>
        <button
          type="button"
          aria-label="Chiudi"
          onClick={onClose}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-300 hover:bg-slate-800 hover:text-slate-100"
        >
          <X size={16} aria-hidden />
        </button>
      </div>
    </header>
  );
}

function SortToggle({
  mode,
  onChange,
}: {
  mode: AiCallReportSortMode;
  onChange: (m: AiCallReportSortMode) => void;
}): React.ReactElement {
  const isDate = mode === 'date';
  return (
    <div
      role="tablist"
      aria-label="Ordina i gruppi"
      className="inline-flex overflow-hidden rounded-md border border-slate-600 bg-slate-800 text-xs"
    >
      <button
        type="button"
        role="tab"
        aria-selected={isDate}
        onClick={() => onChange('date')}
        className={
          'h-8 px-2.5 ' +
          (isDate
            ? 'bg-violet-600 text-white'
            : 'text-slate-200 hover:bg-slate-700')
        }
        title="Ordina per data (pi\u00f9 recente in alto)"
      >
        Data
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={!isDate}
        onClick={() => onChange('alphabetical')}
        className={
          'h-8 px-2.5 ' +
          (!isDate
            ? 'bg-violet-600 text-white'
            : 'text-slate-200 hover:bg-slate-700')
        }
        title="Ordina per nome del task (A-Z)"
      >
        A-Z
      </button>
    </div>
  );
}

function DialogBody({
  tree,
  error,
  expanded,
  onToggleNode,
}: {
  tree: ReturnType<typeof buildAiCallReportTree>;
  error: string | null;
  expanded: Record<string, boolean>;
  onToggleNode: (id: string) => void;
}): React.ReactElement {
  if (error) {
    return (
      <div className="flex-1 px-4 py-6 text-sm text-rose-200">
        Errore caricando lo storico: {error}
      </div>
    );
  }
  if (!tree.nodes.length) {
    return (
      <div className="flex-1 px-4 py-10 text-center text-sm text-slate-400">
        Nessuna chiamata IA registrata finora.
      </div>
    );
  }
  return (
    <div className="flex-1 overflow-auto p-3">
      <ul className="flex flex-col gap-2">
        {tree.nodes.map((node) => (
          <TreeNodeRow
            key={node.id}
            node={node}
            expanded={!!expanded[node.id]}
            onToggle={() => onToggleNode(node.id)}
          />
        ))}
      </ul>
    </div>
  );
}

function DialogFooter({
  exchangeRateUsdToEur,
  totalCalls,
  totalEur,
  taskGroups,
}: {
  exchangeRateUsdToEur: number | null;
  totalCalls: number;
  totalEur: number | null;
  taskGroups: number;
}): React.ReactElement {
  return (
    <footer className="flex items-center justify-between gap-3 border-t border-slate-700/70 px-4 py-2 text-[11px] text-slate-400">
      <span>
        {taskGroups} macro-task · {totalCalls} chiamata{totalCalls === 1 ? '' : 'e'} totali
      </span>
      <span className="flex items-center gap-3 tabular-nums">
        <span>
          Totale:{' '}
          <span className="font-bold text-violet-200">{formatEur(totalEur)}</span>
        </span>
        <span>
          {exchangeRateUsdToEur !== null
            ? `Cambio: 1 USD = ${exchangeRateUsdToEur.toFixed(4)} EUR`
            : 'Cambio EUR n/d'}
        </span>
      </span>
    </footer>
  );
}
