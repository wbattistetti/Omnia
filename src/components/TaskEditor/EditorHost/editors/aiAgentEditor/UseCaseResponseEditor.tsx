/**
 * Use case operational response editor: primary message field + action task sequence.
 */

import React from 'react';
import {
  TaskSequenceEditor,
  TaskSequenceFocusProvider,
} from '@responseEditor/taskSequence';
import type { TaskSequenceRow } from '@responseEditor/taskSequence';
import {
  ensureUseCaseResponse,
  getUseCaseResponseTasks,
  mapTasksUpdatingMessageText,
  splitResponseMessageAndActions,
} from '@domain/aiAgentUseCase/useCaseResponseTasks';
import { isMessageLikeEscalationTask } from '@responseEditor/utils/escalationHelpers';
import { ensureUseCasePhrases, syncDialogueFromPrimaryPhrase } from '@domain/useCaseBundle/migrateUseCase';
import {
  getPrimaryPhraseStyleTokens,
  patchStyleTokenVariants,
  pruneStyleTokensToNaturalText,
  removeStyleTokenOnUnwrap,
  upsertStyleTokenOnWrap,
} from '@domain/useCaseBundle/styleTokenPhraseHelpers';
import {
  addParametricCatalogDimension,
  addParametricFreeDimension,
  addParametricRow,
  expandParametricCartesian,
  patchParametricDimensionLabel,
  patchParametricRowCell,
  patchParametricRowPrompt,
  removeParametricDimension,
  applyParametricRevertToSingleMessage,
  setPrimaryPhraseParametricEnabled,
} from '@domain/useCaseBundle/parametricPhraseHelpers';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import type { PatchUseCaseResponseTasksFn } from './usePatchUseCaseResponseTasks';
import { PrimaryAgentMessageField } from './primaryAgentMessage';
import { PhraseParametricEditor } from './useCaseBundle/PhraseParametricEditor';
import { isPrimaryPhraseParametricEnabled } from './useCaseMessageHelpers';
import {
  patchPrimaryPhraseVariantTokenizedText,
  patchPrimaryPhraseSemanticSlotAssignment,
  syncPrimaryPhraseNaturalFromAssistantTurn,
} from '@domain/useCaseBundle/phraseVariantHelpers';
import { resolveNaturalSurfaceAtTokenIndex } from '@domain/useCaseBundle/semanticTokenText';
import { variantNaturalText } from '@domain/useCaseBundle/semanticCompile';
import { useOptionalAIAgentEditorDock } from './AIAgentEditorDockContext';
import { useUseCaseWizardListToolbarOptional } from './useCaseGeneratorWizard/UseCaseWizardListToolbarContext';
import {
  applyUseCaseValidatedOnMessageCommit,
  type DesignerFieldVote,
} from './useCaseComposerDesignerVotes';
import { UC_RESPONSE_ICON_COL } from './useCaseComposerPresentation';

export interface UseCaseResponseEditorProps {
  useCase: AIAgentUseCase;
  onPatchResponseTasks: PatchUseCaseResponseTasksFn;
  /** Full use case patch (parametric, votes). */
  onPatchUseCase: (updater: (uc: AIAgentUseCase) => AIAgentUseCase) => void;
  onAgentMessageVote?: (choice: DesignerFieldVote) => void;
  onSeedUseCase?: (next: AIAgentUseCase) => void;
  onAssistantPhraseDraftChange?: (useCaseId: string, draft: string | null) => void;
  parametricCartesianFeedback?: string | null;
  busy?: boolean;
  searchSeed?: string;
  showTokenizedAgentMessage?: boolean;
  tokenizedByUseCaseId?: Record<string, string>;
  className?: string;
  /** Vista messaggio wizard: nasconde il testo della frase canonica (restano versioni/azioni). */
  hideCanonicalPhraseText?: boolean;
  /** Dopo commit testo messaggio (collasso card wizard, clear highlight). */
  onMessageCommitted?: () => void;
}

