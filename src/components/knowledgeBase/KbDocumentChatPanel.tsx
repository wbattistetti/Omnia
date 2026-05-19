/**
 * Lateral chat for KB document clarification and rule refinement hints.
 */

import React from 'react';
import type { KbChatMessage } from '@domain/knowledgeBase/kbRuleTypes';
import { Loader2, Send } from 'lucide-react';
import type { KbChatInteractiveAction } from './KbChatInteractiveBlock';
import { KbChatMessageRow } from './KbChatMessageRow';

const CHAT_INPUT_MIN_ROWS = 2;
const CHAT_INPUT_MAX_HEIGHT_PX = 220;

function resizeChatTextarea(el: HTMLTextAreaElement | null): void {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, CHAT_INPUT_MAX_HEIGHT_PX)}px`;
}

export type KbDocumentChatPanelProps = {
  messages: readonly KbChatMessage[];
  busy?: boolean;
  disabled?: boolean;
  /** Shown as placeholder when disabled (e.g. missing model). */
  disabledHint?: string;
  /** Pre-fills the textarea when set (e.g. consent reply). */
  draftSeed?: string;
  /** Focus textarea when draft is seeded. */
  autoFocusDraft?: boolean;
  /** Increment to focus the input without changing draft. */
  focusInputSignal?: number;
  /** Placeholder for the main input (e.g. hypothesis entry). */
  inputPlaceholder?: string;
  /** Status line below the input (e.g. while IA is analyzing). */
  footerStatus?: string | null;
  onSend: (text: string) => void | Promise<void>;
  onInteractiveAction?: (action: KbChatInteractiveAction) => void;
  className?: string;
  /** Solid background (e.g. dock expanded over reader). */
  opaqueSurface?: boolean;
};

export function KbDocumentChatPanel({
  messages,
  busy = false,
  disabled = false,
  disabledHint,
  draftSeed,
  autoFocusDraft = false,
  focusInputSignal = 0,
  inputPlaceholder,
  footerStatus = null,
  onSend,
  onInteractiveAction,
  className = '',
  opaqueSurface = false,
}: KbDocumentChatPanelProps): React.ReactElement {
  const [draft, setDraft] = React.useState('');
  const endRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (draftSeed === undefined) return;
    setDraft(draftSeed);
    if (autoFocusDraft && !disabled && !busy) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [draftSeed, autoFocusDraft, disabled, busy]);

  React.useEffect(() => {
    if (!focusInputSignal || disabled || busy) return;
    inputRef.current?.focus();
  }, [focusInputSignal, disabled, busy]);

  React.useEffect(() => {
    resizeChatTextarea(inputRef.current);
  }, [draft]);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, footerStatus]);

  const submit = React.useCallback(() => {
    const text = draft.trim();
    if (!text || disabled || busy) return;
    setDraft('');
    requestAnimationFrame(() => resizeChatTextarea(inputRef.current));
    void onSend(text);
  }, [draft, disabled, busy, onSend]);

  const resolvedPlaceholder = React.useMemo(() => {
    if (inputPlaceholder?.trim()) return inputPlaceholder.trim();
    if (disabled && disabledHint) return disabledHint;
    if (disabledHint) return `${disabledHint} — poi Invio per inviare`;
    return 'Scrivi un messaggio… (Invio per inviare)';
  }, [inputPlaceholder, disabled, disabledHint]);

  const footer = footerStatus?.trim();
  const activeInteractiveId = React.useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m?.interactive) return m.id;
    }
    return null;
  }, [messages]);
  const panelBg = opaqueSurface ? 'bg-slate-950' : 'bg-slate-950/60';
  const footerBg = opaqueSurface ? 'bg-slate-950' : 'bg-slate-950/95';
  const statusBg = opaqueSurface ? 'bg-slate-950' : 'bg-slate-950/90';

  return (
    <div
      className={
        'flex min-h-0 flex-col rounded-md border border-slate-800 text-inherit ' +
        panelBg +
        ' ' +
        className
      }
    >
      <div
        className={
          'border-b border-slate-800 px-2 py-1 font-medium uppercase tracking-wide text-slate-500 ' +
          (opaqueSurface ? 'bg-slate-950' : '')
        }
      >
        Chat
      </div>
      <div
        className={
          'min-h-0 flex-1 overflow-y-auto p-2 space-y-3 ' +
          (opaqueSurface ? 'bg-slate-950' : 'bg-slate-950/50')
        }
        role="list"
        aria-label="Conversazione KB"
      >
        {messages.length === 0 ? (
          <p className="text-slate-500">Domande sul documento e sulle regole.</p>
        ) : (
          messages.map((m) => (
            <KbChatMessageRow
              key={m.id}
              message={m}
              opaqueSurface={opaqueSurface}
              interactiveActive={m.id === activeInteractiveId}
              busy={busy}
              onInteractiveAction={onInteractiveAction}
            />
          ))
        )}
        <div ref={endRef} />
      </div>
      <div className={'relative z-10 flex shrink-0 gap-1 border-t border-slate-800 p-1.5 ' + footerBg}>
        <textarea
          ref={inputRef}
          rows={CHAT_INPUT_MIN_ROWS}
          value={draft}
          disabled={disabled || busy}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={resolvedPlaceholder}
          className="min-h-[2.5rem] max-h-[220px] min-w-0 flex-1 resize-none overflow-y-auto rounded border border-slate-700 bg-slate-900 px-2 py-1 text-inherit text-slate-200 focus:border-violet-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
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
      {footer ? (
        <div className={'flex shrink-0 items-center gap-2 border-t border-slate-800/80 px-2 py-1.5 text-slate-400 ' + statusBg}>
          {busy ? <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden /> : null}
          <span>{footer}</span>
        </div>
      ) : null}
    </div>
  );
}
