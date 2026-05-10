/**
 * Design-time shell for AI Agent tasks: composes dockable layout, toolbar wiring, and editor hooks.
 * Domain logic lives under `./aiAgentEditor/`; this file stays a thin orchestrator.
 */
import React from 'react';
import type { EditorProps } from '../types';
import { useProjectDataUpdate } from '@context/ProjectDataContext';
import { useAIProvider } from '@context/AIProviderContext';
import { Bot, Loader2, Sparkles } from 'lucide-react';
import { AI_AGENT_HEADER_COLOR, LABEL_GENERATE_USE_CASES, LABEL_GENERATING_IA_AGENT } from './aiAgentEditor/constants';
import type { AIAgentEditorDockContextValue } from './aiAgentEditor/AIAgentEditorDockContext';
import { AIAgentEditorDockShell } from './aiAgentEditor/AIAgentEditorDockShell';
import { useAIAgentEditorController } from './aiAgentEditor/useAIAgentEditorController';
import { useAIAgentToolbarController } from './aiAgentEditor/useAIAgentToolbarController';
import type { UseCaseGeneratorWizardStepId } from '@domain/useCaseGeneratorWizard/types';
import { applyAllDesignerVotesUp } from './aiAgentEditor/useCaseComposerDesignerVotes';
import { normalizeUseCaseSiblingOrder } from './aiAgentEditor/useCaseHierarchy';
import { useUseCaseGeneratorWizard } from './aiAgentEditor/useCaseGeneratorWizard/useUseCaseGeneratorWizard';
import { mergeAssistantPhraseDraftIntoUseCases } from './aiAgentEditor/mergeAssistantPhraseDraftIntoUseCases';

