/**
 * Workspace review: toolbar a 5 tab + pannelli condivisi (@omnia/domain-components).
 */

import React from 'react';
import {
  UseCaseReviewPanel,
  ReviewPortalStepper,
  ReviewTaskPanel,
  ReviewKnowledgeBasePanel,
  ReviewBackendPanel,
  ReviewConversationPanel,
  type ReviewPortalStepId,
} from '@omnia/domain-components';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import { useReviewStore } from './reviewStore';

export function ReviewUseCaseWorkspace(): React.ReactElement {
  const session = useReviewStore((s) => s.session)!;
  const useCases = useReviewStore((s) => s.useCases);
  const categories = useReviewStore((s) => s.categories);
  const setUseCases = useReviewStore((s) => s.setUseCases);
  const setCategories = useReviewStore((s) => s.setCategories);
  const selectedUseCaseId = useReviewStore((s) => s.selectedUseCaseId);
  const setSelectedUseCaseId = useReviewStore((s) => s.setSelectedUseCaseId);
  const saveToServer = useReviewStore((s) => s.saveToServer);
  const channelLoaded = useReviewStore((s) => s.channelLoaded);
  const status = useReviewStore((s) => s.status);
  const saving = useReviewStore((s) => s.saving);
  const lastSavedAt = useReviewStore((s) => s.lastSavedAt);
  const closeSession = useReviewStore((s) => s.closeSession);
  const description = useReviewStore((s) => s.description);
  const setDescription = useReviewStore((s) => s.setDescription);
  const structuredSections = useReviewStore((s) => s.structuredSections);
  const setStructuredSection = useReviewStore((s) => s.setStructuredSection);
  const knowledgeBase = useReviewStore((s) => s.knowledgeBase);
  const backends = useReviewStore((s) => s.backends);
  const conversation = useReviewStore((s) => s.conversation);
  const setConversationStyleLearningNotes = useReviewStore(
    (s) => s.setConversationStyleLearningNotes
  );

  const [activeStep, setActiveStep] = React.useState<ReviewPortalStepId>('task');
  const [composerError, setComposerError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!channelLoaded) return;
    const t = window.setTimeout(() => void saveToServer(), 800);
    return () => clearTimeout(t);
  }, [
    channelLoaded,
    description,
    structuredSections,
    useCases,
    categories,
    conversation,
    session.projectId,
    session.taskId,
    saveToServer,
  ]);

  const onCategoryLabelChange = React.useCallback(
    (categoryId: string, label: string) => {
      setCategories((prev) => prev.map((c) => (c.id === categoryId ? { ...c, label } : c)));
    },
    [setCategories]
  );

  const onCategoryDescriptionChange = React.useCallback(
    (categoryId: string, nextDescription: string) => {
      setCategories((prev) =>
        prev.map((c) =>
          c.id === categoryId ? { ...c, description: nextDescription.trim() || undefined } : c
        )
      );
    },
    [setCategories]
  );

  const stepBadges: Partial<Record<ReviewPortalStepId, number>> = {
    knowledge_base: knowledgeBase?.documents.length ?? 0,
    backend: (backends?.catalogRows.length ?? 0) + (backends?.structuredPlaceholders.length ?? 0),
    prompts: useCases.length,
    conversation:
      (conversation?.conversationalRules.length ?? 0) +
      Object.keys(conversation?.styleSelections ?? {}).length,
  };

  return (
    <div className="flex h-screen min-h-0 flex-col bg-slate-950 text-slate-100">
      <header className="shrink-0 border-b border-slate-800 px-4 py-2">
        <button
          type="button"
          onClick={closeSession}
          className="text-xs text-violet-400 hover:text-violet-300"
        >
          ← Tutte le review
        </button>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h1 className="text-sm font-bold text-slate-100">{session.taskLabel}</h1>
            <p className="text-xs text-slate-500">{session.projectLabel}</p>
          </div>
          <p className="text-xs text-slate-500">
            Salvataggio automatico
            {lastSavedAt ? ` · ${new Date(lastSavedAt).toLocaleTimeString('it-IT')}` : ''}
            {saving ? ' · …' : ''}
            {status ? ` · ${status}` : ''}
          </p>
        </div>
      </header>

      <ReviewPortalStepper
        activeStep={activeStep}
        onSelectStep={setActiveStep}
        badges={stepBadges}
      />

      <div className="min-h-0 flex-1 overflow-hidden">
        {activeStep === 'task' ? (
          <ReviewTaskPanel
            description={description}
            onDescriptionChange={setDescription}
            structuredSections={structuredSections}
            onStructuredSectionChange={setStructuredSection}
          />
        ) : null}

        {activeStep === 'knowledge_base' ? (
          <ReviewKnowledgeBasePanel snapshot={knowledgeBase} />
        ) : null}

        {activeStep === 'backend' ? (
          <ReviewBackendPanel snapshot={backends} />
        ) : null}

        {activeStep === 'prompts' ? (
          <div className="flex h-full min-h-0 flex-col px-2 pb-2 pt-1">
            <UseCaseReviewPanel
              useCases={useCases}
              setUseCases={setUseCases as React.Dispatch<React.SetStateAction<AIAgentUseCase[]>>}
              useCaseCategories={categories}
              onUseCaseCategoryLabelChange={onCategoryLabelChange}
              onUseCaseCategoryDescriptionChange={onCategoryDescriptionChange}
              error={composerError}
              onDismissError={() => setComposerError(null)}
              onSelectionChange={setSelectedUseCaseId}
              controlledSelectionId={selectedUseCaseId}
              composeEnabled
            />
          </div>
        ) : null}

        {activeStep === 'conversation' ? (
          <ReviewConversationPanel
            snapshot={conversation}
            onStyleLearningNotesChange={setConversationStyleLearningNotes}
          />
        ) : null}
      </div>
    </div>
  );
}
