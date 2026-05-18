/**
 * Lateral chat for KB document clarification and rule refinement hints.
 */

import React from 'react';
import type { KbChatMessage } from '@domain/knowledgeBase/kbRuleTypes';
import { Loader2, Send } from 'lucide-react';

export type KbDocumentChatPanelProps = {
  messages: readonly KbChatMessage[];
  busy?: boolean;
  disabled?: boolean;
  /** Shown as placeholder when disabled (e.g. missing model). */
  disabledHint?: string;
  onSend: (text: string) => void | Promise<void>;
  className?: string;
};

export function KbDocumentChatPanel({
  messages,
  busy = false,
  disabled = false,
  disabledHint,
  onSend,
  className = '',
}: KbDocumentChatPanelProps): React.ReactElement {
  const [draft, setDraft] = React.useState('');
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, busy]);

  const submit = React.useCallback(() => {
    const text = draft.trim();
    if (!text || disabled || busy) return;
    setDraft('');
    void onSend(text);
  }, [draft, disabled, busy, onSend]);

  return (
    <div className={'flex min-h-0 flex-col rounded-md border border-slate-800 bg-slate-950/60 ' + className}>
      <div className="border-b border-slate-800 px-2 py-1 text-inherit font-medium uppercase tracking-wide text-slate-500">
        Chat
      </div>
      <div className="min-h-[120px] flex-1 overflow-y-auto p-2 space-y-2">
        {messages.length === 0 ? (
          <p className="text-inherit text-slate-500">Domande sul documento e sulle regole.</p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={
                'rounded-md px-2 py-1 text-inherit leading-relaxed ' +
                (m.role === 'user'
                  ? 'ml-4 bg-violet-950/50 text-violet-100'
                  : 'mr-4 bg-slate-900 text-slate-300')
              }
            >
              {m.content}
            </div>
          ))
        )}
        {busy ? (
          <div className="flex items-center gap-2 text-inherit text-slate-400">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            Risposta…
          </div>
        ) : null}
        <div ref={endRef} />
      </div>
      <div className="relative z-10 flex shrink-0 gap-1 border-t border-slate-800 bg-slate-950/95 p-1.5">
        <textarea
          rows={2}
          value={draft}
          disabled={disabled || busy}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={
            disabled && disabledHint
              ? disabledHint
              : disabledHint
                ? `${disabledHint} — poi Invio per inviare`
                : 'Scrivi un messaggio… (Invio per inviare)'
          }
          className="min-h-[2.5rem] min-w-0 flex-1 resize-none rounded border border-slate-700 bg-slate-900 px-2 py-1 text-inherit text-slate-200 focus:border-violet-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="Messaggio chat KB"
        />
        <button
          type="button"
          disabled={disabled || busy || !draft.trim()}
          onClick={submit}
          className="shrink-0 self-end rounded-md border border-violet-600/60 bg-violet-950/50 px-2 py-1 text-violet-200 hover:bg-violet-900/50 disabled:opacity-50"
          aria-label="Invia"
        >
          <Send className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
