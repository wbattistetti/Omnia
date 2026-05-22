/**
 * Review portal — Conversation tab: rules (read-only) + style notes (editable).
 */

import React from 'react';
import type { AgentReviewConversationSnapshot } from '@omnia/domain-core/review/reviewSnapshots';

export interface ReviewConversationPanelProps {
  snapshot: AgentReviewConversationSnapshot | null;
  onStyleLearningNotesChange?: (notes: string) => void;
}

export function ReviewConversationPanel({
  snapshot,
  onStyleLearningNotesChange,
}: ReviewConversationPanelProps): React.ReactElement {
  if (!snapshot) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-500">
        Nessun dato conversazione in questa review. Configura stile e regole in Omnia e ripubblica.
      </div>
    );
  }

  const rules = snapshot.conversationalRules ?? [];
  const styleIds = Object.keys(snapshot.styleSelections ?? {});

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-3">
      <section className="rounded-lg border border-slate-700/80 bg-slate-900/40 p-3">
        <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-emerald-400/90">
          Stile conversazione
        </h2>
        <p className="text-xs text-slate-400">
          Stile globale:{' '}
          <span className="text-slate-200">{snapshot.globalStyleId || '—'}</span>
          {snapshot.styleAuto ? ' · Omnia sceglie automaticamente' : ''}
        </p>
        <label className="mt-3 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Note stile (apprendimento)
        </label>
        {onStyleLearningNotesChange ? (
          <textarea
            className="mt-1 w-full min-h-[72px] rounded border border-slate-600 bg-slate-950/80 px-2 py-1.5 text-sm text-slate-100"
            value={snapshot.styleLearningNotes}
            onChange={(e) => onStyleLearningNotesChange(e.target.value)}
            placeholder="Note per la prossima generazione…"
          />
        ) : (
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-300">
            {snapshot.styleLearningNotes.trim() || (
              <span className="italic text-slate-500">Nessuna nota.</span>
            )}
          </p>
        )}
      </section>

      {styleIds.length > 0 ? (
        <section>
          <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Stili attivi
          </h2>
          <ul className="space-y-2">
            {styleIds.map((styleId) => {
              const entry = snapshot.styleSelections[styleId]!;
              return (
                <li
                  key={styleId}
                  className="rounded-lg border border-slate-700/60 bg-slate-900/50 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-100">{styleId}</span>
                    {entry.checked ? (
                      <span className="rounded bg-emerald-900/50 px-1.5 text-[10px] text-emerald-300">
                        attivo
                      </span>
                    ) : null}
                  </div>
                  {entry.description?.trim() ? (
                    <p className="mt-1 text-xs text-slate-400">{entry.description}</p>
                  ) : null}
                  {entry.example?.trim() ? (
                    <pre className="mt-2 whitespace-pre-wrap rounded bg-slate-950/60 p-2 text-[11px] text-slate-400">
                      {entry.example}
                    </pre>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Regole conversazionali
        </h2>
        {rules.length === 0 ? (
          <p className="text-sm text-slate-500">Nessuna regola pubblicata.</p>
        ) : (
          <ul className="space-y-2">
            {rules.map((rule) => (
              <li
                key={rule.id}
                className="rounded-lg border border-slate-700/80 bg-slate-900/50 px-3 py-2.5"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-100">{rule.label}</span>
                  {rule.enabled === false ? (
                    <span className="text-[10px] text-slate-500">disabilitata</span>
                  ) : null}
                </div>
                {rule.scenario?.trim() ? (
                  <p className="mt-1 text-xs text-violet-200/80">{rule.scenario}</p>
                ) : null}
                {rule.exampleMessage?.trim() ? (
                  <p className="mt-1 text-xs italic text-slate-400">{rule.exampleMessage}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