export function UseCaseResponseEditor({
  useCase,
  onPatchResponseTasks,
  onPatchUseCase,
  onAgentMessageVote,
  onSeedUseCase,
  onAssistantPhraseDraftChange,
  parametricCartesianFeedback = null,
  busy = false,
  searchSeed = '',
  showTokenizedAgentMessage = false,
  tokenizedByUseCaseId,
  className = '',
  hideCanonicalPhraseText = false,
  onMessageCommitted,
}: UseCaseResponseEditorProps): React.ReactElement {
  const persistedTasks = getUseCaseResponseTasks(useCase);
  const tasks =
    persistedTasks.length > 0
      ? persistedTasks
      : getUseCaseResponseTasks(ensureUseCaseResponse(useCase));

  const { messageTasks, actionTasks } = React.useMemo(
    () => splitResponseMessageAndActions(tasks),
    [tasks]
  );

  const messageText = React.useMemo(() => {
    const row = messageTasks[0];
    if (!row) return '';
    const p = row.parameters?.find((x) => x.parameterId === 'text');
    return typeof p?.value === 'string' ? p.value : '';
  }, [messageTasks]);

  const onSeedRef = React.useRef(onSeedUseCase);
  onSeedRef.current = onSeedUseCase;
  const didSeedRef = React.useRef(false);

  React.useEffect(() => {
    didSeedRef.current = false;
  }, [useCase.id]);

  React.useEffect(() => {
    if (didSeedRef.current) return;
    if (useCase.response?.tasks && useCase.response.tasks.length > 0) {
      didSeedRef.current = true;
      return;
    }
    const seeded = ensureUseCaseResponse(useCase);
    if (!seeded.response?.tasks?.length) return;
    didSeedRef.current = true;
    onSeedRef.current?.(seeded);
  }, [useCase.id, useCase.response?.tasks?.length, useCase]);

  const onActionTasksChange = React.useCallback(
    (updater: (prev: readonly TaskSequenceRow[]) => TaskSequenceRow[]) => {
      if (busy) return;
      onPatchResponseTasks(useCase.id, (prev) => {
        const split = splitResponseMessageAndActions(prev);
        const nextActions = updater(split.actionTasks);
        return [...split.messageTasks, ...nextActions];
      });
    },
    [busy, onPatchResponseTasks, useCase.id]
  );

  const syncPhraseFromMessageText = React.useCallback(
    (uc: AIAgentUseCase, next: string) => {
      const withPhrases = ensureUseCasePhrases(uc);
      const assistant = withPhrases.dialogue.find((t) => t.role === 'assistant');
      if (!assistant) return withPhrases;
      return pruneStyleTokensToNaturalText(
        syncPrimaryPhraseNaturalFromAssistantTurn(withPhrases, assistant.turn_id, next)
      );
    },
    []
  );

  const onMessageTextChange = React.useCallback(
    (next: string, mode: 'live' | 'silent' | 'commit') => {
      if (mode === 'live') return;
      if (busy) return;
      onPatchResponseTasks(useCase.id, (prev) => mapTasksUpdatingMessageText(prev, next));
      onPatchUseCase((uc) => {
        if (uc.id !== useCase.id) return uc;
        let patched = syncPhraseFromMessageText(uc, next);
        if (mode === 'commit') {
          patched = applyUseCaseValidatedOnMessageCommit(patched);
        }
        return patched;
      });
      if (mode === 'commit') {
        onMessageCommitted?.();
      }
    },
    [
      busy,
      onPatchResponseTasks,
      onPatchUseCase,
      syncPhraseFromMessageText,
      useCase.id,
      onMessageCommitted,
    ]
  );

  const styleTokens = React.useMemo(
    () => getPrimaryPhraseStyleTokens(ensureUseCasePhrases(useCase)),
    [useCase]
  );

  const parametricEnabled = isPrimaryPhraseParametricEnabled(useCase);

  const patchUseCase = React.useCallback(
    (updater: (uc: AIAgentUseCase) => AIAgentUseCase) => {
      onPatchUseCase(updater);
    },
    [onPatchUseCase]
  );

  const hasOnlyMessage = tasks.length === 1 && messageTasks.length === 1 && actionTasks.length === 0;

  const listToolbarCtx = useUseCaseWizardListToolbarOptional();
  const dock = useOptionalAIAgentEditorDock();

  const actionsDropIdleLabel = React.useMemo(
    () => (
      <span className="inline text-center">
        Puoi trascinare delle{' '}
        <button
          type="button"
          className="inline underline decoration-current underline-offset-2 hover:text-amber-200"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            listToolbarCtx?.openActionsPanel();
          }}
        >
          azioni
        </button>{' '}
        qui.
      </span>
    ),
    [listToolbarCtx]
  );

  const semanticLayerText = (tokenizedByUseCaseId?.[useCase.id] ?? '').trim();

  const primaryNaturalText = React.useMemo(() => {
    const base = ensureUseCasePhrases(useCase);
    const phrase = base.phrases?.[0];
    if (!phrase) return '';
    const variant =
      phrase.variants.find((v) => v.variantId === 'default') ?? phrase.variants[0];
    return variant ? variantNaturalText(phrase, variant) : phrase.naturalText;
  }, [useCase]);

  const onSemanticTextChange = React.useCallback(
    (next: string, mode: 'live' | 'commit') => {
      if (mode === 'live') return;
      if (busy) return;
      onPatchUseCase((uc) => {
        if (uc.id !== useCase.id) return uc;
        return patchPrimaryPhraseVariantTokenizedText(uc, next);
      });
    },
    [busy, onPatchUseCase, useCase.id]
  );

  const onSemanticSlotCommit = React.useCallback(
    (oldToken: string, payload: { slotId: string; description: string }) => {
      if (busy) return;
      const current = semanticLayerText;
      onPatchUseCase((uc) => {
        if (uc.id !== useCase.id) return uc;
        return patchPrimaryPhraseSemanticSlotAssignment(uc, {
          tokenizedText: current,
          oldToken,
          newSlotId: payload.slotId,
        });
      });
      const surface = resolveNaturalSurfaceAtTokenIndex(
        primaryNaturalText,
        current,
        oldToken
      );
      if (surface) {
        dock?.assignDesignerSurfaceSlotMapping?.(
          surface,
          payload.slotId,
          payload.description
        );
      } else {
        dock?.upsertDesignerSlotRegistry?.(payload.slotId, payload.description);
      }
    },
    [
      busy,
      dock,
      onPatchUseCase,
      primaryNaturalText,
      semanticLayerText,
      useCase.id,
    ]
  );

  return (
    <div
      className={[
        'rounded-lg',
        hasOnlyMessage
          ? 'border border-amber-400/70 bg-amber-950/10'
          : 'border border-amber-400/50 bg-slate-950/40',
        busy ? 'pointer-events-none opacity-60' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label="Response — sequenza messaggio e azioni"
    >
      <TaskSequenceFocusProvider>
        <div
          className="space-y-2 p-2"
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <PrimaryAgentMessageField
            useCase={useCase}
            text={messageText}
            leadingIconColumnClassName={UC_RESPONSE_ICON_COL}
            hideCanonicalPhraseText={hideCanonicalPhraseText}
            busy={busy}
            wizardCompact
            searchSeed={searchSeed}
            semanticDisplayText={semanticLayerText || undefined}
            onSemanticTextChange={
              semanticLayerText ? onSemanticTextChange : undefined
            }
            projectSlotLexicon={dock?.projectSlotLexicon}
            onSemanticSlotCommit={semanticLayerText ? onSemanticSlotCommit : undefined}
            assistantVote={useCase.designer_agent_message_vote}
            onAssistantVote={onAgentMessageVote}
            parametricEnabled={parametricEnabled}
            onToggleParametric={(enabled) =>
              patchUseCase((uc) => setPrimaryPhraseParametricEnabled(uc, enabled))
            }
            renderParametricEditor={(revertPick) =>
              parametricEnabled ? (
                <PhraseParametricEditor
                  useCase={ensureUseCasePhrases(useCase)}
                  busy={busy}
                  revertPick={revertPick}
                  cartesianFeedback={parametricCartesianFeedback}
                  onAddCatalogDimension={(ck) =>
                    patchUseCase((uc) => addParametricCatalogDimension(uc, ck))
                  }
                  onAddFreeDimension={() => patchUseCase((uc) => addParametricFreeDimension(uc))}
                  onRemoveDimension={(dimId) =>
                    patchUseCase((uc) => removeParametricDimension(uc, dimId))
                  }
                  onPatchDimensionLabel={(dimId, label) =>
                    patchUseCase((uc) => patchParametricDimensionLabel(uc, dimId, label))
                  }
                  onAddRow={() => patchUseCase((uc) => addParametricRow(uc))}
                  onPatchCell={(rowId, dimId, v) =>
                    patchUseCase((uc) => patchParametricRowCell(uc, rowId, dimId, v))
                  }
                  onPatchPrompt={(rowId, prompt) =>
                    patchUseCase((uc) => patchParametricRowPrompt(uc, rowId, prompt))
                  }
                  onExpandCartesian={() => patchUseCase((uc) => expandParametricCartesian(uc))}
                />
              ) : null
            }
            onApplyParametricRevert={(selectedRowId) => {
              const phrase = ensureUseCasePhrases(useCase).phrases?.[0];
              const row = phrase?.parametric?.rows.find((r) => r.rowId === selectedRowId);
              const chosenText =
                (row?.promptNaturalText ?? '').trim() || phrase?.naturalText || messageText;
              patchUseCase((uc) => {
                if (uc.id !== useCase.id) return uc;
                return syncDialogueFromPrimaryPhrase(
                  applyParametricRevertToSingleMessage(uc, selectedRowId)
                );
              });
              onPatchResponseTasks(useCase.id, (prev) =>
                mapTasksUpdatingMessageText(prev, chosenText)
              );
            }}
            onDeleteMessage={
              actionTasks.length > 0
                ? () =>
                    onPatchResponseTasks(useCase.id, (prev) =>
                      prev.filter((t) => !isMessageLikeEscalationTask(t))
                    )
                : undefined
            }
            styleTokens={styleTokens}
            onStyleTokenWrap={(surface) =>
              patchUseCase((uc) =>
                uc.id === useCase.id ? upsertStyleTokenOnWrap(uc, surface) : uc
              )
            }
            onStyleTokenUnwrap={(surface) =>
              patchUseCase((uc) =>
                uc.id === useCase.id ? removeStyleTokenOnUnwrap(uc, surface) : uc
              )
            }
            onStyleTokenVariantsChange={(styleTokenId, variants) =>
              patchUseCase((uc) =>
                uc.id === useCase.id ? patchStyleTokenVariants(uc, styleTokenId, variants) : uc
              )
            }
            onPatchUseCase={patchUseCase}
            onTextChange={onMessageTextChange}
            onPhraseDraftChange={(draft) => onAssistantPhraseDraftChange?.(useCase.id, draft)}
          />

          <TaskSequenceEditor
            tasks={actionTasks}
            onTasksChange={onActionTasksChange}
            listIndex={0}
            color="#fbbf24"
            iconColumnClassName={UC_RESPONSE_ICON_COL}
            fillAvailableHeight={false}
            compactEmptyDropZone
            emptyIdleLabel={actionsDropIdleLabel}
            emptyOverLabel="Rilascia per aggiungere al response"
          />
        </div>
      </TaskSequenceFocusProvider>
    </div>
  );
}
