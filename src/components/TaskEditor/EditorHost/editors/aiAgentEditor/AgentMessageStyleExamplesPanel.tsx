/**
 * Pannello esempi frase stile: checkbox accettazione, toolbar inline, testo azzurro plain.
 */

import React from 'react';
import { Pencil, ThumbsUp, Trash2, X } from 'lucide-react';
import type { AIAgentPhraseStyleExample } from '@domain/useCaseBundle/schema';
import { MAX_STYLE_TOKEN_COMBINATIONS } from '@domain/useCaseBundle/styleTokenCombinatorics';

export type AgentMessageStyleExamplesPanelProps = {
  examples: readonly AIAgentPhraseStyleExample[];
  truncated?: boolean;
  busy?: boolean;
  className?: string;
  onClose?: () => void;
  onAccept: (exampleId: string) => void;
  onToggleAccepted: (exampleId: string, accepted: boolean) => void;
  onEdit: (exampleId: string, plainText: string) => void;
  onRemove: (exampleId: string) => void;
};

const ROW_TOOLBAR =
  'ms-1.5 inline-flex shrink-0 items-center gap-0.5 align-middle opacity-0 transition-opacity group-hover/style-ex-row:opacity-100 group-focus-within/style-ex-row:opacity-100';

export function AgentMessageStyleExamplesPanel({
  examples,
  truncated = false,
  busy = false,
  className = '',
  onClose,
  onAccept,
  onToggleAccepted,
  onEdit,
  onRemove,
}: AgentMessageStyleExamplesPanelProps): React.ReactElement {
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editDraft, setEditDraft] = React.useState('');

  const beginEdit = (ex: AIAgentPhraseStyleExample) => {
    setEditingId(ex.exampleId);
    setEditDraft(ex.plainText);
  };

  const commitEdit = (exampleId: string) => {
    const t = editDraft.trim();
    if (t) onEdit(exampleId, t);
    setEditingId(null);
    setEditDraft('');
  };

  return (
    <div
      className={`relative rounded-md border border-sky-700/40 bg-sky-950/25 px-2.5 py-2 ${className}`.trim()}
      role="region"
      aria-label="Versioni messaggio"
    >
      <div className="mb-1.5 flex items-start gap-2 pr-6">
        <p className="min-w-0 flex-1 text-xs font-semibold text-sky-200/90">
          Versioni messaggio ({examples.length}
          {truncated ? `, max ${MAX_STYLE_TOKEN_COMBINATIONS}` : ''})
        </p>
        {onClose ? (
          <button
            type="button"
            disabled={busy}
            className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-800/90 hover:text-slate-100 disabled:opacity-40"
            title="Chiudi pannello"
            aria-label="Chiudi pannello"
            onClick={onClose}
          >
            <X size={14} aria-hidden />
          </button>
        ) : null}
      </div>
      {examples.length === 0 ? (
        <p className="text-xs text-slate-400">
          Usa la lista per le combinazioni locali, o i pulsanti Magic per la rifinitura / nuove
          formulazioni con IA.
        </p>
      ) : (
        <ol className="m-0 max-h-56 list-none space-y-2 overflow-y-auto p-0">
          {examples.map((ex, index) => (
            <li
              key={ex.exampleId}
              className="group/style-ex-row flex flex-wrap items-baseline gap-x-1 gap-y-1 text-xs leading-snug"
            >
              <span className="shrink-0 tabular-nums text-slate-500">{index + 1}.</span>
              <input
                type="checkbox"
                checked={ex.accepted}
                disabled={busy}
                className="shrink-0 rounded border-sky-600/50 bg-sky-950 text-sky-500"
                title="Includi come esempio accettato"
                aria-label={`Accetta variante ${index + 1}`}
                onChange={(e) => onToggleAccepted(ex.exampleId, e.target.checked)}
              />
              {editingId === ex.exampleId ? (
                <input
                  type="text"
                  autoFocus
                  disabled={busy}
                  value={editDraft}
                  className="min-w-[8rem] flex-1 rounded border border-sky-600/50 bg-sky-950/80 px-1.5 py-0.5 text-xs text-sky-100"
                  onChange={(e) => setEditDraft(e.target.value)}
                  onBlur={() => commitEdit(ex.exampleId)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      commitEdit(ex.exampleId);
                    }
                    if (e.key === 'Escape') {
                      setEditingId(null);
                    }
                  }}
                />
              ) : (
                <span className="min-w-0 whitespace-pre-wrap text-sky-200">{ex.plainText}</span>
              )}
              <span className={ROW_TOOLBAR}>
                <button
                  type="button"
                  disabled={busy}
                  title="Valida e includi come esempio"
                  className={`rounded p-0.5 hover:bg-sky-900/50 disabled:opacity-40 ${
                    ex.accepted ? 'text-emerald-400' : 'text-slate-400'
                  }`}
                  onClick={() => onAccept(ex.exampleId)}
                >
                  <ThumbsUp size={14} aria-hidden />
                </button>
                <button
                  type="button"
                  disabled={busy}
                  title="Modifica a mano"
                  className="rounded p-0.5 text-slate-400 hover:bg-sky-900/50 hover:text-sky-200 disabled:opacity-40"
                  onClick={() => beginEdit(ex)}
                >
                  <Pencil size={14} aria-hidden />
                </button>
                <button
                  type="button"
                  disabled={busy}
                  title="Elimina variante"
                  className="rounded p-0.5 text-slate-400 hover:bg-sky-900/50 hover:text-rose-300 disabled:opacity-40"
                  onClick={() => onRemove(ex.exampleId)}
                >
                  <Trash2 size={14} aria-hidden />
                </button>
              </span>
            </li>
          ))}
        </ol>
      )}
      {truncated ? (
        <p className="mt-1.5 text-[11px] text-sky-300/70">
          Mostrate al massimo {MAX_STYLE_TOKEN_COMBINATIONS} combinazioni locali.
        </p>
      ) : null}
    </div>
  );
}
