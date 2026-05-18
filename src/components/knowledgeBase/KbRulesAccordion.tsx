/**
 * Accordion list of induced KB rules (title in header, actions on header).
 */

import React from 'react';
import type { KbInducedRule } from '@domain/knowledgeBase/kbRuleTypes';
import { ChevronDown, ChevronRight, ThumbsDown, ThumbsUp, Trash2 } from 'lucide-react';

export type KbRulesAccordionProps = {
  rules: readonly KbInducedRule[];
  disabled?: boolean;
  onChange: (rules: KbInducedRule[]) => void;
  emptyHint?: string;
  className?: string;
};

export function KbRulesAccordion({
  rules,
  disabled = false,
  onChange,
  emptyHint = 'Avvia la chat per estrarre le regole guidate dal documento.',
  className = '',
}: KbRulesAccordionProps): React.ReactElement {
  const visible = rules.filter((r) => !r.deleted);
  const [openIds, setOpenIds] = React.useState<Set<string>>(() => new Set());

  const patchRule = React.useCallback(
    (id: string, patch: Partial<KbInducedRule>) => {
      onChange(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    },
    [rules, onChange]
  );

  const toggleOpen = React.useCallback((id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  if (visible.length === 0) {
    return (
      <p
        className={
          'rounded-md border border-dashed border-slate-700 px-3 py-4 text-center text-inherit text-slate-500 ' +
          className
        }
      >
        {emptyHint}
      </p>
    );
  }

  return (
    <ul className={'space-y-1 overflow-y-auto ' + className}>
      {visible.map((rule) => {
        const open = openIds.has(rule.id);
        const headerTitle = rule.title?.trim() || rule.rule.slice(0, 80);
        return (
          <li
            key={rule.id}
            className="rounded-md border border-slate-800 bg-slate-900/50 text-inherit text-slate-300"
          >
            <div className="flex items-start gap-1 px-2 py-1.5">
              <button
                type="button"
                onClick={() => toggleOpen(rule.id)}
                className="mt-0.5 shrink-0 rounded p-0.5 text-slate-500 hover:bg-slate-800"
                aria-expanded={open}
              >
                {open ? (
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                )}
              </button>
              <input
                type="checkbox"
                checked={rule.included}
                disabled={disabled}
                onChange={(e) => patchRule(rule.id, { included: e.target.checked })}
                className="mt-1 shrink-0"
                aria-label={`Includi ${headerTitle}`}
              />
              <button
                type="button"
                onClick={() => toggleOpen(rule.id)}
                className="min-w-0 flex-1 text-left font-medium text-slate-100"
              >
                {headerTitle}
              </button>
              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  disabled={disabled}
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
                  aria-label="Valida"
                >
                  <ThumbsUp className="h-3 w-3" aria-hidden />
                </button>
                <button
                  type="button"
                  disabled={disabled}
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
                  aria-label="Rifiuta"
                >
                  <ThumbsDown className="h-3 w-3" aria-hidden />
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => patchRule(rule.id, { deleted: true })}
                  className="rounded p-0.5 text-slate-500 hover:text-rose-400"
                  aria-label="Elimina"
                >
                  <Trash2 className="h-3 w-3" aria-hidden />
                </button>
              </div>
            </div>
            {open ? (
              <div className="space-y-2 border-t border-slate-800/80 px-3 pb-2 pt-1.5">
                <p className="text-slate-300">{rule.rule}</p>
                {rule.evidence ? (
                  <p className="text-slate-500">
                    <span className="font-medium text-slate-400">Evidenza: </span>
                    {rule.evidence}
                  </p>
                ) : null}
                <textarea
                  value={rule.note}
                  disabled={disabled}
                  onChange={(e) => patchRule(rule.id, { note: e.target.value })}
                  rows={2}
                  placeholder="Note…"
                  className="w-full rounded border border-slate-700 bg-slate-950/80 px-1.5 py-1 text-inherit text-slate-200 focus:border-violet-500 focus:outline-none disabled:opacity-60"
                />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
