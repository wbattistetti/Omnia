/**
 * Workspace review: stesso composer accordion di Omnia (wizard), senza IA.
 */

import React from 'react';
import { FontProvider } from '@context/FontContext';
import { AIAgentUseCaseComposer } from '@components/TaskEditor/EditorHost/editors/aiAgentEditor/AIAgentUseCaseComposer';
import { ReviewOmniaProviders } from './ReviewOmniaProviders';
import { DEFAULT_AI_AGENT_GLOBAL_USE_CASE_STYLE_ID } from '@components/TaskEditor/EditorHost/editors/aiAgentEditor/constants';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import { useReviewStore } from './reviewStore';

const noopAsync = async (): Promise<null> => null;

export function ReviewUseCaseWorkspace(): React.ReactElement {
  const session = useReviewStore((s) => s.session)!;
  const useCases = useReviewStore((s) => s.useCases);
  const categories = useReviewStore((s) => s.categories);
  const description = useReviewStore((s) => s.description);
  const setDescription = useReviewStore((s) => s.setDescription);
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

  const [styleId, setStyleId] = React.useState(DEFAULT_AI_AGENT_GLOBAL_USE_CASE_STYLE_ID);
  const [composerError, setComposerError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!channelLoaded) return;
    if (useCases.length === 0 && !description.trim()) return;
    const t = window.setTimeout(() => void saveToServer(), 800);
    return () => clearTimeout(t);
  }, [
    channelLoaded,
    description,
    useCases,
    categories,
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

  const onCreateUseCase = React.useCallback(async (): Promise<string> => '', []);

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
        <label className="mt-2 block text-[10px] font-semibold uppercase tracking-wide text-teal-400/90">
          Descrizione task
        </label>
        <textarea
          className="mt-0.5 w-full min-h-[56px] rounded border border-slate-700 bg-slate-900/80 px-2 py-1.5 text-sm text-slate-100"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </header>

      <div className="min-h-0 flex-1 overflow-hidden px-2 pb-2">
        <ReviewOmniaProviders>
          <FontProvider>
            <AIAgentUseCaseComposer
            logicalSteps={[]}
            useCases={useCases}
            setUseCases={setUseCases as React.Dispatch<React.SetStateAction<AIAgentUseCase[]>>}
            busy={false}
            error={composerError}
            onDismissError={() => setComposerError(null)}
            onCreateUseCase={onCreateUseCase}
            onRegenerateUseCase={noopAsync}
            onRegenerateAgentMessage={noopAsync}
            onAnnotateAgentMessageForJson={async () => false}
            onDeleteUseCase={() => {}}
            useCaseGlobalStyleId={styleId}
            onUseCaseGlobalStyleIdChange={setStyleId}
            useCaseCategories={categories}
            onUseCaseCategoryLabelChange={onCategoryLabelChange}
            onUseCaseCategoryDescriptionChange={onCategoryDescriptionChange}
            primaryGenerateOnRightOnly
            reviewOnlyMode
            onSelectionChange={setSelectedUseCaseId}
            controlledSelectionId={selectedUseCaseId}
            composerCatalog="prompts"
            />
          </FontProvider>
        </ReviewOmniaProviders>
      </div>
    </div>
  );
}
