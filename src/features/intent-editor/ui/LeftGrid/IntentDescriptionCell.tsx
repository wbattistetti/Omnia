/**
 * Intent business description: missing state, inline edit on hover with confirm/cancel.
 */
import React, { useState, useEffect } from 'react';
import { Check, Pencil, X } from 'lucide-react';

type IntentDescriptionCellProps = {
  intentId: string;
  description: string | undefined;
  onSave: (intentId: string, next: string) => void;
};

export function IntentDescriptionCell({ intentId, description, onSave }: IntentDescriptionCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(description ?? '');
  const [hover, setHover] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(description ?? '');
  }, [description, editing]);

  const hasDesc = Boolean(description?.trim());

  const commit = () => {
    onSave(intentId, draft.trim());
    setEditing(false);
  };

  const cancel = () => {
    setDraft(description ?? '');
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex flex-col gap-1 w-full min-w-0">
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          rows={3}
          className="w-full text-xs rounded border border-amber-400 bg-white text-slate-800 p-1.5 resize-y min-h-[52px]"
          placeholder="Describe what this intent covers (domain, tone, examples of problems)…"
          autoFocus
        />
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="p-0.5 rounded bg-emerald-600 text-white hover:bg-emerald-700"
            title="Save"
            onClick={commit}
          >
            <Check size={14} />
          </button>
          <button
            type="button"
            className="p-0.5 rounded bg-slate-200 text-slate-800 hover:bg-slate-300"
            title="Cancel"
            onClick={cancel}
          >
            <X size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative w-full min-w-0 group/desc"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="flex items-start gap-1">
        <div className="flex-1 min-w-0 text-[11px] leading-snug">
          {hasDesc ? (
            <span className="text-slate-600 whitespace-pre-wrap break-words">{description}</span>
          ) : (
            <span className="text-red-600 font-medium">Description is missing</span>
          )}
        </div>
        {(hover || !hasDesc) && (
          <button
            type="button"
            className="shrink-0 p-0.5 rounded text-slate-500 hover:bg-amber-100 hover:text-slate-800"
            title="Edit description"
            onClick={() => {
              setDraft(description ?? '');
              setEditing(true);
            }}
          >
            <Pencil size={12} />
          </button>
        )}
      </div>
    </div>
  );
}
