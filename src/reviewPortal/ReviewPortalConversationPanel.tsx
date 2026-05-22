/**
 * Review portal — Conversation tab using Omnia {@link ConversationStyleEditor}.
 */

import React from 'react';
import { ConversationStyleEditor } from '@components/TaskEditor/EditorHost/editors/aiAgentEditor/useCaseGeneratorWizard/ConversationStyleEditor';
import { useAIAgentEditorDock } from '@components/TaskEditor/EditorHost/editors/aiAgentEditor/AIAgentEditorDockContext';
import { conversationalRulesToUseCases } from '@domain/conversationalRules/ruleUseCaseMapping';
import { AIAgentUseCaseComposer } from '@components/TaskEditor/EditorHost/editors/aiAgentEditor/AIAgentUseCaseComposer';

export function ReviewPortalConversationPanel(): React.ReactElement {
  const {
    instanceId,
    conversationalRules,
    setConversationalRules,
    agentConversationStyleAuto,
    setAgentConversationStyleAuto,
    agentConversationStyleSelections,
    setAgentConversationStyleSelections,
    agentUseCaseStyleLearningNotes,
    setAgentUseCaseStyleLearningNotes,
    useCaseComposerBusy,
    useCaseComposerError,
    onClearUseCaseComposerError,
    onCreateConversationalRule,
    onDeleteConversationalRule,
    useCaseGlobalStyleId,
    setUseCaseGlobalStyleId,
  } = useAIAgentEditorDock();

  const ruleUseCases = React.useMemo(
    () => conversationalRulesToUseCases(conversationalRules),
    [conversationalRules]
  );

  const setRuleUseCases = React.useCallback(
    (action: React.SetStateAction<typeof ruleUseCases>) => {
      setConversationalRules((prevRules) => {
        const prevAsUseCases = conversationalRulesToUseCases(prevRules);
        const nextAsUseCases =
          typeof action === 'function' ? action(prevAsUseCases) : action;
        const byId = new Map(prevRules.map((r) => [r.id, r]));
        return nextAsUseCases.map((uc, index) => {
          const prev = byId.get(uc.id);
          const assistantTurn = uc.dialogue?.find((t) => t.role === 'assistant');
          return {
            id: uc.id,
            libraryRuleId: prev?.libraryRuleId ?? null,
            label: uc.label,
            scenario: uc.payoff ?? uc.scenario?.llm ?? '',
            exampleMessage: assistantTurn?.content ?? '',
            sort_order: index,
            enabled: uc.included_in_conversations !== false,
          };
        });
      });
    },
    [setConversationalRules]
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-slate-100/95 dark:bg-slate-950/80">
      <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-4">
        <section className="rounded-lg border border-slate-700/80 bg-slate-900/40 p-3">
          <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-emerald-400/90">
            Stile conversazione
          </h2>
          <ConversationStyleEditor
            selections={agentConversationStyleSelections}
            onSelectionsChange={setAgentConversationStyleSelections}
            auto={agentConversationStyleAuto}
            onAutoChange={setAgentConversationStyleAuto}
          />
          <label className="mt-3 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Note stile (apprendimento)
          </label>
          <textarea
            className="mt-1 w-full min-h-[72px] rounded border border-slate-600 bg-slate-950/80 px-2 py-1.5 text-sm text-slate-100"
            value={agentUseCaseStyleLearningNotes}
            onChange={(e) => setAgentUseCaseStyleLearningNotes(e.target.value)}
            placeholder="Note per la prossima generazione…"
          />
        </section>

        {ruleUseCases.length > 0 ? (
          <section className="min-h-[240px] flex flex-col rounded-lg border border-slate-700/60 overflow-hidden">
            <h2 className="shrink-0 border-b border-slate-800 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Regole conversazionali
            </h2>
            <div className="min-h-0 flex-1">
              <AIAgentUseCaseComposer
                editorTaskInstanceId={instanceId}
                logicalSteps={[]}
                useCases={ruleUseCases}
                setUseCases={setRuleUseCases}
                busy={useCaseComposerBusy}
                error={useCaseComposerError}
                onDismissError={onClearUseCaseComposerError}
                onCreateUseCase={async (params) =>
                  onCreateConversationalRule({
                    label: params.label,
                    parentId: params.parentId,
                    creationScope: params.creationScope,
                  })
                }
                onDeleteUseCase={(id) => onDeleteConversationalRule(id)}
                useCaseGlobalStyleId={useCaseGlobalStyleId}
                onUseCaseGlobalStyleIdChange={setUseCaseGlobalStyleId}
                useCaseStyleLearningNotes={agentUseCaseStyleLearningNotes}
                onUseCaseStyleLearningNotesChange={setAgentUseCaseStyleLearningNotes}
                composerCatalog="error_handling"
              />
            </div>
          </section>
        ) : (
          <p className="text-center text-sm text-slate-500">
            Nessuna regola conversazionale in questa review.
          </p>
        )}
      </div>
    </div>
  );
}
