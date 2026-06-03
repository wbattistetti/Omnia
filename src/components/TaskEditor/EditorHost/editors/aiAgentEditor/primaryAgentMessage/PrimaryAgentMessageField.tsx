/**
 * Primary assistant message field: testo canonico, tokenize, messaggio parametrico (accordion).
 */

import React from 'react';
import { Check, Pencil, Trash2, Variable, X } from 'lucide-react';
import { useAIProvider } from '@context/AIProviderContext';
import { resolveAiAgentOutputLanguage } from '../resolveAiAgentOutputLanguage';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import type { AIAgentPhraseStyleToken } from '@domain/useCaseBundle/schema';
import {
  BracketTokenHighlightedText,
  BracketTokenHighlightedTextarea,
} from '../BracketTokenHighlightedTextarea';
import { AgentMessageSelectionTokenPopover } from '../AgentMessageSelectionTokenPopover';
import { VoteThumbPair } from '../VoteThumbPair';
import type { DesignerFieldVote } from '../useCaseComposerDesignerVotes';
import { SeedHighlightedText } from '@components/common/SeedHighlightedText';
import {
  UC_AGENT_ROW_EDIT_BTN,
  UC_AGENT_VOTE_BTN,
  UC_CLASSIC_TEXTAREA_AGENT,
  UC_WIZARD_AGENT_MESSAGE_TEXT,
  UC_RESPONSE_ROW_CONTENT,
  fieldTextClass,
} from '../useCaseComposerPresentation';
import { useAgentMessageTextField } from '../useAgentMessageTextField';
import { ensureUseCasePhrases } from '@domain/useCaseBundle/migrateUseCase';
import { AgentMessageKindIcon } from './AgentMessageKindIcon';
import {
  hasStyleVariationsInMessage,
  resolveAgentMessageIconKind,
} from './agentMessageIconKind';
import { DoubleMessageIcon } from './DoubleMessageIcon';
import { SemanticLayerIconStack } from './SemanticLayerIconStack';
import { StyleVariationsDoubleMessageIcon } from './StyleVariationsDoubleMessageIcon';
import type { PhraseParametricRevertPickProps } from '../useCaseBundle/PhraseParametricEditor';
import { AgentMessageStyleExamplesPanel } from '../AgentMessageStyleExamplesPanel';
import { useStylePhraseExamplesPanel } from '../useStylePhraseExamplesPanel';
import { StylePhraseToolbarButtons } from '../StylePhraseToolbarButtons';
import type { ProjectSlotLexicon } from '@domain/useCaseBundle/projectSlotLexicon';
import {
  isUnclassifiedSlotId,
  listRegisteredSlotIds,
  normalizeSlotId,
} from '@domain/useCaseBundle/projectSlotLexicon';
import { replaceSlotIdInTokenizedText } from '@domain/useCaseBundle/semanticTokenText';
import { SemanticTokenMessageLayer } from '../useCaseBundle/SemanticTokenMessageLayer';
import type { SlotIdPickerCommitPayload } from '../useCaseBundle/SlotIdPickerPopover';

export type { PhraseParametricRevertPickProps as ParametricEditorPickRevertContext };

export type PrimaryAgentMessageFieldProps = {
  useCase: AIAgentUseCase;
  text: string;
  busy?: boolean;
  wizardCompact?: boolean;
  searchSeed?: string;
  /** Testo con token semantici (slot) per la riga espandibile sotto il messaggio leggibile. */
  semanticDisplayText?: string;
  /** @deprecated Usare {@link semanticDisplayText}. */
  tokenizedDisplayText?: string;
  onSemanticTextChange?: (next: string, mode: 'live' | 'commit') => void;
  /** Lessico progetto per picker slot semantici e descrizioni runtime. */
  projectSlotLexicon?: ProjectSlotLexicon;
  /** Persiste descrizione/label slot nel registro progetto. */
  onUpsertSlotRegistry?: (slotId: string, description: string) => void;
  /** Commit slot dal picker (persistenza UC + lessico); se assente usa handler interno. */
  onSemanticSlotCommit?: (
    oldToken: string,
    payload: import('../useCaseBundle/SlotIdPickerPopover').SlotIdPickerCommitPayload
  ) => void;
  assistantVote?: DesignerFieldVote;
  onAssistantVote?: (choice: DesignerFieldVote) => void;
  assistantContentBaseline?: string;
  parametricEnabled?: boolean;
  onToggleParametric?: (enabled: boolean) => void;
  /** @deprecated Prefer {@link renderParametricEditor}. */
  parametricEditor?: React.ReactNode;
  renderParametricEditor?: (revertPick: PhraseParametricRevertPickProps) => React.ReactNode;
  onApplyParametricRevert?: (selectedRowId: string) => void;
  onDeleteMessage?: () => void;
  onTextChange: (next: string, mode: 'live' | 'silent' | 'commit') => void;
  onPhraseDraftChange?: (draft: string | null) => void;
  styleTokens?: readonly AIAgentPhraseStyleToken[];
  onStyleTokenWrap?: (surface: string) => void;
  onStyleTokenUnwrap?: (surface: string) => void;
  onStyleTokenVariantsChange?: (styleTokenId: string, variants: string[]) => void;
  /** Persistenza `phrases[0].styleExamples` e azioni Magic. */
  onPatchUseCase?: (updater: (uc: AIAgentUseCase) => AIAgentUseCase) => void;
  /** Vista messaggio wizard: nasconde il corpo testo (icona + toolbar + versioni restano). */
  hideCanonicalPhraseText?: boolean;
  /** Colonna icona allineata alle righe azioni del response (es. {@link UC_RESPONSE_ICON_COL}). */
  leadingIconColumnClassName?: string;
};

