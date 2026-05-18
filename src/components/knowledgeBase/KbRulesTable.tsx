/**
 * Interactive table of KB induced rules (checkbox, validation, notes).
 */

import React from 'react';
import type { KbInducedRule } from '@domain/knowledgeBase/kbRuleTypes';
import { ThumbsDown, ThumbsUp, Trash2 } from 'lucide-react';

export type KbRulesTableProps = {
  rules: readonly KbInducedRule[];
  disabled?: boolean;
  onChange: (rules: KbInducedRule[]) => void;
};

export function KbRulesTable({
  rules,
  disabled = false,
  onChange,
}: KbRulesTableProps): React.ReactElement {
  const visible = rules.filter((r) => !r.deleted);

  const patchRule = React.useCallback(
    (id: string, patch: Partial<KbInducedRule>) => {
      onChange(
        rules.map((r) => (r.id === id ? { ...r, ...patch } : r))
      );
    },
    [rules, onChange]
  );

  if (visible.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-slate-700 px-3 py-4 text-center text-inherit text-slate-500">
        Nessuna regola. Usa Analyze per estrarre regole dal documento.
      </p>
    );
  }

  return (
    <div className="overflow-auto rounded-md border border-slate-800">
      <table className="w-full min-w-[520px] border-collapse text-left text-inherit">
        <thead>
          <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400">
            <th className="w-8 px-1 py-1.5" aria-label="Includi" />
            <th className="px-2 py-1.5 font-medium">Campo</th>
            <th className="px-2 py-1.5 font-medium">Regola dedotta</th>
            <th className="px-2 py-1.5 font-medium">Evidenza</th>
            <th className="px-2 py-1.5 font-medium min-w-[120px]">Note</th>
            <th className="w-16 px-1 py-1.5" aria-label="Azioni" />
          </tr>
        </thead>
        <tbody>
          {visible.map((rule) => (
            <tr
              key={rule.id}
              className="group border-b border-slate-800/80 hover:bg-slate-900/50"
            >
              <td className="px-1 py-1 align-top">
                <input
                  type="checkbox"
                  checked={rule.included}
                  disabled={disabled}
                  onChange={(e) => patchRule(rule.id, { included: e.target.checked })}
                  aria-label={`Includi regola ${rule.field}`}
                  className="mt-1"
                />
              </td>
              <td className="px-2 py-1 align-top font-medium text-slate-200">{rule.field}</td>
              <td className="px-2 py-1 align-top text-slate-300">{rule.rule}</td>
              <td className="px-2 py-1 align-top text-slate-500">{rule.evidence}</td>
              <td className="px-2 py-1 align-top">
                <textarea
                  value={rule.note}
                  disabled={disabled}
                  onChange={(e) => patchRule(rule.id, { note: e.target.value })}
                  rows={2}
                  className="w-full min-w-[100px] rounded border border-slate-700 bg-slate-950/80 px-1.5 py-1 text-inherit text-slate-200 focus:border-violet-500 focus:outline-none disabled:opacity-60"
                  placeholder="Osservazioni…"
                  aria-label={`Note per ${rule.field}`}
                />
              </td>
              <td className="px-1 py-1 align-top">
                <div className="flex items-center gap-0.5 opacity-70 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    disabled={disabled}
                    title="Valida"
                    aria-pressed={rule.validation === 'up'}
                    onClick={() =>
                      patchRule(rule.id, {
                        validation: rule.validation === 'up' ? null : 'up',
                      })
                    }
                    className={
                      'rounded p-0.5 ' +
                      (rule.validation === 'up'
                        ? 'text-emerald-400'
                        : 'text-slate-500 hover:text-emerald-300')
                    }
                  >
                    <ThumbsUp className="h-3.5 w-3.5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    title="Rifiuta"
                    aria-pressed={rule.validation === 'down'}
                    onClick={() =>
                      patchRule(rule.id, {
                        validation: rule.validation === 'down' ? null : 'down',
                      })
                    }
                    className={
                      'rounded p-0.5 ' +
                      (rule.validation === 'down'
                        ? 'text-rose-400'
                        : 'text-slate-500 hover:text-rose-300')
                    }
                  >
                    <ThumbsDown className="h-3.5 w-3.5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    title="Elimina regola"
                    onClick={() => patchRule(rule.id, { deleted: true })}
                    className="rounded p-0.5 text-slate-500 hover:text-rose-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
