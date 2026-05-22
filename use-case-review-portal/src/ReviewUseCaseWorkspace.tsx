/**
 * Workspace review: pannello use case condiviso (@omnia/domain-components).
 */

import React from 'react';
import { UseCaseReviewPanel, AgentReviewStructuredSectionsBlock } from '@omnia/domain-components';
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

      <AgentReviewStructuredSectionsBlock
        sections={structuredSections}
        readOnly
        className="shrink-0 px-4 pb-2"
        panelClassName="max-h-[220px]"
      />

      <div className="min-h-0 flex-1 overflow-hidden px-2 pb-2">
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
    </div>
  );
}
