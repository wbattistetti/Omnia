/**
 * Workspace review: toolbar a 5 tab + pannelli Omnia condivisi (stesso codice dell'editor).
 */

import React from 'react';
import { FontProvider } from '@context/FontContext';
import { ReviewPortalStepper, type ReviewPortalStepId } from '@omnia/domain-components';
import {
  AIAgentEditorDockProvider,
  useAIAgentEditorDock,
} from '@components/TaskEditor/EditorHost/editors/aiAgentEditor/AIAgentEditorDockContext';
import {
  EditorConversationPanel,
  EditorBackendsTabPanel,
  EditorKnowledgeBasePanel,
  EditorUnifiedDescriptionPanel,
  EditorUseCasesPanel,
} from '@components/TaskEditor/EditorHost/editors/aiAgentEditor/AIAgentEditorDockPanels';
import { AddBackendDropdown } from '@components/TaskEditor/EditorHost/editors/aiAgentEditor/AddBackendDropdown';
import { useAIProvider } from '@context/AIProviderContext';
import type { AgentReviewBackendSnapshot } from '@domain/agentReviewChannel/reviewSnapshots';
import { backendPlaceholdersFromReviewSnapshot } from '@reviewPortal/buildReviewAgentDockValue';
import { ReviewSnapshotProjectProvider } from '@reviewPortal/ReviewSnapshotProjectProvider';
import { useReviewStore } from './reviewStore';
import { DesignerLlmSetupOpenButton } from '@components/settings/designerLlm/DesignerLlmSetupOpenButton';
import { DesignerLlmSetupOverlay } from '@components/settings/designerLlm/DesignerLlmSetupHost';
import { ReviewOmniaProviders } from './ReviewOmniaProviders';
import { useReviewAgentDockBridge } from './useReviewAgentDockBridge';
import { ReviewCopySystemPromptControl } from '@reviewPortal/ReviewCopySystemPromptControl';

interface ReviewUseCaseWorkspaceInnerProps {
  session: NonNullable<ReturnType<typeof useReviewStore.getState>['session']>;
  backends: AgentReviewBackendSnapshot | null;
  activeStep: ReviewPortalStepId;
  setActiveStep: (step: ReviewPortalStepId) => void;
  stepBadges: Partial<Record<ReviewPortalStepId, number>>;
  composerError: string | null;
  setComposerError: (message: string | null) => void;
  closeSession: () => void;
  lastSavedAt: string | null;
  saving: boolean;
  status: string | null;
  designerLlm: import('@domain/agentReviewChannel/reviewDocument').AgentReviewDesignerLlmSnapshot | null;
}

function ReviewBackendStepHeader(): React.ReactElement {
  const { invokeBackendsAddManual } = useAIAgentEditorDock();
  return (
    <header className="shrink-0 border-b border-slate-800 bg-slate-900/40 px-4 py-2.5">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="text-sm font-semibold text-slate-100">Backend</h2>
        <AddBackendDropdown
          wizardUi
          onAddExisting={() => invokeBackendsAddManual('import')}
          onCreateSpecs={() => invokeBackendsAddManual('emulate')}
        />
      </div>
    </header>
  );
}

/** Debounced autosave — must run under {@link ReviewOmniaProviders} for LLM context deps. */
function ReviewAutoSaveEffect(): null {
  const session = useReviewStore((s) => s.session)!;
  const channelLoaded = useReviewStore((s) => s.channelLoaded);
  const saveToServer = useReviewStore((s) => s.saveToServer);
  const description = useReviewStore((s) => s.description);
  const structuredSections = useReviewStore((s) => s.structuredSections);
  const useCases = useReviewStore((s) => s.useCases);
  const categories = useReviewStore((s) => s.categories);
  const conversation = useReviewStore((s) => s.conversation);
  const knowledgeBase = useReviewStore((s) => s.knowledgeBase);
  const backends = useReviewStore((s) => s.backends);
  const designerLlm = useReviewStore((s) => s.designerLlm);
  const agentUseCaseWizardStateJson = useReviewStore((s) => s.agentUseCaseWizardStateJson);
  const { provider, model } = useAIProvider();

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
    knowledgeBase,
    backends,
    designerLlm,
    agentUseCaseWizardStateJson,
    provider,
    model,
    session.projectId,
    session.taskId,
    saveToServer,
  ]);

  return null;
}

