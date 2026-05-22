/**
 * Workspace review: toolbar a 5 tab + pannelli Omnia condivisi (stesso codice dell'editor).
 */

import React from 'react';
import { FontProvider } from '@context/FontContext';
import { ReviewPortalStepper, type ReviewPortalStepId } from '@omnia/domain-components';
import { AIAgentEditorDockProvider } from '@components/TaskEditor/EditorHost/editors/aiAgentEditor/AIAgentEditorDockContext';
import {
  EditorKnowledgeBasePanel,
  EditorUnifiedDescriptionPanel,
  EditorUseCasesPanel,
} from '@components/TaskEditor/EditorHost/editors/aiAgentEditor/AIAgentEditorDockPanels';
import { ReviewPortalConversationPanel } from '@reviewPortal/ReviewPortalConversationPanel';
import { ReviewSnapshotProjectProvider } from '@reviewPortal/ReviewSnapshotProjectProvider';
import { useReviewStore } from './reviewStore';
import { ReviewOmniaProviders } from './ReviewOmniaProviders';
import { useReviewAgentDockBridge } from './useReviewAgentDockBridge';
import { ReviewPortalBackendPanel } from './ReviewPortalBackendPanel';

export function ReviewUseCaseWorkspace(): React.ReactElement {
  const session = useReviewStore((s) => s.session)!;
  const useCases = useReviewStore((s) => s.useCases);
  const saveToServer = useReviewStore((s) => s.saveToServer);
  const channelLoaded = useReviewStore((s) => s.channelLoaded);
  const status = useReviewStore((s) => s.status);
  const saving = useReviewStore((s) => s.saving);
  const lastSavedAt = useReviewStore((s) => s.lastSavedAt);
  const closeSession = useReviewStore((s) => s.closeSession);
  const description = useReviewStore((s) => s.description);
  const structuredSections = useReviewStore((s) => s.structuredSections);
  const knowledgeBase = useReviewStore((s) => s.knowledgeBase);
  const backends = useReviewStore((s) => s.backends);
  const conversation = useReviewStore((s) => s.conversation);
  const categories = useReviewStore((s) => s.categories);

  const [activeStep, setActiveStep] = React.useState<ReviewPortalStepId>('task');
  const [composerError, setComposerError] = React.useState<string | null>(null);

  const dockValue = useReviewAgentDockBridge({
    activeStep,
    composerError,
    setComposerError,
  });

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

  const stepBadges: Partial<Record<ReviewPortalStepId, number>> = {
    knowledge_base: knowledgeBase?.documents.length ?? 0,
    backend: (backends?.catalogRows.length ?? 0) + (backends?.structuredPlaceholders.length ?? 0),
    prompts: useCases.length,
    conversation:
      (conversation?.conversationalRules.length ?? 0) +
      Object.keys(conversation?.styleSelections ?? {}).length,
  };

  return (
    <ReviewOmniaProviders>
      <ReviewSnapshotProjectProvider
        projectId={session.projectId}
        taskInstanceId={session.taskId}
        taskLabel={session.taskLabel}
        backendSnapshot={backends}
      >
        <FontProvider>
          <AIAgentEditorDockProvider value={dockValue}>
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
              {activeStep === 'task' ? <EditorUnifiedDescriptionPanel /> : null}
              {activeStep === 'knowledge_base' ? <EditorKnowledgeBasePanel /> : null}
              {activeStep === 'backend' ? (
                <ReviewPortalBackendPanel backendSnapshot={backends} />
              ) : null}
              {activeStep === 'prompts' ? <EditorUseCasesPanel /> : null}
              {activeStep === 'conversation' ? <ReviewPortalConversationPanel /> : null}
            </div>
          </div>
          </AIAgentEditorDockProvider>
        </FontProvider>
      </ReviewSnapshotProjectProvider>
    </ReviewOmniaProviders>
  );
}
