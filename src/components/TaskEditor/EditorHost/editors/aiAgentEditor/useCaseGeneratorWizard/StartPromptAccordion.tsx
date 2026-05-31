/**
 * Accordion Start Prompt (scenario startAgent): frase di apertura sessione, sopra la lista use case.
 */

import React from 'react';
import { Check, ChevronDown, ChevronRight, MessageCircle, Pencil, X } from 'lucide-react';
import type { AgentStartPromptConfig } from '@domain/useCaseGeneratorWizard/agentStartPrompt';
import {
  BracketTokenHighlightedText,
  BracketTokenHighlightedTextarea,
} from '../BracketTokenHighlightedTextarea';
import { resolveAiAgentOutputLanguage } from '../resolveAiAgentOutputLanguage';
import {
  UC_AGENT_ROW_EDIT_BTN,
  UC_CLASSIC_TEXTAREA_AGENT,
  UC_RESPONSE_ICON_COL,
  UC_RESPONSE_ROW_CONTENT,
  UC_WIZARD_AGENT_MESSAGE_TEXT,
} from '../useCaseComposerPresentation';

export type StartPromptAccordionProps = {
  config: AgentStartPromptConfig;
  onChange: (next: AgentStartPromptConfig) => void;
  disabled?: boolean;
};

const INLINE_ACTIONS =
  'inline-flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/startmsg-row:opacity-100 group-focus-within/startmsg-row:opacity-100';

const EDIT_ICON_PX = 21;

function StartPromptMessageField({
  text,
  onCommit,
  disabled = false,
}: {
  text: string;
  onCommit: (next: string) => void;
  disabled?: boolean;
}): React.ReactElement {
  const outputLanguage = resolveAiAgentOutputLanguage().tag;
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(text);

  React.useEffect(() => {
    if (!editing) setDraft(text);
  }, [text, editing]);

  const beginEdit = React.useCallback(() => {
    if (disabled || editing) return;
    setDraft(text);
    setEditing(true);
  }, [disabled, editing, text]);

  const cancelEdit = React.useCallback(() => {
    setEditing(false);
    setDraft(text);
  }, [text]);

  const commitEdit = React.useCallback(() => {
    onCommit(draft);
    setEditing(false);
  }, [draft, onCommit]);

  if (editing) {
    return (
      <div className="flex min-h-[52px] w-full flex-wrap items-center gap-x-[5px] gap-y-2">
        <span className={UC_RESPONSE_ICON_COL} aria-hidden>
          <MessageCircle size={16} className="text-slate-400" />
        </span>
        <div className="min-w-0 flex-1">
          <BracketTokenHighlightedTextarea
            value={draft}
            disabled={disabled}
            rows={2}
            autoFocus
            spellCheck
            lang={outputLanguage}
            aria-label="Frase di apertura"
            placeholder="Es. Buongiorno, sono l'assistente virtuale di …"
            containerClassName={`${UC_CLASSIC_TEXTAREA_AGENT} min-h-[52px] w-full`}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                cancelEdit();
              }
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                commitEdit();
              }
            }}
          />
        </div>
        <span className="inline-flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            title="Conferma"
            disabled={disabled}
            className="rounded p-0.5 text-emerald-400 hover:bg-slate-800/90 disabled:opacity-40"
            onClick={commitEdit}
          >
            <Check size={EDIT_ICON_PX} aria-hidden />
          </button>
          <button
            type="button"
            title="Annulla"
            disabled={disabled}
            className="rounded p-0.5 text-slate-400 hover:bg-slate-800/90 disabled:opacity-40"
            onClick={cancelEdit}
          >
            <X size={EDIT_ICON_PX} aria-hidden />
          </button>
        </span>
      </div>
    );
  }

  return (
    <div
      className="group/startmsg-row flex min-h-[52px] w-full min-w-0 cursor-pointer flex-wrap items-center gap-x-[5px] gap-y-1 rounded py-0"
      onDoubleClick={(e) => {
        if (disabled) return;
        if ((e.target as HTMLElement).closest('button')) return;
        e.preventDefault();
        e.stopPropagation();
        beginEdit();
      }}
    >
      <span className={UC_RESPONSE_ICON_COL} aria-hidden>
        <MessageCircle size={16} className="text-slate-400" />
      </span>
      <div className={`${UC_RESPONSE_ROW_CONTENT} ${UC_WIZARD_AGENT_MESSAGE_TEXT}`}>
        {!text.trim() ? (
          <span className="inline whitespace-pre-wrap text-slate-500">
            — passa il mouse e usa la matita per modificare
          </span>
        ) : (
          <BracketTokenHighlightedText
            text={text}
            className="inline min-w-0 whitespace-pre-wrap"
          />
        )}
        <span className={INLINE_ACTIONS}>
          <button
            type="button"
            disabled={disabled}
            title="Modifica messaggio"
            className={UC_AGENT_ROW_EDIT_BTN}
            onClick={(e) => {
              e.stopPropagation();
              beginEdit();
            }}
          >
            <Pencil size={18} aria-hidden />
          </button>
        </span>
      </div>
    </div>
  );
}

export function StartPromptAccordion({
  config,
  onChange,
  disabled = false,
}: StartPromptAccordionProps): React.ReactElement {
  const [open, setOpen] = React.useState(true);

  const commitText = React.useCallback(
    (text: string) => {
      onChange({ schemaVersion: 1, text });
    },
    [onChange]
  );

  return (
    <div className="shrink-0 rounded-lg border border-cyan-500/35 bg-cyan-950/20 shadow-[inset_0_1px_0_rgba(34,211,238,0.08)]">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-cyan-100/95 hover:bg-cyan-900/25 disabled:opacity-50"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-expanded={open}
      >
        {open ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
        <span>Start Prompt</span>
        <span className="font-normal text-cyan-200/60">(scenario startAgent)</span>
      </button>

      {open ? (
        <div className="space-y-2 border-t border-cyan-500/25 px-3 py-3">
          <p className="text-[11px] leading-relaxed text-slate-400">
            Testo che l&apos;agente pronuncia all&apos;avvio della sessione.
          </p>
          <StartPromptMessageField
            text={config.text}
            onCommit={commitText}
            disabled={disabled}
          />
        </div>
      ) : null}
    </div>
  );
}
