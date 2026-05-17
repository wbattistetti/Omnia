/**
 * Use case operational response editor: primary message field + action task sequence.
 */

import React from 'react';
import {
  TaskSequenceEditor,
  TaskSequenceFocusProvider,
} from '@responseEditor/tasksequence';
import type { TaskSequenceRow } from '@responseEditor/tasksequence';
import {
  ensureUseCaseResponse,
  getUseCaseResponseTasks,
  mapTasksUpdatingMessageText,
  splitResponseMessageAndActions,
} from '@domain/aiAgentUseCase/useCaseResponseTasks';
import { isMessageLikeEscalationTask } from '@responseEditor/utils/escalationHelpers';
import { ensureUseCasePhrases, syncDialogueFromPrimaryPhrase } from '@domain/useCaseBundle/migrateUseCase';
import { syncPrimaryPhraseNaturalFromAssistantTurn } from '@domain/useCaseBundle/phraseVariantHelpers';
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
import { useUseCaseWizardListToolbarOptional } from './useCaseGeneratorWizard/UseCaseWizardListToolbarContext';

const AI_AGENT_RESPONSE_ALLOWED_TEMPLATES = [
  'sayMessage',
  'message',
  'Message',
  'sendSMS',
  'readFromBackend',
  'writeToBackend',
  'escalateToHuman',
  'waitForAgent',
] as const;

export interface UseCaseResponseEditorProps {
  useCase: AIAgentUseCase;
  onPatchResponseTasks: PatchUseCaseResponseTasksFn;
  /** Full use case patch (parametric, votes). */
  onPatchUseCase: (updater: (uc: AIAgentUseCase) => AIAgentUseCase) => void;
  onAgentMessageVote?: (choice: 'up' | 'down') => void;
  onSeedUseCase?: (next: AIAgentUseCase) => void;
  onAssistantPhraseDraftChange?: (useCaseId: string, draft: string | null) => void;
  parametricCartesianFeedback?: string | null;
  busy?: boolean;
  searchSeed?: string;
  showTokenizedAgentMessage?: boolean;
  tokenizedByUseCaseId?: Record<string, string>;
  className?: string;
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
      onPatchResponseTasks(useCase.id, (prev) => mapTasksUpdatingMessageText(prev, next));
      onPatchUseCase((uc) => (uc.id === useCase.id ? syncPhraseFromMessageText(uc, next) : uc));
    },
    [busy, onPatchResponseTasks, onPatchUseCase, syncPhraseFromMessageText, useCase.id]
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
  const actionsDropIdleLabel = React.useMemo(
    () => (
      <>
        Puoi trascinare delle{' '}
        <button
          type="button"
          className="underline decoration-current underline-offset-2 hover:text-amber-200"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            listToolbarCtx?.toggleActionsPanel();
          }}
        >
          azioni
        </button>{' '}
        qui..
      </>
    ),
    [listToolbarCtx]
  );

  const tokenized =
    showTokenizedAgentMessage && tokenizedByUseCaseId
      ? tokenizedByUseCaseId[useCase.id] ?? ''
      : '';

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
        <div className="space-y-2 p-2">
          <PrimaryAgentMessageField
            useCase={useCase}
            text={messageText}
            busy={busy}
            wizardCompact
            searchSeed={searchSeed}
            tokenizedDisplayText={tokenized.trim() ? tokenized : undefined}
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
            onTextChange={onMessageTextChange}
            onPhraseDraftChange={(draft) => onAssistantPhraseDraftChange?.(useCase.id, draft)}
          />

          {actionTasks.length > 0 ? (
            <TaskSequenceEditor
              tasks={actionTasks}
              onTasksChange={onActionTasksChange}
              listIndex={0}
              color="#fbbf24"
              allowedTemplateIds={AI_AGENT_RESPONSE_ALLOWED_TEMPLATES.filter(
                (id) => !['sayMessage', 'message', 'Message'].includes(id)
              )}
              fillAvailableHeight={false}
              compactEmptyDropZone
              emptyIdleLabel={actionsDropIdleLabel}
              emptyOverLabel="Rilascia per aggiungere al response"
            />
          ) : (
            <TaskSequenceEditor
              tasks={[]}
              onTasksChange={onActionTasksChange}
              listIndex={0}
              color="#fbbf24"
              allowedTemplateIds={AI_AGENT_RESPONSE_ALLOWED_TEMPLATES.filter(
                (id) => !['sayMessage', 'message', 'Message'].includes(id)
              )}
              fillAvailableHeight={false}
              compactEmptyDropZone
              emptyIdleLabel={actionsDropIdleLabel}
              emptyOverLabel="Rilascia per aggiungere al response"
            />
          )}
        </div>
      </TaskSequenceFocusProvider>
    </div>
  );
}