/** Must render under {@link ReviewOmniaProviders} and {@link ReviewSnapshotProjectProvider}. */
function ReviewUseCaseWorkspaceDocked({
  session,
  activeStep,
  setActiveStep,
  stepBadges,
  composerError,
  setComposerError,
  closeSession,
  lastSavedAt,
  saving,
  status,
  designerLlm,
}: Omit<ReviewUseCaseWorkspaceInnerProps, 'backends'>): React.ReactElement {
  const dockValue = useReviewAgentDockBridge({
    activeStep,
    composerError,
    setComposerError,
  });

  return (
    <FontProvider>
      <AIAgentEditorDockProvider value={dockValue}>
          <div className="relative flex h-screen min-h-0 flex-col overflow-hidden bg-slate-950 text-slate-100">
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
              <div
                id="review-designer-llm-picker"
                className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 pt-2"
              >
                <DesignerLlmSetupOpenButton publishedSnapshot={designerLlm} />
                <ReviewCopySystemPromptControl />
              </div>
            </header>

            <ReviewPortalStepper
              activeStep={activeStep}
              onSelectStep={setActiveStep}
              badges={stepBadges}
            />

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {activeStep === 'backend' ? <ReviewBackendStepHeader /> : null}
              <div className="min-h-0 flex-1 overflow-hidden">
                {activeStep === 'task' ? <EditorUnifiedDescriptionPanel /> : null}
                {activeStep === 'knowledge_base' ? <EditorKnowledgeBasePanel /> : null}
                {activeStep === 'backend' ? <EditorBackendsTabPanel /> : null}
                {activeStep === 'prompts' ? <EditorUseCasesPanel /> : null}
                {activeStep === 'conversation' ? <EditorConversationPanel /> : null}
              </div>
            </div>
            <ReviewAutoSaveEffect />
            <DesignerLlmSetupOverlay scope="contained" />
          </div>
      </AIAgentEditorDockProvider>
    </FontProvider>
  );
}

/** Must render under {@link ReviewOmniaProviders} — mounts isolated {@link ReviewSnapshotProjectProvider}. */
function ReviewUseCaseWorkspaceInner({
  session,
  backends,
  activeStep,
  setActiveStep,
  stepBadges,
  composerError,
  setComposerError,
  closeSession,
  lastSavedAt,
  saving,
  status,
  designerLlm,
}: ReviewUseCaseWorkspaceInnerProps): React.ReactElement {
  const setBackends = useReviewStore((s) => s.setBackends);
  const backendPlaceholders = React.useMemo(
    () => backendPlaceholdersFromReviewSnapshot(backends),
    [backends]
  );
  const onBackendSnapshotChange = React.useCallback(
    (snapshot: AgentReviewBackendSnapshot | null) => {
      setBackends(snapshot);
    },
    [setBackends]
  );

  return (
    <ReviewSnapshotProjectProvider
      projectId={session.projectId}
      taskInstanceId={session.taskId}
      taskLabel={session.taskLabel}
      backendSnapshot={backends}
      backendPlaceholders={backendPlaceholders}
      onBackendSnapshotChange={onBackendSnapshotChange}
    >
      <ReviewUseCaseWorkspaceDocked
        session={session}
        activeStep={activeStep}
        setActiveStep={setActiveStep}
        stepBadges={stepBadges}
        composerError={composerError}
        setComposerError={setComposerError}
        closeSession={closeSession}
        lastSavedAt={lastSavedAt}
        saving={saving}
        status={status}
        designerLlm={designerLlm}
      />
    </ReviewSnapshotProjectProvider>
  );
}

export function ReviewUseCaseWorkspace(): React.ReactElement {
  const session = useReviewStore((s) => s.session)!;
  const useCases = useReviewStore((s) => s.useCases);
  const status = useReviewStore((s) => s.status);
  const saving = useReviewStore((s) => s.saving);
  const lastSavedAt = useReviewStore((s) => s.lastSavedAt);
  const closeSession = useReviewStore((s) => s.closeSession);
  const knowledgeBase = useReviewStore((s) => s.knowledgeBase);
  const backends = useReviewStore((s) => s.backends);
  const conversation = useReviewStore((s) => s.conversation);
  const designerLlm = useReviewStore((s) => s.designerLlm);

  const [activeStep, setActiveStep] = React.useState<ReviewPortalStepId>('task');
  const [composerError, setComposerError] = React.useState<string | null>(null);

  const stepBadges: Partial<Record<ReviewPortalStepId, number>> = {
    knowledge_base: knowledgeBase?.documents.length ?? 0,
    backend:
      (backends?.manualEntries?.length ?? backends?.catalogRows.length ?? 0) +
      (backends?.structuredPlaceholders.length ?? 0),
    prompts: useCases.length,
    conversation:
      (conversation?.conversationalRules.length ?? 0) +
      Object.keys(conversation?.styleSelections ?? {}).length,
  };

  return (
    <ReviewOmniaProviders designerLlm={designerLlm}>
      <ReviewUseCaseWorkspaceInner
        session={session}
        backends={backends}
        activeStep={activeStep}
        setActiveStep={setActiveStep}
        stepBadges={stepBadges}
        composerError={composerError}
        setComposerError={setComposerError}
        closeSession={closeSession}
        lastSavedAt={lastSavedAt}
        saving={saving}
        status={status}
        designerLlm={designerLlm}
      />
    </ReviewOmniaProviders>
  );
}
