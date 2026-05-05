/**
 * Accordion diagnostica BackendCall (mockTable) nel debugger flusso conversazionale.
 */
import React from 'react';
import { ChevronDown } from 'lucide-react';
import type {
  FlowBackendCallInvocation,
  FlowBackendParamRow,
} from '@features/debugger/types/flowBackendCallDiagnostic';

type ParamTreeNode = {
  segment: string;
  pathKey: string;
  directValues: unknown[];
  children: ParamTreeNode[];
};

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function buildParamTree(rows: FlowBackendParamRow[]): ParamTreeNode[] {
  type MutableNode = {
    segment: string;
    pathKey: string;
    directValues: unknown[];
    children: Map<string, MutableNode>;
  };
  const root = new Map<string, MutableNode>();
  for (const row of rows) {
    const rawName = String(row.name || '').trim();
    if (!rawName) continue;
    const segments = rawName
      .split('.')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!segments.length) continue;
    let path = '';
    let map = root;
    for (let i = 0; i < segments.length; i += 1) {
      const seg = segments[i];
      path = path ? `${path}.${seg}` : seg;
      let node = map.get(seg);
      if (!node) {
        node = {
          segment: seg,
          pathKey: path,
          directValues: [],
          children: new Map(),
        };
        map.set(seg, node);
      }
      if (i === segments.length - 1) {
        node.directValues.push(row.value);
      }
      map = node.children;
    }
  }
  const toArray = (m: Map<string, MutableNode>): ParamTreeNode[] =>
    [...m.values()]
      .sort((a, b) => a.segment.localeCompare(b.segment, undefined, { sensitivity: 'base' }))
      .map((n) => ({
        segment: n.segment,
        pathKey: n.pathKey,
        directValues: n.directValues,
        children: toArray(n.children),
      }));
  return toArray(root);
}

function ParamTreeItem(props: { node: ParamTreeNode; depth: number }) {
  const { node, depth } = props;
  const hasChildren = node.children.length > 0;
  const valueText =
    node.directValues.length === 0
      ? null
      : formatValue(node.directValues.length === 1 ? node.directValues[0] : node.directValues);
  if (!hasChildren) {
    return (
      <li className="rounded bg-slate-50/90 px-2 py-1 dark:bg-slate-950/40">
        <div className="flex items-start justify-between gap-2">
          <span className="shrink-0 text-slate-600 dark:text-slate-400">{node.segment}</span>
          <span className="min-w-0 break-all text-right">{valueText ?? '—'}</span>
        </div>
      </li>
    );
  }
  return (
    <li className="space-y-1">
      <details open={depth < 1} className="rounded bg-slate-50/70 px-2 py-1 dark:bg-slate-950/30">
        <summary className="cursor-pointer text-slate-700 dark:text-slate-300">
          <span>{node.segment}</span>
          {valueText ? <span className="ml-2 text-slate-500 dark:text-slate-400">: {valueText}</span> : null}
        </summary>
        <ul className="mt-1 space-y-1 border-l border-slate-300/60 pl-2 dark:border-slate-600/60">
          {node.children.map((ch) => (
            <ParamTreeItem key={ch.pathKey} node={ch} depth={depth + 1} />
          ))}
        </ul>
      </details>
    </li>
  );
}

function OutcomeBadge(props: { outcome: FlowBackendCallInvocation['outcome'] }) {
  const { outcome } = props;
  const styles: Record<typeof outcome, string> = {
    success:
      'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100',
    no_match:
      'bg-amber-100 text-amber-950 dark:bg-amber-900/40 dark:text-amber-100',
    ambiguous: 'bg-red-100 text-red-950 dark:bg-red-900/45 dark:text-red-50',
    no_mock: 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100',
  };
  const labels: Record<typeof outcome, string> = {
    success: 'ok',
    no_match: 'nessuna riga',
    ambiguous: 'ambiguo',
    no_mock: 'solo endpoint',
  };
  return (
    <span
      className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${styles[outcome]}`}
    >
      {labels[outcome]}
    </span>
  );
}

function ExpandableParamSection(props: {
  title: string;
  rows: FlowBackendParamRow[];
}) {
  const { title, rows } = props;
  const tree = React.useMemo(() => buildParamTree(rows), [rows]);

  return (
    <div className="space-y-1">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
        {title}
      </div>
      {rows.length === 0 ? (
        <p className="text-[11px] italic text-slate-500 dark:text-slate-500">(nessuno)</p>
      ) : null}
      {rows.length > 0 ? (
        <ul className="space-y-1 font-mono text-[11px] text-slate-800 dark:text-slate-200">
          {tree.map((n) => (
            <ParamTreeItem key={n.pathKey} node={n} depth={0} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function FlowBackendCallInvocationsPanel(props: { invocations: FlowBackendCallInvocation[] }) {
  const { invocations } = props;
  if (!invocations.length) return null;

  return (
    <div className="mt-2 space-y-2 w-full max-w-xs lg:max-w-md xl:max-w-xl">
      {invocations.map((inv, idx) => (
        <details
          key={`${inv.taskId}-${idx}`}
          className="group rounded-lg border border-slate-200 bg-white/90 text-xs shadow-sm dark:border-slate-600 dark:bg-slate-900/50"
        >
          <summary className="cursor-pointer list-none px-3 py-2 font-medium text-slate-800 dark:text-slate-100 [&::-webkit-details-marker]:hidden">
            <div className="flex flex-wrap items-center gap-2">
              <ChevronDown
                size={14}
                className="shrink-0 text-slate-500 transition-transform group-open:rotate-180 dark:text-slate-400"
                aria-hidden
              />
              <span className="inline-flex items-center rounded border border-violet-300 bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-900 dark:border-violet-600 dark:bg-violet-950/50 dark:text-violet-100">
                backend
              </span>
              <span>
                Chiamata <span className="font-semibold">{inv.displayName}</span>
              </span>
              <OutcomeBadge outcome={inv.outcome} />
            </div>
          </summary>
          <div className="border-t border-slate-200 px-3 py-2 space-y-3 dark:border-slate-700">
            {(inv.endpoint || inv.method) && (
              <div className="text-[11px] text-slate-600 dark:text-slate-400">
                <span className="font-semibold text-slate-700 dark:text-slate-200">{inv.method || 'POST'}</span>
                {inv.endpoint ? (
                  <span className="ml-2 break-all font-mono text-slate-800 dark:text-slate-200">
                    {inv.endpoint}
                  </span>
                ) : (
                  <span className="ml-2 italic">(endpoint non definito in compilato)</span>
                )}
              </div>
            )}
            {inv.matchedRowId ? (
              <div className="text-[11px] text-slate-600 dark:text-slate-400">
                Riga mock: <span className="font-mono text-slate-800 dark:text-slate-200">{inv.matchedRowId}</span>
              </div>
            ) : null}
            {inv.errorMessage ? (
              <div className="rounded-md border border-red-300 bg-red-50 px-2 py-1.5 text-[11px] text-red-900 dark:border-red-700 dark:bg-red-950/40 dark:text-red-100">
                {inv.errorMessage}
              </div>
            ) : null}
            <ExpandableParamSection
              title="Parametri di input"
              rows={inv.inputParameters}
            />
            <ExpandableParamSection
              title="Parametri di output"
              rows={inv.outputParameters}
            />
          </div>
        </details>
      ))}
    </div>
  );
}
