/**
 * Primary assistant message field for use cases: bracket highlights, tokenize popover,
 * inline toolbar (vote, edit, parametric, variants, delete). Shared by response editor
 * and composer list.
 */

import React from 'react';
import { Check, MessageSquareText, Pencil, Plus, Trash2, Variable, X } from 'lucide-react';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import {
  BracketTokenHighlightedText,
  BracketTokenHighlightedTextarea,
} from '../BracketTokenHighlightedTextarea';
import { AgentMessageSelectionTokenPopover } from '../AgentMessageSelectionTokenPopover';
import { VoteThumbPair } from '../VoteThumbPair';
import { SeedHighlightedText } from '@components/common/SeedHighlightedText';
import { TokenizedHighlightedText } from '../useCaseGeneratorWizard/TokenizedHighlightedText';
import {
  UC_AGENT_ROW_EDIT_BTN,
  UC_AGENT_VOTE_BTN,
  UC_CLASSIC_TEXTAREA_AGENT,
  UC_WIZARD_AGENT_MESSAGE_TEXT,
  fieldTextClass,
} from '../useCaseComposerPresentation';
import { useAgentMessageTextField } from '../useAgentMessageTextField';

export type PrimaryAgentMessageFieldProps = {
  useCase: AIAgentUseCase;
  text: string;
  busy?: boolean;
  wizardCompact?: boolean;
  searchSeed?: string;
  /** When set, read-only view shows tokenized yellow overlay instead of bracket pills. */
  tokenizedDisplayText?: string;
  assistantVote?: 'up' | 'down';
  onAssistantVote?: (choice: 'up' | 'down') => void;
  assistantContentBaseline?: string;
  parametricEnabled?: boolean;
  onToggleParametric?: (enabled: boolean) => void;
  parametricEditor?: React.ReactNode;
  structuralVariantsEditor?: React.ReactNode;
  onAddStructuralVariant?: () => void;
  onDeleteMessage?: () => void;
  onTextChange: (next: string, mode: 'live' | 'silent' | 'commit') => void;
  onPhraseDraftChange?: (draft: string | null) => void;
};

/** Inline toolbar icons: 12px baseline × 1.5. */
const INLINE_TOOLBAR_ICON_PX = 18;
const EDIT_MODE_ICON_PX = 21;

const INLINE_ACTIONS =
  'ms-1 inline-flex shrink-0 items-center gap-0.5 align-baseline opacity-0 transition-opacity group-hover/agentmsg-row:opacity-100 group-focus-within/agentmsg-row:opacity-100';

