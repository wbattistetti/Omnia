/**
 * Vista strutturata del report readiness OpenAPI / webhook (icone Lucide, colori per severità).
 */

import React, { useState } from 'react';
import { AlertTriangle, Check, ChevronDown, ChevronRight, XCircle } from 'lucide-react';
import type {
  AgentWebhookReadinessReport,
  BackendWebhookReadiness,
  ParameterFieldValues,
  ParameterReadinessEntry,
  ParameterReportField,
  ReadinessSeverity,
} from '@domain/openApi/webhookOpenApiReadiness';
import {
  AGENT_HINT_EXTENSION_KEYS,
  applicableReportFieldsForEntry,
  groupReportEntriesByTree,
  summarizeReadinessGroup,
} from '@domain/openApi/webhookOpenApiReadiness';
import {
  CONVAI_OPTIONAL_EMPTY_STRING_RULE_SHORT,
  CONVAI_OPTIONAL_EMPTY_STRING_RULE_TITLE,
} from '@domain/openApi/convaiOptionalFieldSemantics';
export type WebhookReadinessReportViewProps = {
  readonly report: AgentWebhookReadinessReport;
};

const SEVERITY_STYLES: Record<
  ReadinessSeverity,
  { row: string; icon: string; badge: string; label: string }
> = {
  ok: {
    row: 'border-emerald-800/50 bg-emerald-950/25',
    icon: 'text-emerald-400',
    badge: 'bg-emerald-900/60 text-emerald-200',
    label: 'OK',
  },
  warning: {
    row: 'border-amber-700/55 bg-amber-950/30',
    icon: 'text-amber-400',
    badge: 'bg-amber-900/55 text-amber-100',
    label: 'WARNING',
  },
  blocker: {
    row: 'border-red-800/55 bg-red-950/35',
    icon: 'text-red-400',
    badge: 'bg-red-900/60 text-red-200',
    label: 'BLOCKER',
  },
};

function SeverityIcon({ severity }: { severity: ReadinessSeverity }): React.ReactElement {
  const cls = SEVERITY_STYLES[severity].icon;
  const size = 14;
  if (severity === 'ok') return <Check size={size} className={cls} aria-hidden />;
  if (severity === 'warning') return <AlertTriangle size={size} className={cls} aria-hidden />;
  return <XCircle size={size} className={cls} aria-hidden />;
}

function FieldRow({
  label,
  present,
  value,
}: {
  label: string;
  present: boolean;
  value?: string;
}): React.ReactElement {
  return (
    <div className="flex gap-2 text-[11px] leading-snug">
      <span
        className={[
          'w-[9.5rem] shrink-0 font-medium',
          present ? 'text-emerald-400/95' : 'text-red-400/90',
        ].join(' ')}
      >
        {label}:
      </span>
      {present && value ? (
        <span className="min-w-0 flex-1 break-words text-slate-200" title={value}>
          {value}
        </span>
      ) : present ? (
        <span className="text-slate-400 italic">(presente, valore non estratto)</span>
      ) : (
        <span className="inline-flex items-center gap-1 text-red-300/90">
          <XCircle size={11} aria-hidden />
          (assente)
        </span>
      )}
    </div>
  );
}

function formatEnum(values: string[] | undefined): string | undefined {
  if (!values?.length) return undefined;
  const clip = values.slice(0, 16).join(', ');
  return values.length > 16 ? `${clip}…` : clip;
}

function reportFieldRowProps(
  field: ParameterReportField,
  entry: ParameterReadinessEntry
): { label: string; present: boolean; value?: string } {
  const v: ParameterFieldValues = entry.values;
  switch (field) {
    case 'type':
      return { label: 'type', present: entry.present.type, value: v.type };
    case 'format':
      return { label: 'format', present: entry.present.format, value: v.format };
    case 'enum':
      return { label: 'enum', present: entry.present.enum, value: formatEnum(v.enum) };
    case 'minMax':
      return {
        label: 'min/max',
        present: entry.present.minMax,
        value:
          v.minimum !== undefined || v.maximum !== undefined
            ? `min ${v.minimum ?? '—'} · max ${v.maximum ?? '—'}`
            : undefined,
      };
    case 'pattern':
      return { label: 'pattern', present: entry.present.pattern, value: v.pattern };
    case 'description':
      return { label: 'description', present: entry.present.description, value: v.description };
    case 'xAgentInstructions':
      return {
        label: 'x-agent-instructions',
        present: entry.present.xAgentInstructions,
        value: v.xAgentInstructions,
      };
    case 'xOpenaiIsConsequential':
      return {
        label: 'x-openai-isConsequential',
        present: entry.present.xOpenaiIsConsequential,
        value: v.xOpenaiIsConsequential,
      };
  }
}

