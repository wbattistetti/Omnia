/**
 * Sezione costi modelli (LLM + TTS): tabelle per provider (accordion), ordinamento da header, picker lingue TTS.
 */

import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { costPerHour, parseCostPerMin, parseLatencyMs, type ModelCostRow } from './modelCostsCatalog';
import { LanguagesCostPicker } from './LanguagesCostPicker';

type SortField = 'model' | 'latency' | 'costPerMin' | 'costPerHour';
type SortDir = 'asc' | 'desc';

export interface ModelCostsSectionProps {
  llmRows: ModelCostRow[];
  ttsRows: ModelCostRow[];
  onLlmRowsChange: (next: ModelCostRow[]) => void;
  onTtsRowsChange: (next: ModelCostRow[]) => void;
}

function sortedRows(rows: ModelCostRow[], field: SortField, dir: SortDir): ModelCostRow[] {
  const sign = dir === 'asc' ? 1 : -1;
  const copy = [...rows];
  copy.sort((a, b) => {
    if (field === 'model') {
      return sign * a.model.localeCompare(b.model);
    }
    const aN =
      field === 'latency'
        ? parseLatencyMs(a.latency)
        : field === 'costPerMin'
          ? parseCostPerMin(a.costPerMin)
          : costPerHour(a.costPerMin);
    const bN =
      field === 'latency'
        ? parseLatencyMs(b.latency)
        : field === 'costPerMin'
          ? parseCostPerMin(b.costPerMin)
          : costPerHour(b.costPerMin);
    if (aN == null && bN == null) return a.model.localeCompare(b.model);
    if (aN == null) return 1;
    if (bN == null) return -1;
    if (aN === bN) return a.model.localeCompare(b.model);
    return sign * (aN - bN);
  });
  return copy;
}

function barWidth(value: number | null, max: number): string {
  if (value == null || max <= 0) return '0%';
  const pct = Math.min(100, Math.max(4, (value / max) * 100));
  return `${pct.toFixed(1)}%`;
}

function groupRowsByProvider(rows: ModelCostRow[]): Map<string, ModelCostRow[]> {
  const m = new Map<string, ModelCostRow[]>();
  for (const row of rows) {
    const p = String(row.provider || '').trim() || '—';
    const cur = m.get(p) ?? [];
    cur.push(row);
    m.set(p, cur);
  }
  return m;
}

/** Larghezza minima colonna modello (ch) dal nome più lungo in tutta la sezione. */
function maxModelColumnCh(allRows: ModelCostRow[]): number {
  let maxLen = 6;
  for (const r of allRows) {
    maxLen = Math.max(maxLen, String(r.model ?? '').length);
  }
  return Math.min(maxLen + 4, 64);
}

function SortHeader(props: {
  label: string;
  field: SortField;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (f: SortField) => void;
}) {
  const { label, field, sortField, sortDir, onSort } = props;
  const active = sortField === field;
  return (
    <th className="px-1 py-1 text-left font-semibold">
      <button
        type="button"
        onClick={() => onSort(field)}
        className="inline-flex w-full min-w-0 items-center justify-between gap-1 rounded px-0.5 py-0.5 text-left hover:bg-slate-800/60"
      >
        <span className="truncate">{label}</span>
        <span className="inline-flex shrink-0 flex-col items-center leading-none text-slate-500">
          {active ? (
            sortDir === 'asc' ? (
              <ChevronUp size={13} className="text-amber-200/95" aria-hidden />
            ) : (
              <ChevronDown size={13} className="text-amber-200/95" aria-hidden />
            )
          ) : (
            <span className="flex flex-col opacity-55" aria-hidden>
              <ChevronUp size={10} className="-mb-1" />
              <ChevronDown size={10} className="-mt-1" />
            </span>
          )}
        </span>
      </button>
    </th>
  );
}