export default function AIAgentEditor({ task, onToolbarUpdate, hideHeader }: EditorProps) {
  const instanceId = task.instanceId || task.id;
  const pdUpdate = useProjectDataUpdate();
  const projectId = pdUpdate?.getCurrentProjectId() || undefined;
  const { provider, model } = useAIProvider();

  const deferAgentMessagesInUseCaseListRef = React.useRef(false);

  const c = useAIAgentEditorController({
    instanceId,
    projectId,
    provider,
    model,
    getDeferAgentMessages: () => deferAgentMessagesInUseCaseListRef.current,
  });

  const onConfirmAdvanceWithoutEdits = React.useCallback(
    (stepId: UseCaseGeneratorWizardStepId) => {
      if (stepId !== 'use_case_list') return;
      c.setUseCases((prev) => applyAllDesignerVotesUp(prev));
    },
    [c.setUseCases]
  );

  const [assistantPhraseDraftById, setAssistantPhraseDraftById] = React.useState<
    Record<string, string>
  >({});

  React.useEffect(() => {
    setAssistantPhraseDraftById({});
  }, [c.instanceId]);

  const useCasesForWizardStylePlan = React.useMemo(
    () => mergeAssistantPhraseDraftIntoUseCases(c.useCases, assistantPhraseDraftById),
    [c.useCases, assistantPhraseDraftById]
  );

  const onAssistantPhraseDraftChange = React.useCallback(
    (useCaseId: string | null, draftText: string | null) => {
      setAssistantPhraseDraftById((prev) => {
        if (useCaseId === null && draftText === null) return {};
        if (useCaseId === null) return prev;
        if (draftText === null) {
          if (!(useCaseId in prev)) return prev;
          const next = { ...prev };
          delete next[useCaseId];
          return next;
        }
        return { ...prev, [useCaseId]: draftText };
      });
    },
    []
  );

  const useCaseGenWizard = useUseCaseGeneratorWizard({
    instanceId: c.instanceId,
    useCases: useCasesForWizardStylePlan,
    taskPersistedWizardJson: c.agentUseCaseWizardStateJson,
    onWizardPersist: c.persistAgentUseCaseWizardState,
    onConfirmAdvanceWithoutEdits,
  });

  /** Always keep IA-generated assistant turns: lista use case mostra etichetta + scenario + messaggio. */
  deferAgentMessagesInUseCaseListRef.current = false;
  const captureUseCaseListAiBaseline = useCaseGenWizard.captureUseCaseListAiBaseline;

  const [useCaseBundleFeedback, setUseCaseBundleFeedback] = React.useState<string | null>(null);
  const [useCaseHighlightIds, setUseCaseHighlightIds] = React.useState<readonly string[]>([]);

  const dismissUseCaseBundleFeedback = React.useCallback(() => setUseCaseBundleFeedback(null), []);

  const [assistantPhraseStyleNewIds, setAssistantPhraseStyleNewIds] = React.useState<readonly string[]>([]);

  React.useEffect(() => {
    const id = useCaseGenWizard.currentStepId;
    if (id !== 'example_phrases' && id !== 'use_case_list') {
      setAssistantPhraseStyleNewIds([]);
    }
  }, [useCaseGenWizard.currentStepId]);

  const runPropagateExamplePhraseStyle = React.useCallback(async () => {
    const plan = useCaseGenWizard.examplePhraseStylePlan;
    if (!plan.showStyleCta) return;
    const res = await c.handlePropagateExamplePhraseStyle({
      styleExampleUseCaseIds: plan.modifiedIds,
      targetUseCaseIds: plan.targetIds,
    });
    if (res) {
      setAssistantPhraseDraftById({});
      useCaseGenWizard.captureExamplePhrasesBaseline(res.nextUseCases);
      setAssistantPhraseStyleNewIds(res.updatedIds);
      setUseCaseBundleFeedback('Messaggi aggiornati con il nuovo stile.');
    }
  }, [
    c.handlePropagateExamplePhraseStyle,
    useCaseGenWizard.captureExamplePhrasesBaseline,
    useCaseGenWizard.examplePhraseStylePlan,
  ]);

  const clearUseCaseHighlight = React.useCallback((useCaseId: string) => {
    setUseCaseHighlightIds((prev) => prev.filter((id) => id !== useCaseId));
  }, []);

  const runGenerateUseCaseBundle = React.useCallback(async () => {
    const result = await c.handleGenerateUseCaseBundle();
    if (!result) return;
    setAssistantPhraseDraftById({});
    captureUseCaseListAiBaseline(result.useCases);
    if (result.mode === 'extend' && result.addedCount > 0) {
      setUseCaseBundleFeedback(`Ho aggiunto ${result.addedCount} use case.`);
    } else if (result.mode === 'replace' && result.addedCount > 0) {
      setUseCaseBundleFeedback(`Generati ${result.addedCount} use case.`);
    } else {
      setUseCaseBundleFeedback(null);
    }
    setUseCaseHighlightIds(result.highlightIds);
  }, [c.handleGenerateUseCaseBundle, captureUseCaseListAiBaseline]);

  const runRegenerateUseCase = React.useCallback(
    async (useCaseId: string) => {
      const merged = await c.handleRegenerateUseCase(useCaseId);
      if (merged) {
        captureUseCaseListAiBaseline(
          normalizeUseCaseSiblingOrder(
            c.useCases.map((u) => (u.id === useCaseId ? merged : u)),
            c.useCaseSiblingSortMode
          )
        );
      }
      return merged;
    },
    [
      c.handleRegenerateUseCase,
      c.useCases,
      c.useCaseSiblingSortMode,
      captureUseCaseListAiBaseline,
    ]
  );

  /** Stable refs — inline `() => c.handleX()` in render made `primaryToolbarButtons` new every frame → toolbar useEffect → onToolbarUpdate loop. */
  const onPrimaryAgentAction = React.useCallback(() => {
    void c.handleGenerate();
  }, [c.handleGenerate]);

  const onGenerateUseCaseBundleAction = React.useCallback(() => {
    void runGenerateUseCaseBundle();
  }, [runGenerateUseCaseBundle]);

  const [promptFinaleJsMode, setPromptFinaleJsMode] = React.useState(false);

  const backendsAddManualHandlerRef = React.useRef<(() => void) | null>(null);
  const registerBackendsAddManualHandler = React.useCallback((handler: (() => void) | null) => {
    backendsAddManualHandlerRef.current = handler;
  }, []);
  const invokeBackendsAddManual = React.useCallback(() => {
    backendsAddManualHandlerRef.current?.();
  }, []);

  const showRightPanel =
    c.hasAgentGeneration ||
    c.proposedFields.length > 0 ||
    c.agentPrompt.trim().length > 0;

  const { primaryAgentActionLabel } = useAIAgentToolbarController({
    task,
    hideHeader,
    onToolbarUpdate,
    hasAgentGeneration: c.hasAgentGeneration,
    showRightPanel,
    showPrimaryAgentAction: c.showPrimaryAgentAction,
    generating: c.generating,
    useCaseComposerBusy: c.useCaseComposerBusy,
    useCaseBundleGenerationBusy: c.useCaseBundleGenerationBusy,
    useCasePhraseStylePropagationBusy: c.useCasePhraseStylePropagationBusy,
    onPrimaryAgentAction,
    onGenerateUseCaseBundle: onGenerateUseCaseBundleAction,
  });

  const headerColor = AI_AGENT_HEADER_COLOR;

  const headerAction = c.showPrimaryAgentAction ? (
    <button
      type="button"
      disabled={c.generating}
      onClick={() => void c.handleGenerate()}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-sm font-medium"
    >
      {c.generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
      {c.generating ? LABEL_GENERATING_IA_AGENT : primaryAgentActionLabel}
    </button>
  ) : null;

  const dockValue: AIAgentEditorDockContextValue = {
    instanceId: c.instanceId,
    hasAgentGeneration: c.hasAgentGeneration,
    designDescription: c.designDescription,
    setDesignDescription: c.setDesignDescription,
    composedRuntimeMarkdown: c.composedRuntimeMarkdown,
    structuredDesignDirty: c.structuredDesignDirty,
    structuredSectionsState: c.structuredSectionsState,
    onApplyRevisionOps: c.applyRevisionOps,
    onApplyOtCommit: c.applyOtCommit,
    onUndoSection: c.undoSection,
    onRedoSection: c.redoSection,
    structuredOtEnabled: c.structuredOtEnabled,
    iaRevisionDiffBySection: c.iaRevisionDiffBySection,
    onDismissIaRevisionForSection: c.dismissIaRevisionForSection,
    generating: c.generating,
    showRightPanel,
    headerAction,
    primaryAgentActionLabel,
    proposedFields: c.proposedFields,
    outputVariableMappings: c.outputVariableMappings,
    onUpdateProposedField: c.updateProposedField,
    onRemoveProposedField: c.removeProposedField,
    onProposedLabelBlur: c.syncFlowVariableFromLabel,
    logicalSteps: c.logicalSteps,
    useCases: c.useCases,
    setUseCases: c.setUseCases,
    useCaseComposerBusy: c.useCaseComposerBusy,
    useCaseBundleGenerationBusy: c.useCaseBundleGenerationBusy,
    useCasePhraseStylePropagationBusy: c.useCasePhraseStylePropagationBusy,
    useCaseCreationMessage: c.useCaseCreationMessage,
    useCaseComposerError: c.useCaseComposerError,
    onClearUseCaseComposerError: c.clearUseCaseComposerError,
    onGenerateUseCaseBundle: runGenerateUseCaseBundle,
    onCreateUseCase: c.handleCreateUseCase,
    onRegenerateUseCase: runRegenerateUseCase,
    onRegenerateAgentMessage: c.handleRegenerateAgentMessage,
    onAnnotateAgentMessageForJson: c.handleAnnotateAgentMessageForJson,
    onDeleteUseCase: c.handleDeleteUseCase,
    useCaseGlobalStyleId: c.useCaseGlobalStyleId,
    setUseCaseGlobalStyleId: c.setUseCaseGlobalStyleId,
    previewStyleId: c.previewStyleId,
    setPreviewStyleId: c.setPreviewStyleId,
    initialStateTemplateJson: c.initialStateTemplateJson,
    agentRuntimeCompactJson: c.agentRuntimeCompactJson,
    previewByStyle: c.previewByStyle,
    backendPlaceholders: c.backendPlaceholders,
    insertBackendPathAtSection: c.insertBackendPathAtSection,
    insertBackendPathInDesign: c.insertBackendPathInDesign,
    agentPromptTargetPlatform: c.agentPromptTargetPlatform,
    setAgentPromptTargetPlatform: c.setAgentPromptTargetPlatform,
    agentImmediateStart: c.agentImmediateStart,
    setAgentImmediateStart: c.setAgentImmediateStart,
    compiledPlatformOutput: c.compiledPlatformOutput,
    compiledPromptForTargetPlatform: c.compiledPromptForTargetPlatform,
    promptFinalAligned: c.promptFinalAligned,
    ensurePromptFinalDeterministicCompile: c.ensurePromptFinalDeterministicCompile,
    promptFinaleJsMode,
    setPromptFinaleJsMode,

    projectId,
    iaRuntimeConfig: c.iaRuntimeConfig,
    setIaRuntimeConfig: c.setIaRuntimeConfig,
    iaRuntimeLoadedFrom: c.iaRuntimeLoadedFrom,
    saveIaRuntimeOverrideToTask: c.saveIaRuntimeOverrideToTask,
    persistIaRuntimeOverrideSnapshot: c.persistIaRuntimeOverrideSnapshot,

    registerBackendsAddManualHandler,
    invokeBackendsAddManual,

    useCaseGeneratorWizard: useCaseGenWizard,

    useCaseBundleFeedback,
    onDismissUseCaseBundleFeedback: dismissUseCaseBundleFeedback,
    useCaseHighlightIds,
    onClearUseCaseHighlight: clearUseCaseHighlight,

    onPropagateExamplePhraseStyle: runPropagateExamplePhraseStyle,
    assistantPhraseStyleNewIds,
    onAssistantPhraseDraftChange,

    useCaseSiblingSortMode: c.useCaseSiblingSortMode,
    setUseCaseSiblingSortMode: c.setUseCaseSiblingSortMode,
  };

  const dockLayoutKey = `${c.instanceId ?? 'no-id'}-${c.hasAgentGeneration}-${showRightPanel}`;

  React.useEffect(() => {
    setPromptFinaleJsMode(false);
  }, [dockLayoutKey]);

  const hasOtSections = React.useMemo(
    () => Object.values(c.structuredSectionsState).some((s) => s.storageMode === 'ot'),
    [c.structuredSectionsState]
  );

  return (
    <div className="h-full w-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
      {!hideHeader && (
        <div
          className="flex items-center gap-2 px-4 py-2 border-b border-slate-800 shrink-0"
          style={{ borderLeftColor: headerColor, borderLeftWidth: 4 }}
        >
          <Bot size={20} style={{ color: headerColor }} />
          <span className="font-semibold shrink-0">AI Agent (design-time)</span>
          {c.structuredOtEnabled ? (
            <span
              title={
                hasOtSections
                  ? 'Sezioni strutturate in modalità OT: persistenza v2 (revisionBase, opLog, currentText).'
                  : 'Flag VITE_AI_AGENT_STRUCTURED_OT attivo. Dopo Generate/Refine le sezioni useranno OT e persistenza v2.'
              }
              className={`inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide border tabular-nums ${
                hasOtSections
                  ? 'border-emerald-500/55 bg-emerald-950/45 text-emerald-200'
                  : 'border-amber-500/45 bg-amber-950/35 text-amber-200/95'
              }`}
            >
              OT{hasOtSections ? ' v2' : ''}
            </span>
          ) : null}
          <div className="ml-auto flex min-w-0 items-center gap-3">
            <span className="text-xs text-slate-500 truncate">Task {c.instanceId}</span>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              {headerAction}
              {c.hasAgentGeneration && showRightPanel ? (
                <button
                  type="button"
                  disabled={
                    c.useCaseComposerBusy ||
                    c.useCaseBundleGenerationBusy ||
                    c.useCasePhraseStylePropagationBusy ||
                    c.generating
                  }
                  onClick={() => void runGenerateUseCaseBundle()}
                  className="inline-flex items-center gap-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 px-3 py-1.5 text-sm font-medium text-white"
                >
                  {c.useCaseBundleGenerationBusy || c.generating ? (
                    <Loader2 className="animate-spin" size={16} aria-hidden />
                  ) : (
                    <Sparkles size={16} aria-hidden />
                  )}
                  {c.useCaseBundleGenerationBusy || c.generating
                    ? 'Generando…'
                    : LABEL_GENERATE_USE_CASES}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <AIAgentEditorDockShell
          layoutKey={dockLayoutKey}
          hasAgentGeneration={c.hasAgentGeneration}
          showRightPanel={showRightPanel}
          value={dockValue}
          generateError={c.generateError}
        />
      </div>
    </div>
  );
}