function leafPathLabel(path: string, rootKey: string): string {
  if (path === rootKey) return path;
  if (path.startsWith(`${rootKey}.`)) return path.slice(rootKey.length + 1);
  return path;
}

function ParameterEntryCard({
  entry,
  nested = false,
  isContainerHeader = false,
  childCount = 0,
}: {
  entry: ParameterReadinessEntry;
  nested?: boolean;
  isContainerHeader?: boolean;
  childCount?: number;
}): React.ReactElement {
  const st = SEVERITY_STYLES[entry.severity];
  const convai =
    entry.inConvaiTool
      ? 'tool ConvAI'
      : entry.direction === 'send'
        ? 'non in tool'
        : 'solo prompt';
  const reportFields = applicableReportFieldsForEntry(entry);
  const isPassiveOk = entry.auditProfile === 'receive-passive' && entry.severity === 'ok';
  const pathLabel = nested ? leafPathLabel(entry.path, entry.rootKey) : entry.path;
  const containerType = entry.values.type === 'object' || entry.values.type === 'array';

  if (isPassiveOk) {
    return (
      <div
        className={[
          nested ? 'ml-3 border-l border-slate-700/50 pl-2' : '',
          'rounded-md border px-2.5 py-1.5',
          nested ? 'border-transparent bg-slate-900/20' : st.row,
        ].join(' ')}
      >
        <div className="flex flex-wrap items-center gap-2">
          <SeverityIcon severity={entry.severity} />
          <span className={['rounded px-1.5 py-px text-[10px] font-bold uppercase', st.badge].join(' ')}>
            {st.label}
          </span>
          <span className="rounded bg-violet-900/45 px-1 py-px text-[10px] font-semibold uppercase text-violet-200">
            receive
          </span>
          <code className="min-w-0 flex-1 font-mono text-xs text-slate-100">{pathLabel}</code>
          <span className="text-[10px] text-slate-500">{entry.auditNote}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={[
        nested ? 'ml-3 border-l border-slate-700/50 pl-2' : '',
        isContainerHeader ? 'border-0 bg-transparent px-2.5 py-2' : 'rounded-md border px-2.5 py-2',
        !isContainerHeader && !nested ? st.row : '',
        nested && !isContainerHeader ? 'border-transparent bg-slate-900/25 py-1.5' : '',
      ].join(' ')}
    >
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <SeverityIcon severity={entry.severity} />
        <span className={['rounded px-1.5 py-px text-[10px] font-bold uppercase', st.badge].join(' ')}>
          {st.label}
        </span>
        <span
          className={[
            'rounded px-1 py-px text-[10px] font-semibold uppercase',
            entry.direction === 'send' ? 'bg-cyan-900/50 text-cyan-200' : 'bg-violet-900/45 text-violet-200',
          ].join(' ')}
        >
          {entry.direction}
        </span>
        <code className="min-w-0 flex-1 font-mono text-xs text-slate-100" title={entry.path}>
          {pathLabel}
        </code>
        <span className="text-[10px] text-slate-500">({convai})</span>
        {isContainerHeader && childCount > 0 ? (
          <span className="text-[10px] text-cyan-300/80">{childCount} campi annidati</span>
        ) : null}
      </div>

      <p className="mb-1 text-[10px] text-slate-500">
        <span className="text-slate-400">{entry.auditNote}</span>
        {' · '}
        OpenAPI: <span className="text-slate-300">{entry.openapiSummary}</span>
        {entry.direction === 'send' ? (
          <>
            {' '}
            · ElevenLabs: <span className="text-slate-300">{entry.elevenLabsSummary}</span>
          </>
        ) : null}
      </p>

      {containerType && isContainerHeader ? (
        <>
          <div className="space-y-0.5 border-t border-slate-700/40 pt-1.5">
            {reportFields.map((field) => {
              const row = reportFieldRowProps(field, entry);
              return (
                <FieldRow
                  key={field}
                  label={row.label}
                  present={row.present}
                  value={row.value}
                />
              );
            })}
          </div>
          <p className="mt-1 text-[10px] italic text-slate-500">
            Struttura object — audit sui {childCount} campi annidati sotto.
          </p>
        </>
      ) : (
        <div className="space-y-0.5 border-t border-slate-700/40 pt-1.5">
          {reportFields.map((field) => {
            const row = reportFieldRowProps(field, entry);
            return (
              <FieldRow
                key={field}
                label={row.label}
                present={row.present}
                value={row.value}
              />
            );
          })}
        </div>
      )}

      {entry.gaps.length > 0 ? (
        <ul className="mt-2 space-y-0.5 border-t border-slate-700/40 pt-1.5">
          {entry.gaps.map((g) => (
            <li
              key={g}
              className="flex items-start gap-1.5 text-[11px] text-amber-200/95"
            >
              <XCircle size={11} className="mt-0.5 shrink-0 text-red-400" aria-hidden />
              <span>
                <span className="font-semibold text-red-300/90">MANCA:</span> {g}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function collapsedSummaryText(group: ParameterReadinessEntry[]): string {
  const summary = summarizeReadinessGroup(group);
  const root = group[0];
  if (!root) return '';
  const typeHint = root.values.type ? ` · ${root.values.type}` : '';
  if (summary.worst === 'ok') {
    if (root.auditProfile === 'receive-passive') {
      return `Output backend — nessun mapping NL richiesto${typeHint}`;
    }
    if (group.length > 1) {
      return `${group.length} campi — tutti OK${typeHint}`;
    }
    return `Completo${typeHint}`;
  }
  const parts: string[] = [];
  if (summary.blockers) parts.push(`${summary.blockers} blocker`);
  if (summary.warnings) parts.push(`${summary.warnings} warning`);
  const firstGap = group.find((e) => e.gaps[0])?.gaps[0];
  if (firstGap) {
    const clip = firstGap.length > 72 ? `${firstGap.slice(0, 72)}…` : firstGap;
    return `${parts.join(' · ')} — ${clip}`;
  }
  return parts.join(' · ');
}

function EntryAccordion({ group }: { group: ParameterReadinessEntry[] }): React.ReactElement {
  const summary = summarizeReadinessGroup(group);
  const root = group[0];
  const [rootEntry, ...children] = group;
  const defaultOpen = summary.worst !== 'ok';
  const [open, setOpen] = useState(defaultOpen);
  const st = SEVERITY_STYLES[summary.worst];
  const hasChildren = children.length > 0;
  const isPassiveOk =
    group.length === 1 &&
    root.auditProfile === 'receive-passive' &&
    root.severity === 'ok';

  const header = (
    <button
      type="button"
      className={[
        'flex w-full items-start gap-2 rounded-md border px-2.5 py-2 text-left transition-colors',
        st.row,
        'hover:brightness-110',
      ].join(' ')}
      aria-expanded={open}
      onClick={() => setOpen((v) => !v)}
    >
      <span className="mt-0.5 shrink-0 text-slate-400">
        {open ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
      </span>
      <SeverityIcon severity={summary.worst} />
      <span className={['rounded px-1.5 py-px text-[10px] font-bold uppercase', st.badge].join(' ')}>
        {st.label}
      </span>
      <span
        className={[
          'rounded px-1 py-px text-[10px] font-semibold uppercase',
          root.direction === 'send' ? 'bg-cyan-900/50 text-cyan-200' : 'bg-violet-900/45 text-violet-200',
        ].join(' ')}
      >
        {root.direction}
      </span>
      <code className="min-w-0 font-mono text-xs text-slate-100">{root.path}</code>
      {hasChildren ? (
        <span className="text-[10px] text-cyan-300/75">{children.length} annidati</span>
      ) : null}
      {!open ? (
        <span className="min-w-0 flex-1 text-[11px] text-slate-400">{collapsedSummaryText(group)}</span>
      ) : null}
    </button>
  );

  if (isPassiveOk && !open) {
    return header;
  }

  return (
    <div className="space-y-1">
      {header}
      {open ? (
        <div className={['ml-3 space-y-1 border-l border-slate-700/50 pl-2', hasChildren ? 'pt-1' : ''].join(' ')}>
          {hasChildren ? (
            <>
              <ParameterEntryCard entry={rootEntry} isContainerHeader childCount={children.length} />
              {children.map((child) => (
                <ParameterEntryCard key={`${child.direction}:${child.path}`} entry={child} nested />
              ))}
            </>
          ) : (
            <ParameterEntryCard entry={rootEntry} />
          )}
        </div>
      ) : null}
    </div>
  );
}

function BackendSection({ backend }: { backend: BackendWebhookReadiness }): React.ReactElement {
  const hasIssues = backend.blockers > 0 || backend.warnings > 0;
  const [sectionOpen, setSectionOpen] = useState(hasIssues);
  const groups = groupReportEntriesByTree(backend.entries);

  return (
    <section className="space-y-2">
      <button
        type="button"
        className="w-full rounded-md border border-slate-700/60 bg-slate-900/50 px-2.5 py-2 text-left hover:bg-slate-900/70"
        aria-expanded={sectionOpen}
        onClick={() => setSectionOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <span className="text-slate-400">
            {sectionOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
          <h3 className="text-sm font-semibold text-slate-100">{backend.taskLabel}</h3>
          <span className="rounded bg-red-900/50 px-1.5 py-px text-[10px] font-semibold text-red-200">
            {backend.blockers} blocker
          </span>
          <span className="rounded bg-amber-900/50 px-1.5 py-px text-[10px] font-semibold text-amber-100">
            {backend.warnings} warning
          </span>
          {!sectionOpen ? (
            <span className="ml-auto text-[10px] text-slate-500">{backend.entries.length} parametri</span>
          ) : null}
        </div>
        {!sectionOpen ? (
          <p className="mt-1 pl-6 font-mono text-[10px] text-slate-500">task {backend.taskId}</p>
        ) : null}
      </button>

      {sectionOpen ? (
        <>
          <div className="rounded-md border border-slate-700/40 bg-slate-900/30 px-2.5 py-2">
            <p className="font-mono text-[10px] text-slate-500">task {backend.taskId}</p>
            <p className="mt-1 text-[11px] text-slate-400">
              Tool <span className="font-mono text-cyan-200/90">{backend.toolName}</span>
              {' · '}
              import <span className="text-slate-300">{backend.importState}</span>
            </p>
            {backend.deriveToolError ? (
              <p className="mt-1 flex items-start gap-1 text-[11px] text-red-300">
                <XCircle size={12} className="shrink-0" aria-hidden />
                Tool: {backend.deriveToolError}
              </p>
            ) : null}
            {!backend.toolDescriptionOk ? (
              <p className="mt-1 flex items-start gap-1 text-[11px] text-amber-200">
                <AlertTriangle size={12} className="shrink-0" aria-hidden />
                Descrizione tool ConvAI assente o troppo corta
              </p>
            ) : null}
            {!backend.convaiOptionalRuleDocumented ? (
              <p className="mt-1 flex items-start gap-1 text-[11px] text-amber-200">
                <AlertTriangle size={12} className="shrink-0" aria-hidden />
                Regola ConvAI «&quot;&quot; = assente» non documentata — rieseguire «Recupera specifiche» sul
                Backend Call
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            {groups.map((group) => (
              <EntryAccordion key={`${group[0].direction}:${group[0].path}`} group={group} />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}

export function WebhookReadinessReportView({
  report,
}: WebhookReadinessReportViewProps): React.ReactElement {
  if (report.backends.length === 0) {
    return (
      <p className="px-1 text-xs text-slate-500">
        Nessun Backend Call collegato come tool ConvAI. Aggiungi backend in Agent setup o catalogo.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-violet-700/45 bg-violet-950/25 px-3 py-2.5 text-[11px] leading-relaxed text-violet-100/95">
        <p className="font-semibold text-violet-100">{CONVAI_OPTIONAL_EMPTY_STRING_RULE_TITLE}</p>
        <p className="mt-1 text-violet-200/90">{CONVAI_OPTIONAL_EMPTY_STRING_RULE_SHORT}</p>
        <p className="mt-1 text-[10px] text-violet-300/80">
          Vale per tutti i backend tool webhook (agenda-solver, next-window, …). Documentato in OpenAPI al
          «Recupera specifiche» e normalizzato dal gateway Omnia prima del forward.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className="rounded bg-red-900/45 px-2 py-0.5 font-semibold text-red-200">
          {report.totalBlockers} BLOCKER
        </span>
        <span className="rounded bg-amber-900/45 px-2 py-0.5 font-semibold text-amber-100">
          {report.totalWarnings} WARNING
        </span>
        <span className="text-slate-500">
          Extension consigliate: {AGENT_HINT_EXTENSION_KEYS.join(', ')}
        </span>
      </div>
      {report.backends.map((b) => (
        <BackendSection key={b.taskId} backend={b} />
      ))}
    </div>
  );
}
