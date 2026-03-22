/**
 * Use Case Composer: tree of scenarios, metadata fields, dialogue via chat preview bridge.
 */

import React from 'react';
import { GitBranch, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import type { AIAgentLogicalStep, AIAgentUseCase } from '@types/aiAgentUseCases';
import { AI_AGENT_DEFAULT_PREVIEW_STYLE_ID } from '@types/aiAgentPreview';
import type { AIAgentPreviewTurn } from '@types/aiAgentPreview';
import { AIAgentPreviewChatPanel } from './AIAgentPreviewChatPanel';
import { orderUseCasesWithDepth } from './useCaseTreeOrder';
import { previewToUseCaseDialogue, useCaseDialogueToPreview } from './useCaseDialogueBridge';

export interface AIAgentUseCaseComposerProps {
  logicalSteps: readonly AIAgentLogicalStep[];
  useCases: readonly AIAgentUseCase[];
  setUseCases: React.Dispatch<React.SetStateAction<AIAgentUseCase[]>>;
  busy: boolean;
  error: string | null;
  onDismissError: () => void;
  onGenerateBundle: () => void | Promise<void>;
  onRegenerateUseCase: (useCaseId: string) => void | Promise<void>;
  onRegenerateTurn: (useCaseId: string, turnId: string) => void | Promise<void>;
  primaryAgentActionLabel: string;
}

export function AIAgentUseCaseComposer({
  logicalSteps,
  useCases,
  setUseCases,
  busy,
  error,
  onDismissError,
  onGenerateBundle,
  onRegenerateUseCase,
  onRegenerateTurn,
  primaryAgentActionLabel,
}: AIAgentUseCaseComposerProps) {
  const { ordered, depthById } = React.useMemo(() => orderUseCasesWithDepth(useCases), [useCases]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (useCases.length === 0) {
      setSelectedId(null);
      return;
    }
    setSelectedId((prev) => {
      if (prev && useCases.some((u) => u.id === prev)) return prev;
      const { ordered: o } = orderUseCasesWithDepth(useCases);
      return o[0]?.id ?? null;
    });
  }, [useCases]);

  const selected = selectedId ? useCases.find((u) => u.id === selectedId) : undefined;
  const previewTurns = React.useMemo(
    () =>
      selected
        ? useCaseDialogueToPreview(selected.dialogue, selected.bubble_notes)
        : [],
    [selected]
  );

  const patchSelected = React.useCallback(
    (patch: Partial<AIAgentUseCase>) => {
      if (!selectedId) return;
      setUseCases((prev) => prev.map((u) => (u.id === selectedId ? { ...u, ...patch } : u)));
    },
    [selectedId, setUseCases]
  );

  const handlePreviewTurnsChange = React.useCallback(
    (next: AIAgentPreviewTurn[]) => {
      if (!selectedId) return;
      setUseCases((prev) => {
        const uc = prev.find((u) => u.id === selectedId);
        if (!uc) return prev;
        const { dialogue, bubble_notes } = previewToUseCaseDialogue(next, uc.dialogue);
        return prev.map((u) => (u.id === selectedId ? { ...u, dialogue, bubble_notes } : u));
      });
    },
    [selectedId, setUseCases]
  );

  const firstTurnId = selected?.dialogue[0]?.turn_id;

  return (
    <div className="flex flex-col gap-3 min-h-0">
      {error ? (
        <div className="rounded-lg border border-red-800/80 bg-red-950/40 px-3 py-2 text-sm text-red-200 flex justify-between gap-2">
          <span className="min-w-0 break-words">{error}</span>
          <button
            type="button"
            onClick={onDismissError}
            className="shrink-0 text-red-300 hover:text-red-100 underline text-xs"
          >
            Chiudi
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void onGenerateBundle()}
          className="inline-flex items-center gap-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 px-3 py-2 text-sm font-medium text-white"
        >
          {busy ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
          Genera use case (IA)
        </button>
        <p className="text-xs text-slate-500 self-center">
          Usa la descrizione del task e il prompt runtime (come {primaryAgentActionLabel}). I passi logici e
          gli scenari vengono salvati sul task.
        </p>
      </div>

      {logicalSteps.length > 0 ? (
        <details className="rounded-lg border border-slate-800 bg-slate-900/50 text-sm">
          <summary className="cursor-pointer px-3 py-2 text-slate-400">
            Passi logici ({logicalSteps.length})
          </summary>
          <ol className="list-decimal pl-8 pr-3 pb-3 space-y-1 text-slate-300">
            {logicalSteps.map((s) => (
              <li key={s.id}>
                <span className="font-mono text-xs text-slate-500">{s.id}</span> — {s.description}
              </li>
            ))}
          </ol>
        </details>
      ) : null}

      <div className="flex flex-1 min-h-[280px] gap-2 flex-col sm:flex-row">
        <div className="sm:w-[38%] min-h-[120px] rounded-lg border border-slate-800 bg-slate-900/40 overflow-y-auto">
          {ordered.length === 0 ? (
            <div className="p-4 text-sm text-slate-500 text-center">
              Nessuno scenario. Genera con IA o crea il design agent prima.
            </div>
          ) : (
            <ul className="p-1">
              {ordered.map((u) => {
                const depth = depthById[u.id] ?? 0;
                const active = u.id === selectedId;
                return (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(u.id)}
                      className={`w-full text-left px-2 py-1.5 rounded text-sm truncate ${
                        active ? 'bg-violet-900/50 text-violet-100' : 'text-slate-300 hover:bg-slate-800/80'
                      }`}
                      style={{ paddingLeft: `${8 + depth * 12}px` }}
                    >
                      <GitBranch size={12} className="inline mr-1 opacity-60" />
                      {u.label || u.id}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex-1 min-h-0 flex flex-col gap-2 overflow-y-auto">
          {!selected ? (
            <div className="text-sm text-slate-500 p-4">Seleziona uno scenario.</div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onRegenerateUseCase(selected.id)}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
                  Rigenera scenario
                </button>
                {firstTurnId ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onRegenerateTurn(selected.id, firstTurnId)}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                  >
                    Rigenera primo turno
                  </button>
                ) : null}
              </div>

              <label className="block text-xs text-slate-500">
                Etichetta
                <input
                  type="text"
                  value={selected.label}
                  onChange={(e) => patchSelected({ label: e.target.value })}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
                />
              </label>

              <label className="block text-xs text-slate-500">
                Prompt di affinamento (per rigenerazione)
                <textarea
                  value={selected.refinement_prompt}
                  onChange={(e) => patchSelected({ refinement_prompt: e.target.value })}
                  rows={2}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className="block text-xs text-slate-500">
                  Note — comportamento
                  <textarea
                    value={selected.notes.behavior}
                    onChange={(e) =>
                      patchSelected({ notes: { ...selected.notes, behavior: e.target.value } })
                    }
                    rows={2}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
                  />
                </label>
                <label className="block text-xs text-slate-500">
                  Note — tono
                  <textarea
                    value={selected.notes.tone}
                    onChange={(e) => patchSelected({ notes: { ...selected.notes, tone: e.target.value } })}
                    rows={2}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
                  />
                </label>
              </div>

              <div className="flex-1 min-h-[200px] rounded-lg border border-slate-800 overflow-hidden">
                <AIAgentPreviewChatPanel
                  selectedStyleId={AI_AGENT_DEFAULT_PREVIEW_STYLE_ID}
                  onStyleIdChange={() => {}}
                  turns={previewTurns}
                  onTurnsChange={handlePreviewTurnsChange}
                  readOnly={busy}
                  emptyPlaceholder={
                    <div className="p-4 text-sm text-slate-500 text-center">Dialogo vuoto.</div>
                  }
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
