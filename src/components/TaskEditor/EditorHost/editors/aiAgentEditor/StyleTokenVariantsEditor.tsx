/**
 * Editor compatto per le varianti di uno style token «…».
 */

import React from 'react';
import { Plus, X } from 'lucide-react';
import type { AIAgentPhraseStyleToken } from '@domain/useCaseBundle/schema';

export type StyleTokenVariantsEditorProps = {
  token: AIAgentPhraseStyleToken;
  disabled?: boolean;
  onChange: (variants: string[]) => void;
};

export function StyleTokenVariantsEditor({
  token,
  disabled = false,
  onChange,
}: StyleTokenVariantsEditorProps): React.ReactElement {
  const [draft, setDraft] = React.useState<string[]>(() => [...token.variants]);

  React.useEffect(() => {
    setDraft([...token.variants]);
  }, [token.styleTokenId, token.variants]);

  const commit = React.useCallback(
    (next: string[]) => {
      const cleaned = next.map((v) => v.trim()).filter(Boolean);
      if (cleaned.length === 0) return;
      setDraft(cleaned);
      onChange(cleaned);
    },
    [onChange]
  );

  return (
    <div className="mt-1.5 w-full min-w-[12rem] space-y-1 border-t border-sky-700/35 pt-1.5">
      <p className="text-[9px] font-semibold uppercase tracking-wide text-sky-200/75">
        Varianti stile
      </p>
      <ul className="space-y-0.5">
        {draft.map((line, i) => (
          <li key={`${token.styleTokenId}-${i}`} className="flex items-center gap-0.5">
            <input
              type="text"
              disabled={disabled}
              value={line}
              onChange={(e) => {
                const next = [...draft];
                next[i] = e.target.value;
                setDraft(next);
              }}
              onBlur={() => commit(draft)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commit(draft);
                }
              }}
              className="min-w-0 flex-1 rounded border border-sky-700/40 bg-sky-950/50 px-1.5 py-0.5 text-[10px] text-sky-50 placeholder:text-sky-400/50 focus:border-sky-500/60 focus:outline-none disabled:opacity-50"
              aria-label={`Variante ${i + 1}`}
            />
            <button
              type="button"
              disabled={disabled || draft.length <= 1}
              title="Rimuovi variante"
              className="rounded p-0.5 text-sky-300/80 hover:bg-sky-900/60 disabled:opacity-30"
              onClick={() => commit(draft.filter((_, j) => j !== i))}
            >
              <X size={11} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={disabled}
        className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] text-sky-200/90 hover:bg-sky-900/50 disabled:opacity-40"
        onClick={() => commit([...draft, ''])}
      >
        <Plus size={11} aria-hidden />
        Aggiungi variante
      </button>
    </div>
  );
}