const INLINE_TOOLBAR_ICON_PX = 18;
const EDIT_MODE_ICON_PX = 21;

const INLINE_ACTIONS =
  'inline-flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/agentmsg-row:opacity-100 group-focus-within/agentmsg-row:opacity-100';

/** Spazio verticale tra riga leggibile e riga semantica (~2 righe). */
const UC_SEMANTIC_LAYER_GAP = 'mt-4 pt-3';

export function PrimaryAgentMessageField({
  useCase,
  text,
  busy = false,
  wizardCompact = true,
  searchSeed = '',
  semanticDisplayText: semanticDisplayTextProp,
  tokenizedDisplayText,
  onSemanticTextChange,
  projectSlotLexicon,
  onUpsertSlotRegistry,
  onSemanticSlotCommit,
  assistantVote,
  onAssistantVote,
  assistantContentBaseline,
  parametricEnabled = false,
  onToggleParametric,
  parametricEditor,
  renderParametricEditor,
  onApplyParametricRevert,
  onDeleteMessage,
  onTextChange,
  onPhraseDraftChange,
  styleTokens = [],
  onStyleTokenWrap,
  onStyleTokenUnwrap,
  onStyleTokenVariantsChange,
  onPatchUseCase,
  hideCanonicalPhraseText = false,
  leadingIconColumnClassName,
}: PrimaryAgentMessageFieldProps): React.ReactElement {
  const { provider, model } = useAIProvider();
  const outputLanguage = resolveAiAgentOutputLanguage().tag;

  const semanticDisplayText = (semanticDisplayTextProp ?? tokenizedDisplayText ?? '').trim();
  const hasSemanticLayer = semanticDisplayText.length > 0;
  const useSemanticStack =
    hasSemanticLayer && Boolean(onSemanticTextChange) && Boolean(projectSlotLexicon);

  const { mappedCategoryOptions, otherCategoryOptions } = React.useMemo(() => {
    const lexicon = projectSlotLexicon;
    if (!lexicon) {
      return { mappedCategoryOptions: [] as string[], otherCategoryOptions: [] as string[] };
    }
    const mapped = new Set<string>();
    for (const e of lexicon.entries) {
      const id = normalizeSlotId(e.slot_id);
      if (!isUnclassifiedSlotId(id)) mapped.add(id);
    }
    const mappedSorted = [...mapped].sort((a, b) => a.localeCompare(b));
    const otherSorted = listRegisteredSlotIds(lexicon)
      .filter((id) => !mapped.has(id))
      .sort((a, b) => a.localeCompare(b));
    return { mappedCategoryOptions: mappedSorted, otherCategoryOptions: otherSorted };
  }, [projectSlotLexicon]);

  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(text);
  const [semanticDraft, setSemanticDraft] = React.useState(semanticDisplayText);
  const [parametricExpanded, setParametricExpanded] = React.useState(false);
  const [revertPickMode, setRevertPickMode] = React.useState(false);
  const [revertSelectedRowId, setRevertSelectedRowId] = React.useState<string | null>(null);
  const [semanticOpen, setSemanticOpen] = React.useState(false);

  const activeSemanticText = editing ? semanticDraft : semanticDisplayText;

  const handleSemanticSlotCommit = React.useCallback(
    (oldToken: string, payload: SlotIdPickerCommitPayload) => {
      if (onSemanticSlotCommit) {
        if (editing) {
          const nextText = replaceSlotIdInTokenizedText(
            activeSemanticText,
            oldToken,
            payload.slotId
          );
          if (nextText !== activeSemanticText) setSemanticDraft(nextText);
        }
        onSemanticSlotCommit(oldToken, payload);
        return;
      }
      const nextText = replaceSlotIdInTokenizedText(activeSemanticText, oldToken, payload.slotId);
      onUpsertSlotRegistry?.(payload.slotId, payload.description);

      if (nextText === activeSemanticText) return;

      if (editing) {
        setSemanticDraft(nextText);
        return;
      }
      onSemanticTextChange?.(nextText, 'commit');
    },
    [
      activeSemanticText,
      editing,
      onSemanticSlotCommit,
      onSemanticTextChange,
      onUpsertSlotRegistry,
    ]
  );

  const renderSemanticLayerBody = () => {
    if (!semanticOpen || !useSemanticStack || !projectSlotLexicon) return null;
    return (
      <div
        className={`w-full min-w-0 border-t border-violet-500/30 ${UC_SEMANTIC_LAYER_GAP}`}
      >
        <SemanticTokenMessageLayer
          text={activeSemanticText}
          lexicon={projectSlotLexicon}
          mappedOptions={mappedCategoryOptions}
          otherOptions={otherCategoryOptions}
          disabled={busy}
          interactive={!busy}
          onSlotCommit={handleSemanticSlotCommit}
          className="text-violet-100/95"
        />
      </div>
    );
  };

  const parametricRows = React.useMemo(() => {
    const phrase = ensureUseCasePhrases(useCase).phrases?.[0];
    return phrase?.parametric?.rows ?? [];
  }, [useCase]);

  React.useEffect(() => {
    if (!editing) setDraft(text);
  }, [text, editing]);

  React.useEffect(() => {
    if (!editing) setSemanticDraft(semanticDisplayText);
  }, [semanticDisplayText, editing]);

  React.useEffect(() => {
    if (editing) setParametricExpanded(true);
  }, [editing]);

  React.useEffect(() => {
    if (!parametricEnabled) {
      setParametricExpanded(false);
      setRevertPickMode(false);
    }
  }, [parametricEnabled]);

  React.useEffect(() => {
    if (!parametricExpanded) setRevertPickMode(false);
  }, [parametricExpanded]);

  const beginParametricRevertPick = React.useCallback(() => {
    const firstId = parametricRows[0]?.rowId ?? null;
    setRevertSelectedRowId(firstId);
    setRevertPickMode(true);
  }, [parametricRows]);

  const cancelParametricRevertPick = React.useCallback(() => {
    setRevertPickMode(false);
    setRevertSelectedRowId(null);
  }, []);

  const applyParametricRevertPick = React.useCallback(() => {
    if (!revertSelectedRowId || !onApplyParametricRevert) return;
    onApplyParametricRevert(revertSelectedRowId);
    setRevertPickMode(false);
    setRevertSelectedRowId(null);
    setParametricExpanded(false);
  }, [revertSelectedRowId, onApplyParametricRevert]);

  const revertPickProps: PhraseParametricRevertPickProps = React.useMemo(
    () => ({
      revertPickMode,
      revertSelectedRowId,
      onRevertSelectedRowIdChange: setRevertSelectedRowId,
    }),
    [revertPickMode, revertSelectedRowId]
  );

  const resolvedParametricEditor = React.useMemo(() => {
    if (renderParametricEditor) return renderParametricEditor(revertPickProps);
    return parametricEditor ?? null;
  }, [renderParametricEditor, parametricEditor, revertPickProps]);

  const collapseParametricPanel = React.useCallback(() => {
    setParametricExpanded(false);
    setRevertPickMode(false);
  }, []);

  const showParametricBody = parametricEnabled && (parametricExpanded || editing);

  const beginEdit = React.useCallback(() => {
    if (busy || editing) return;
    setDraft(text);
    setSemanticDraft(semanticDisplayText);
    setEditing(true);
    onPhraseDraftChange?.(text);
  }, [busy, editing, text, semanticDisplayText, onPhraseDraftChange]);

  const cancelEdit = React.useCallback(() => {
    setEditing(false);
    setDraft(text);
    setSemanticDraft(semanticDisplayText);
    onPhraseDraftChange?.(null);
  }, [text, semanticDisplayText, onPhraseDraftChange]);

  const commitEdit = React.useCallback(() => {
    onTextChange(draft, 'commit');
    if (
      onSemanticTextChange &&
      semanticDraft.trim() !== semanticDisplayText
    ) {
      onSemanticTextChange(semanticDraft, 'commit');
    }
    setEditing(false);
    onPhraseDraftChange?.(null);
  }, [
    draft,
    semanticDraft,
    semanticDisplayText,
    onSemanticTextChange,
    onTextChange,
    onPhraseDraftChange,
  ]);

  const tokenField = useAgentMessageTextField({
    text: draft,
    disabled: busy,
    isEditing: editing,
    onTextChange: (next, mode) => {
      setDraft(next);
      onPhraseDraftChange?.(next);
      if (mode !== 'live') onTextChange(next, mode);
    },
    onStyleTokenWrap,
    onStyleTokenUnwrap,
  });

  const activeStyleToken = React.useMemo(() => {
    const span = tokenField.activeStyleTokenSpan;
    if (!span) return null;
    return styleTokens.find((t) => t.defaultSurface === span.inner) ?? null;
  }, [tokenField.activeStyleTokenSpan, styleTokens]);

  const noopPatch = React.useCallback((updater: (uc: AIAgentUseCase) => AIAgentUseCase) => {
    void updater;
  }, []);

  const stylePanel = useStylePhraseExamplesPanel({
    useCase,
    messageText: editing ? draft : text,
    styleTokens,
    onPatchUseCase: onPatchUseCase ?? noopPatch,
    ai:
      provider && model
        ? { provider, model, outputLanguage }
        : null,
  });

  const styleBusy = busy || stylePanel.generating !== null;

  const hasStyleVariations = hasStyleVariationsInMessage({
    hasStyleTokens: stylePanel.hasStyleTokens,
    styleExampleCount: stylePanel.examples.length,
  });

  const iconKind = resolveAgentMessageIconKind({
    parametricEnabled,
    hasStyleVariations,
  });

  const styleToggleButton = (
    <button
      type="button"
      disabled={busy}
      className="shrink-0 rounded p-0 focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-500/80"
      title={
        stylePanel.open ? 'Comprimi versioni messaggio' : 'Espandi versioni messaggio'
      }
      aria-expanded={stylePanel.open}
      aria-label="Versioni messaggio stile"
      onClick={(e) => {
        e.stopPropagation();
        stylePanel.setOpen((open) => !open);
      }}
    >
      <StyleVariationsDoubleMessageIcon />
    </button>
  );

  const wrapLeadingIcon = (node: React.ReactNode) =>
    leadingIconColumnClassName ? (
      <span className={leadingIconColumnClassName}>{node}</span>
    ) : (
      node
    );

  const wrapSemanticLeadingIcon = (node: React.ReactNode) =>
    leadingIconColumnClassName ? (
      <span className="inline-flex w-6 shrink-0 flex-col items-center justify-start gap-0 pt-0.5">
        {node}
      </span>
    ) : (
      node
    );

  const renderSemanticIconStack = () =>
    wrapSemanticLeadingIcon(
      <SemanticLayerIconStack
        semanticOpen={semanticOpen}
        disabled={busy}
        onToggleSemantic={() => setSemanticOpen((open) => !open)}
      />
    );

  const renderLeadingMessageIcon = (opts: { styleToggleInteractive: boolean }) => {
    if (useSemanticStack && iconKind === 'single') {
      return renderSemanticIconStack();
    }
    if (iconKind === 'style' && opts.styleToggleInteractive) {
      return wrapLeadingIcon(styleToggleButton);
    }
    return wrapLeadingIcon(<AgentMessageKindIcon kind={iconKind} size={16} />);
  };

  const messageTextForStyle = (editing ? draft : text).trim();

  const renderStyleToolbarButtons = (showMagic: boolean, alwaysVisible: boolean) => (
    <StylePhraseToolbarButtons
      hasStyleTokens={stylePanel.hasStyleTokens}
      canRunCreative={messageTextForStyle.length > 0}
      open={stylePanel.open}
      generating={stylePanel.generating}
      canUseAi={stylePanel.canUseAi}
      busy={styleBusy}
      showMagic={showMagic}
      iconSize={INLINE_TOOLBAR_ICON_PX}
      alwaysVisible={alwaysVisible}
      onLoadLocalCombinatorics={stylePanel.loadLocalCombinatorics}
      onRunPolish={() => void stylePanel.runPolish()}
      onRunCreative={() => void stylePanel.runCreative()}
    />
  );

  const styleExamplesPanel =
    stylePanel.open && (stylePanel.hasStyleTokens || stylePanel.examples.length > 0) ? (
      <div className="mt-2 space-y-1">
        {stylePanel.error ? (
          <p className="text-xs text-rose-300/90">{stylePanel.error}</p>
        ) : null}
        <AgentMessageStyleExamplesPanel
          examples={stylePanel.examples}
          truncated={stylePanel.truncated}
          busy={styleBusy}
          onClose={stylePanel.close}
          {...stylePanel.handlers}
        />
      </div>
    ) : null;

  const selectionTokenPopover =
    tokenField.tokenPopoverActionVisible !== 'none' && !busy ? (
      <AgentMessageSelectionTokenPopover
        action={tokenField.tokenPopoverActionVisible}
        disabled={busy}
        onSemanticToken={tokenField.handleWrapSemanticToken}
        onStyleToken={tokenField.handleWrapStyleToken}
        onUntokenize={tokenField.handleUnwrapToken}
        fixedAnchor={tokenField.tokenAnchor}
        activeStyleToken={activeStyleToken}
        onStyleTokenVariantsChange={
          activeStyleToken && onStyleTokenVariantsChange
            ? (variants) => onStyleTokenVariantsChange(activeStyleToken.styleTokenId, variants)
            : undefined
        }
        onClose={tokenField.handleDismissTokenPopover}
      />
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
      {!editing ? (
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
            const next = !parametricEnabled;
            onToggleParametric(next);
            if (next) setParametricExpanded(true);
          }}
        >
          <Variable size={INLINE_TOOLBAR_ICON_PX} aria-hidden />
        </button>
      ) : null}
      {renderStyleToolbarButtons(false, false)}
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
    if (hideCanonicalPhraseText && !editing) {
      return null;
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
        <span className="inline min-w-0 whitespace-pre-wrap">
          <SeedHighlightedText text={text} seed={searchSeed} />
        </span>
      );
    }
    return (
      <BracketTokenHighlightedText
        text={text}
        className="inline min-w-0 whitespace-pre-wrap"
      />
    );
  };

  const renderDisplayContentColumn = () => (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className={`${UC_RESPONSE_ROW_CONTENT} ${displayTextClass}`}>
        {renderDisplayBody()}
        {inlineToolbar}
      </div>
      {renderSemanticLayerBody()}
    </div>
  );

  const renderNaturalEditTextarea = () => (
    <>
      <BracketTokenHighlightedTextarea
        ref={tokenField.textareaRef}
        value={draft}
        disabled={busy}
        rows={2}
        autoFocus
        spellCheck
        lang={outputLanguage}
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
      {selectionTokenPopover}
    </>
  );

  const renderEditTextColumn = () => (
    <div className="flex min-w-0 flex-1 flex-col">
      {renderNaturalEditTextarea()}
      {renderSemanticLayerBody()}
    </div>
  );

  const parametricToggleButton = wrapLeadingIcon(
    <button
      type="button"
      disabled={busy}
      className="rounded p-0 focus:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500/80"
      title={showParametricBody ? 'Comprimi messaggio parametrico' : 'Espandi messaggio parametrico'}
      aria-expanded={showParametricBody}
      aria-label="Messaggio parametrico"
      onClick={(e) => {
        e.stopPropagation();
        setParametricExpanded((v) => !v);
      }}
    >
      <DoubleMessageIcon />
    </button>
  );

  const renderCanonicalEdit = () => (
    <div className="flex w-full flex-wrap items-start gap-x-[5px] gap-y-2">
      <div className="flex shrink-0 flex-col items-center gap-1">
        {parametricToggleButton}
        {useSemanticStack ? renderSemanticIconStack() : null}
      </div>
      {renderEditTextColumn()}
      <span className="inline-flex shrink-0 items-center gap-0.5">
        {renderStyleToolbarButtons(true, true)}
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
  );

  const parametricRevertFooter =
    revertPickMode && onApplyParametricRevert ? (
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-600/40 pt-2">
        <button
          type="button"
          disabled={busy}
          className="rounded border border-slate-500/50 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-800/60 disabled:opacity-40"
          onClick={(e) => {
            e.stopPropagation();
            cancelParametricRevertPick();
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={busy || !revertSelectedRowId}
          className="rounded border border-emerald-600/55 bg-emerald-950/50 px-2.5 py-1 text-xs font-semibold text-emerald-100 hover:bg-emerald-900/50 disabled:opacity-40"
          onClick={(e) => {
            e.stopPropagation();
            applyParametricRevertPick();
          }}
        >
          Applica
        </button>
      </div>
    ) : null;

  const parametricExpandedHeader = (
    <div className="flex min-w-0 flex-1 items-center gap-x-2 gap-y-1">
      <span className="shrink-0 text-sm font-semibold text-slate-950 dark:text-slate-100">
        Messaggio parametrico
      </span>
      {!revertPickMode && onApplyParametricRevert ? (
        <button
          type="button"
          disabled={busy || parametricRows.length === 0}
          title="Cliccando su Annulla il messaggio non sarà più parametrico"
          className="shrink-0 rounded border border-slate-500/45 px-2 py-0.5 text-xs font-medium text-slate-300 hover:bg-slate-800/50 disabled:opacity-40"
          onClick={(e) => {
            e.stopPropagation();
            beginParametricRevertPick();
          }}
        >
          Annulla
        </button>
      ) : null}
      <span className="ms-auto inline-flex shrink-0 items-center gap-0.5">{inlineToolbar}</span>
      <button
        type="button"
        disabled={busy}
        title="Chiudi pannello messaggio parametrico"
        aria-label="Chiudi pannello messaggio parametrico"
        className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-800/80 hover:text-slate-200 disabled:opacity-40"
        onClick={(e) => {
          e.stopPropagation();
          collapseParametricPanel();
        }}
      >
        <X size={16} aria-hidden />
      </button>
    </div>
  );

  if (parametricEnabled && resolvedParametricEditor) {
    return (
      <div className="space-y-0" data-uc-primary-agent-message={useCase.id}>
        {editing ? (
          <>
            {renderCanonicalEdit()}
            <div className="mt-1 space-y-2 border-t border-emerald-800/25 pt-1">
              {resolvedParametricEditor}
              {parametricRevertFooter}
            </div>
            {styleExamplesPanel}
          </>
        ) : (
          <>
            <div
              className={`group/agentmsg-row flex w-full min-w-0 gap-x-[5px] rounded py-0 ${showParametricBody ? 'items-center' : 'flex-wrap items-center gap-y-1 cursor-pointer'}`}
              onDoubleClick={(e) => {
                if (showParametricBody || busy) return;
                if ((e.target as HTMLElement).closest('button')) return;
                e.preventDefault();
                e.stopPropagation();
                beginEdit();
              }}
            >
              <div className="flex shrink-0 flex-col items-center gap-1">
                {parametricToggleButton}
                {useSemanticStack && !showParametricBody ? renderSemanticIconStack() : null}
              </div>
              {showParametricBody ? (
                parametricExpandedHeader
              ) : (
                renderDisplayContentColumn()
              )}
            </div>
            {showParametricBody ? (
              <div className="mt-1 space-y-2 border-t border-emerald-800/25 pt-1">
              {resolvedParametricEditor}
              {parametricRevertFooter}
            </div>
            ) : null}
            {styleExamplesPanel}
          </>
        )}
      </div>
    );
  }

  if (editing) {
    return (
      <div className="space-y-2" data-uc-primary-agent-message={useCase.id}>
        <div
          className="flex min-h-[52px] flex-wrap items-start gap-x-[5px] gap-y-2"
          onDoubleClick={(e) => e.stopPropagation()}
        >
          {renderLeadingMessageIcon({ styleToggleInteractive: false })}
          {renderEditTextColumn()}
          <span className="inline-flex shrink-0 items-center gap-0.5">
            {renderStyleToolbarButtons(true, true)}
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
        {styleExamplesPanel}
      </div>
    );
  }

  return (
    <div className="space-y-2" data-uc-primary-agent-message={useCase.id}>
      <div
        className="group/agentmsg-row flex min-h-[52px] w-full min-w-0 cursor-pointer flex-wrap items-center gap-x-[5px] gap-y-1 rounded py-0"
        onDoubleClick={(e) => {
          if (busy) return;
          if ((e.target as HTMLElement).closest('button')) return;
          e.preventDefault();
          e.stopPropagation();
          beginEdit();
        }}
      >
        {renderLeadingMessageIcon({ styleToggleInteractive: true })}
        {renderDisplayContentColumn()}
      </div>
      {styleExamplesPanel}
    </div>
  );
}
