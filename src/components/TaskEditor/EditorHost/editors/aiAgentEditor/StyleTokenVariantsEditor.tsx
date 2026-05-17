/**
 * Editor compatto per le varianti di uno style token «…».
 */

import React from 'react';
import { Eraser, Plus } from 'lucide-react';
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
  const inputRefs = React.useRef<Array<HTMLInputElement | null>>([]);

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

  const focusRow = React.useCallback((index: number) => {
    requestAnimationFrame(() => {
      inputRefs.current[index]?.focus();
    });
  }, []);

  const addVariantAfter = React.useCallback(
    (index: number, currentValue: string) => {
      const next = [...draft];
      next[index] = currentValue;
      const insertAt = index + 1;
      const withNew = [...next.slice(0, insertAt), '', ...next.slice(insertAt)];
      setDraft(withNew);
      focusRow(insertAt);
    },
    [draft, focusRow]
  );

  return (
    <div className="mt-1.5 w-full min-w-[13rem] border-t border-sky-700/35 pt-1.5">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-sky-200/90">
        Varianti stile
      </p>
      <ul className="m-0 list-none space-y-1 p-0">
        {draft.map((line, i) => (
          <li
            key={`${token.styleTokenId}-${i}`}
            className="grid grid-cols-[minmax(0,1fr)_1.25rem] items-center gap-1"
          >
            <input
              ref={(el) => {
                inputRefs.current[i] = el;
              }}
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
                  addVariantAfter(i, e.currentTarget.value);
                  return;
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  setDraft([...token.variants]);
                }
              }}
              className="box-border w-full min-w-0 rounded border border-sky-700/40 bg-sky-950/50 px-2 py-1 text-xs leading-snug text-sky-50 placeholder:text-sky-400/50 focus:border-sky-500/60 focus:outline-none disabled:opacity-50"
              aria-label={`Variante ${i + 1}`}
            />
            <button
              type="button"
              disabled={disabled || draft.length <= 1}
              title="Rimuovi variante"
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-sky-300/80 hover:bg-sky-900/60 disabled:opacity-30"
              onClick={() => commit(draft.filter((_, j) => j !== i))}
            >
              <Eraser size={14} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={disabled}
        className="mt-1.5 inline-flex items-center gap-1 rounded px-1 py-0.5 text-xs font-medium text-sky-200/90 hover:bg-sky-900/50 disabled:opacity-40"
        onClick={() => {
          const next = [...draft, ''];
          setDraft(next);
          focusRow(next.length - 1);
        }}
      >
        <Plus size={14} aria-hidden />
        Aggiungi variante
      </button>
    </div>
  );
}