function ProviderCostAccordion(props: {
  provider: string;
  rows: ModelCostRow[];
  allRows: ModelCostRow[];
  setAllRows: (next: ModelCostRow[]) => void;
  languagesReadonly: boolean;
  modelColMinCh: number;
  showPerfColumns: boolean;
}) {
  const { provider, rows, allRows, setAllRows, languagesReadonly, modelColMinCh, showPerfColumns } = props;
  const [sortField, setSortField] = React.useState<SortField>('model');
  const [sortDir, setSortDir] = React.useState<SortDir>('asc');

  React.useEffect(() => {
    if (!showPerfColumns && sortField !== 'model') {
      setSortField('model');
      setSortDir('asc');
    }
  }, [showPerfColumns, sortField]);

  const onHeaderSort = React.useCallback((f: SortField) => {
    if (f === sortField) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(f);
      setSortDir('asc');
    }
  }, [sortField]);

  const sorted = React.useMemo(() => sortedRows(rows, sortField, sortDir), [rows, sortField, sortDir]);

  const maxLatency = React.useMemo(
    () => Math.max(0, ...sorted.map((r) => parseLatencyMs(r.latency) ?? 0)),
    [sorted]
  );
  const maxCostMin = React.useMemo(
    () => Math.max(0, ...sorted.map((r) => parseCostPerMin(r.costPerMin) ?? 0)),
    [sorted]
  );
  const maxCostHour = React.useMemo(
    () => Math.max(0, ...sorted.map((r) => costPerHour(r.costPerMin) ?? 0)),
    [sorted]
  );

  const patchRow = (id: string, patch: Partial<ModelCostRow>) => {
    setAllRows(allRows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  return (
    <details className="rounded border border-slate-700/60 bg-slate-950/35">
      <summary className="cursor-pointer px-1.5 py-0.5 text-[11px] font-semibold leading-snug text-slate-200 hover:bg-slate-900/50">
        {provider}{' '}
        <span className="font-normal text-slate-500">({rows.length})</span>
      </summary>
      <div className="border-t border-slate-800/80 px-1 py-1">
        <div className="overflow-x-auto rounded border border-slate-700/70">
          <table className="w-full border-collapse text-[10px]">
            <colgroup>
              <col style={{ display: 'none' }} />
              <col style={{ minWidth: `${modelColMinCh}ch`, width: `${modelColMinCh}ch` }} />
              {showPerfColumns ? <col className="w-[5rem]" /> : null}
              {showPerfColumns ? <col className="w-[5rem]" /> : null}
              {showPerfColumns ? <col className="w-[5rem]" /> : null}
              <col className="min-w-[9rem]" />
            </colgroup>
            <thead className="bg-slate-900/80 text-slate-300">
              <tr>
                <th className="hidden p-0" scope="col">
                  <span className="sr-only">Provider</span>
                </th>
                <SortHeader label="Modello" field="model" sortField={sortField} sortDir={sortDir} onSort={onHeaderSort} />
                {showPerfColumns ? (
                  <SortHeader label="Latenza" field="latency" sortField={sortField} sortDir={sortDir} onSort={onHeaderSort} />
                ) : null}
                {showPerfColumns ? (
                  <SortHeader label="$/min" field="costPerMin" sortField={sortField} sortDir={sortDir} onSort={onHeaderSort} />
                ) : null}
                {showPerfColumns ? (
                  <SortHeader label="$/h" field="costPerHour" sortField={sortField} sortDir={sortDir} onSort={onHeaderSort} />
                ) : null}
                <th className="px-1 py-1 text-left font-semibold">Lingue</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => {
                const latencyMs = parseLatencyMs(row.latency);
                const cpm = parseCostPerMin(row.costPerMin);
                const cph = costPerHour(row.costPerMin);
                return (
                  <tr key={row.id} className="border-t border-slate-800/70 bg-slate-950/45 align-top">
                    <td className="hidden p-0">
                      <label className="sr-only" htmlFor={`cost-provider-${row.id}`}>
                        Provider
                      </label>
                      <input
                        id={`cost-provider-${row.id}`}
                        value={row.provider}
                        onChange={(e) => patchRow(row.id, { provider: e.target.value })}
                        className="sr-only"
                      />
                    </td>
                    <td className="px-1 py-1">
                      <div className="relative">
                        <input
                          value={row.model}
                          onChange={(e) => patchRow(row.id, { model: e.target.value })}
                          style={{ minWidth: `${modelColMinCh}ch`, width: '100%' }}
                          className="box-border h-7 max-w-full rounded border border-slate-700 bg-slate-950 px-1 font-mono text-[10px] text-slate-100"
                        />
                        {row.deprecated ? (
                          <span
                            title="deprecated"
                            className="pointer-events-auto absolute -top-1 right-1 inline-flex h-3 min-w-3 items-center justify-center rounded-[2px] border border-amber-300/75 bg-amber-500/90 px-[2px] text-[8px] font-bold leading-none text-slate-900"
                          >
                            !
                          </span>
                        ) : null}
                      </div>
                    </td>
                    {showPerfColumns ? (
                      <td className="px-0.5 py-1">
                        <input
                          value={row.latency}
                          onChange={(e) => patchRow(row.id, { latency: e.target.value })}
                          className="box-border h-7 w-full max-w-[5.25rem] rounded border border-slate-700 bg-slate-950 px-0.5 text-[10px] text-slate-100"
                        />
                        <div className="mt-1 h-1 w-full rounded bg-slate-800">
                          <div
                            className="h-full rounded bg-cyan-400/80"
                            style={{ width: barWidth(latencyMs, maxLatency) }}
                          />
                        </div>
                      </td>
                    ) : null}
                    {showPerfColumns ? (
                      <td className="px-0.5 py-1">
                        <input
                          value={row.costPerMin}
                          onChange={(e) => patchRow(row.id, { costPerMin: e.target.value })}
                          className="box-border h-7 w-full max-w-[5.25rem] rounded border border-slate-700 bg-slate-950 px-0.5 text-[10px] text-slate-100"
                        />
                        <div className="mt-1 h-1 w-full rounded bg-slate-800">
                          <div
                            className="h-full rounded bg-violet-400/80"
                            style={{ width: barWidth(cpm, maxCostMin) }}
                          />
                        </div>
                      </td>
                    ) : null}
                    {showPerfColumns ? (
                      <td className="px-0.5 py-1">
                        <div className="h-7 max-w-[5.25rem] truncate rounded border border-slate-800 bg-slate-950 px-0.5 leading-7 text-slate-200">
                          {cph == null ? '—' : cph.toFixed(4)}
                        </div>
                        <div className="mt-1 h-1 w-full rounded bg-slate-800">
                          <div
                            className="h-full rounded bg-amber-400/75"
                            style={{ width: barWidth(cph, maxCostHour) }}
                          />
                        </div>
                      </td>
                    ) : null}
                    <td className="px-1 py-1">
                      {languagesReadonly ? (
                        <input
                          value={row.languages}
                          readOnly
                          className="h-7 w-full min-w-0 cursor-not-allowed rounded border border-slate-800 bg-slate-900/60 px-1 text-[10px] text-slate-500"
                        />
                      ) : (
                        <LanguagesCostPicker value={row.languages} onChange={(v) => patchRow(row.id, { languages: v })} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  );
}

function CostTablesByProvider(props: {
  rows: ModelCostRow[];
  setRows: (next: ModelCostRow[]) => void;
  languagesReadonly: boolean;
  hidePerfColumnsWhenEmpty?: boolean;
}) {
  const { rows, setRows, languagesReadonly, hidePerfColumnsWhenEmpty = false } = props;
  const grouped = React.useMemo(() => groupRowsByProvider(rows), [rows]);
  const providers = React.useMemo(
    () => [...grouped.keys()].sort((a, b) => a.localeCompare(b)),
    [grouped]
  );
  const modelColMinCh = React.useMemo(() => maxModelColumnCh(rows), [rows]);
  const hasAnyPerfValue = React.useMemo(
    () =>
      rows.some((r) => parseLatencyMs(r.latency) != null || parseCostPerMin(r.costPerMin) != null),
    [rows]
  );
  const showPerfColumns = !hidePerfColumnsWhenEmpty || hasAnyPerfValue;

  return (
    <div className="flex flex-col gap-1">
      {providers.map((p) => (
        <ProviderCostAccordion
          key={p}
          provider={p}
          rows={grouped.get(p) ?? []}
          allRows={rows}
          setAllRows={setRows}
          languagesReadonly={languagesReadonly}
          modelColMinCh={modelColMinCh}
          showPerfColumns={showPerfColumns}
        />
      ))}
    </div>
  );
}

export function ModelCostsSection({
  llmRows,
  ttsRows,
  onLlmRowsChange,
  onTtsRowsChange,
}: ModelCostsSectionProps) {
  return (
    <div className="flex flex-col gap-1">
      <details className="rounded border border-slate-700/80 bg-slate-950/40">
        <summary className="cursor-pointer px-1.5 py-0.5 text-[11px] font-semibold leading-none text-slate-300">
          LLM Costs
        </summary>
        <div className="border-t border-slate-800 px-1.5 py-1">
          <CostTablesByProvider rows={llmRows} setRows={onLlmRowsChange} languagesReadonly />
        </div>
      </details>

      <details className="rounded border border-slate-700/80 bg-slate-950/40">
        <summary className="cursor-pointer px-1.5 py-0.5 text-[11px] font-semibold leading-none text-slate-300">
          TTS Costs
        </summary>
        <div className="border-t border-slate-800 px-1.5 py-1">
          <CostTablesByProvider
            rows={ttsRows}
            setRows={onTtsRowsChange}
            languagesReadonly={false}
            hidePerfColumnsWhenEmpty
          />
        </div>
      </details>
    </div>
  );
}
