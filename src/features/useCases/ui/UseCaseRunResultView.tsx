import React from 'react';
import type { UseCaseRunResult } from '../model';

/**
 * Render-only regression result list.
 */
export function UseCaseRunResultView({ results }: { results: UseCaseRunResult[] }) {
  const [expandedIndex, setExpandedIndex] = React.useState<number | null>(null);
  if (!results.length) {
    return <div className="text-xs text-slate-500">No run results yet.</div>;
  }
  return (
    <div className="space-y-1">
      {results.map((r) => {
        const expanded = expandedIndex === r.stepIndex;
        return (
          <div key={r.stepIndex} className="rounded border border-slate-700 bg-slate-900/50">
            <button
              type="button"
              className="w-full text-left px-2 py-1 text-xs flex items-center justify-between"
              onClick={() => setExpandedIndex(expanded ? null : r.stepIndex)}
            >
              <span className="truncate">{r.stepIndex + 1}. {r.utterance}</span>
              <span className={r.ok ? 'text-emerald-400' : 'text-amber-400'}>{r.ok ? 'OK' : 'WARN'}</span>
            </button>
            {expanded && !r.ok ? (
              <div className="px-2 pb-2 text-[11px] text-slate-200 space-y-1">
                <DiffRow label="botResponse" expected={r.diff.botResponse.expected} actual={r.diff.botResponse.actual} />
                <DiffRow label="semanticValue" expected={r.diff.semanticValue.expected} actual={r.diff.semanticValue.actual} />
                <DiffRow label="linguisticValue" expected={r.diff.linguisticValue.expected} actual={r.diff.linguisticValue.actual} />
                <DiffRow label="grammar.type" expected={r.diff.grammarType.expected} actual={r.diff.grammarType.actual} />
                <DiffRow label="grammar.contract" expected={r.diff.grammarContract.expected} actual={r.diff.grammarContract.actual} />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function DiffRow({ label, expected, actual }: { label: string; expected: string; actual: string }) {
  if (expected === actual) return null;
  return (
    <div>
      <div className="text-slate-400">{label}</div>
      <div className="text-slate-300">prev: {expected || '(empty)'}</div>
      <div className="text-amber-200">curr: {actual || '(empty)'}</div>
    </div>
  );
}