export function PrimaryAgentMessageField({
  useCase,
  text,
  busy = false,
  wizardCompact = true,
  searchSeed = '',
  tokenizedDisplayText,
  assistantVote,
  onAssistantVote,
  assistantContentBaseline,
  parametricEnabled = false,
  onToggleParametric,
  parametricEditor,
  structuralVariantsEditor,
  onAddStructuralVariant,
  onDeleteMessage,
  onTextChange,
  onPhraseDraftChange,
}: PrimaryAgentMessageFieldProps): React.ReactElement {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(text);

  React.useEffect(() => {
    if (!editing) setDraft(text);
  }, [text, editing]);

  const readOnlyTokenized = Boolean(tokenizedDisplayText?.trim());

  const beginEdit = React.useCallback(() => {
    if (busy || readOnlyTokenized) return;
    setDraft(text);
    setEditing(true);
    onPhraseDraftChange?.(text);
  }, [busy, readOnlyTokenized, text, onPhraseDraftChange]);

  const cancelEdit = React.useCallback(() => {
    setEditing(false);
    setDraft(text);
    onPhraseDraftChange?.(null);
  }, [text, onPhraseDraftChange]);

  const commitEdit = React.useCallback(() => {
    onTextChange(draft, 'commit');
    setEditing(false);
    onPhraseDraftChange?.(null);
  }, [draft, onTextChange, onPhraseDraftChange]);

  const tokenField = useAgentMessageTextField({
    text: draft,
    disabled: busy,
    isEditing: editing,
    onTextChange: (next, mode) => {
      setDraft(next);
      onPhraseDraftChange?.(next);
      if (mode !== 'live') {
        onTextChange(next, mode);
      }
    },
  });

  const fieldLabel = wizardCompact ? (
    <span
      title="Messaggio agente"
      aria-label="Messaggio agente"
      className="shrink-0 inline-flex h-6 w-6 items-center justify-center text-emerald-300"
    >
      <MessageSquareText size={15} aria-hidden />
    </span>
  ) : null;

  const displayTextClass = wizardCompact
    ? UC_WIZARD_AGENT_MESSAGE_TEXT
    : fieldTextClass(assistantVote, text, assistantContentBaseline);

  const inlineToolbar = (
    <span className={INLINE_ACTIONS}>
      {onAssistantVote ? (
        <VoteThumbPair
          vote={assistantVote}
          disabled={busy}
          outerBtnClass={UC_AGENT_VOTE_BTN}
          iconSize={INLINE_TOOLBAR_ICON_PX}
          onVote={onAssistantVote}
        />
      ) : null}
      {!editing && !readOnlyTokenized ? (
        <button
          type="button"
          disabled={busy}
          title="Modifica messaggio"
          className={UC_AGENT_ROW_EDIT_BTN}
          onClick={(e) => {
            e.stopPropagation();
            beginEdit();
          }}
        >
          <Pencil size={INLINE_TOOLBAR_ICON_PX} aria-hidden />
        </button>
      ) : null}
      {onToggleParametric ? (
        <button
          type="button"
          disabled={busy}
          aria-pressed={parametricEnabled}
          title={
            parametricEnabled ? 'Disattiva messaggio parametrico' : 'Rendi il messaggio parametrico'
          }
          className={`${UC_AGENT_ROW_EDIT_BTN} ${parametricEnabled ? 'text-emerald-400' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleParametric(!parametricEnabled);
          }}
        >
          <Variable size={INLINE_TOOLBAR_ICON_PX} aria-hidden />
        </button>
      ) : null}
      {!parametricEnabled && onAddStructuralVariant ? (
        <button
          type="button"
          disabled={busy}
          title="Aggiungi variante strutturale"
          className={UC_AGENT_ROW_EDIT_BTN}
          onClick={(e) => {
            e.stopPropagation();
            onAddStructuralVariant();
          }}
        >
          <Plus size={INLINE_TOOLBAR_ICON_PX} aria-hidden />
        </button>
      ) : null}
      {onDeleteMessage ? (
        <button
          type="button"
          disabled={busy}
          title="Elimina messaggio"
          className={UC_AGENT_ROW_EDIT_BTN}
          onClick={(e) => {
            e.stopPropagation();
            onDeleteMessage();
          }}
        >
          <Trash2 size={INLINE_TOOLBAR_ICON_PX} aria-hidden />
        </button>
      ) : null}
    </span>
  );

  const renderDisplayBody = () => {
    if (tokenizedDisplayText?.trim()) {
      return (
        <TokenizedHighlightedText
          text={tokenizedDisplayText}
          inlineFlow
          className="inline min-w-0 whitespace-pre-wrap align-baseline"
        />
      );
    }
    if (!text.trim()) {
      return (
        <span className="inline whitespace-pre-wrap text-slate-500">
          — passa il mouse e usa la matita per modificare
        </span>
      );
    }
    if (searchSeed.trim()) {
      return (
        <span className="inline min-w-0 whitespace-pre-wrap align-baseline">
          <SeedHighlightedText text={text} seed={searchSeed} />
        </span>
      );
    }
    return (
      <BracketTokenHighlightedText
        text={text}
        className="inline min-w-0 whitespace-pre-wrap align-baseline"
      />
    );
  };

  return (
    <div className="space-y-2" data-uc-primary-agent-message={useCase.id}>
      {parametricEnabled && parametricEditor ? parametricEditor : null}

      {editing ? (
        <div className="flex flex-wrap items-start gap-2">
          {fieldLabel}
          <div className="min-w-0 flex-1 flex-col">
            <BracketTokenHighlightedTextarea
              ref={tokenField.textareaRef}
              value={draft}
              disabled={busy}
              rows={2}
              autoFocus
              spellCheck={false}
              aria-label="Messaggio agente"
              placeholder="Testo esempio per il messaggio agente…"
              containerClassName={`${UC_CLASSIC_TEXTAREA_AGENT} min-h-[52px] w-full`}
              onChange={(e) => {
                const v = e.target.value;
                setDraft(v);
                onPhraseDraftChange?.(v);
                tokenField.syncSelection();
              }}
              onMouseDown={tokenField.markPointerSelectingMouse}
              onTouchStart={tokenField.markPointerSelectingTouch}
              onMouseUp={tokenField.syncSelection}
              onSelect={tokenField.syncSelection}
              onKeyUp={tokenField.syncSelection}
              onScroll={tokenField.queueRecalcTokenAnchor}
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
            {tokenField.tokenPopoverActionVisible !== 'none' && !busy ? (
              <AgentMessageSelectionTokenPopover
                action={tokenField.tokenPopoverActionVisible}
                disabled={busy}
                onTokenize={tokenField.handleWrapToken}
                onUntokenize={tokenField.handleUnwrapToken}
                fixedAnchor={tokenField.tokenAnchor}
              />
            ) : null}
          </div>
          <span className="inline-flex shrink-0 items-center gap-0.5 self-start pt-0.5">
            <button
              type="button"
              title="Conferma"
              disabled={busy}
              className="rounded p-0.5 text-emerald-400 hover:bg-slate-800/90 disabled:opacity-40"
              onClick={commitEdit}
            >
              <Check size={EDIT_MODE_ICON_PX} aria-hidden />
            </button>
            <button
              type="button"
              title="Annulla"
              disabled={busy}
              className="rounded p-0.5 text-slate-400 hover:bg-slate-800/90 disabled:opacity-40"
              onClick={cancelEdit}
            >
              <X size={EDIT_MODE_ICON_PX} aria-hidden />
            </button>
          </span>
        </div>
      ) : (
        <div
          className="group/agentmsg-row flex w-full min-w-0 cursor-pointer flex-wrap items-end gap-x-1 gap-y-1 rounded px-0.5 py-0"
          onDoubleClick={(e) => {
            if (busy) return;
            if ((e.target as HTMLElement).closest('button')) return;
            e.preventDefault();
            e.stopPropagation();
            beginEdit();
          }}
        >
          {fieldLabel}
          <div className={`min-w-0 ${displayTextClass}`}>
            {renderDisplayBody()}
            {inlineToolbar}
          </div>
        </div>
      )}

      {!parametricEnabled && structuralVariantsEditor ? structuralVariantsEditor : null}
    </div>
  );
}
