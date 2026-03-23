/**
 * State, repository sync, generation, and variable-linking logic for the AI Agent editor.
 *
 * Persistence (in-session → TaskRepository):
 * - `hydrated` is false until `loadFromRepository()` finishes for the current instance; no persist runs before that.
 * - `dirty` is false after hydration; set true only on user- or action-driven updates (not during load).
 * - Debounced persist (400ms) runs only when `hydrated && dirty`, reading current local state at flush time.
 * - Project save: `flushAiAgentEditorsBeforeProjectSave` calls `persistEditorStateToRepository` (no `dirty` gate) so bulk reads latest `agent*` fields.
 * - Optional downgrade checks live in `aiAgentPersistGuard` (tests / future diagnostics); debounced persist is still gated by `dirty`.
 * - `tasks:loaded`: re-hydrate from repo, reset hydrated + dirty.
 * - Unmount: if `dirty`, flush current editor state to repo (tab close before debounce).
 * - Durability: project save writes tasks to Mongo via the project save orchestrator.
 */

import React from 'react';
import { taskRepository } from '@services/TaskRepository';
import { TaskType, type Task } from '@types/taskTypes';
import {
  generateAIAgentDesign,
  generateAIAgentUseCases,
  regenerateAIAgentUseCaseApi,
  regenerateAIAgentUseCaseTurnApi,
} from '@services/aiAgentDesignApi';
import type { AIAgentProposedVariable } from '@types/aiAgentDesign';
import type { AIAgentLogicalStep, AIAgentUseCase } from '@types/aiAgentUseCases';
import { serializeLogicalSteps, serializeUseCases } from '@types/aiAgentUseCases';
import { normalizeEntityType } from '@types/dataEntityTypes';
import {
  AI_AGENT_DEFAULT_PREVIEW_STYLE_ID,
  mapSampleToPreviewTurns,
  normalizeAgentPreviewFromTask,
} from '@types/aiAgentPreview';
import type { AIAgentPreviewTurn } from '@types/aiAgentPreview';
import { getActiveFlowCanvasId } from '../../../../../flows/activeFlowCanvas';
import { buildTaskSnapshotFromRaw, resolveHasAgentGeneration } from './buildTaskSnapshot';
import { createDefaultAIAgentTaskPayload } from './createDefaultAIAgentTaskPayload';
import { AI_AGENT_MIN_INPUT_CHARS, EMPTY_OUTPUT_MAPPINGS } from './constants';
import { applyGenerateDesignPayload } from './mergeDesignFromApi';
import { nextMappingsAfterLabelBlur } from './flowVariableMapping';
import { buildAIAgentTaskPersistPatch } from './buildPersistPatch';
import { resolveAiAgentOutputLanguage } from './resolveAiAgentOutputLanguage';
import { buildRefineUserDescFromSections } from './composeRuntimePromptMarkdown';
import type { AgentStructuredSectionId } from './agentStructuredSectionIds';
import { AGENT_STRUCTURED_SECTION_IDS } from './agentStructuredSectionIds';
import {
  parsePersistedStructuredSectionsJson,
  serializePersistedStructuredSections,
  persistedFromCleanSectionBases,
} from './structuredSectionPersist';
import { revisionStateToPersisted } from './revisionStateToPersisted';
import { useStructuredAgentSectionsRevision } from './useStructuredAgentSectionsRevision';
import type { IaSectionDiffPair } from './AIAgentStructuredSectionsPanel';
import type { RevisionBatchOp } from './textRevisionLinear';
import { logAiAgentDebug, summarizeAgentTaskFields } from './aiAgentDebug';
import { registerAiAgentProjectSaveFlush } from './aiAgentProjectSaveFlush';

export interface UseAIAgentEditorControllerParams {
  instanceId: string | undefined;
  projectId: string | undefined;
  provider: string;
  model: string;
}

export function useAIAgentEditorController({
  instanceId,
  projectId,
  provider,
  model,
}: UseAIAgentEditorControllerParams) {
  const [designDescription, setDesignDescription] = React.useState('');
  const [outputVariableMappings, setOutputVariableMappings] = React.useState<Record<string, string>>(
    () => ({ ...EMPTY_OUTPUT_MAPPINGS })
  );
  const [proposedFields, setProposedFields] = React.useState<AIAgentProposedVariable[]>([]);
  const [previewByStyle, setPreviewByStyle] = React.useState<Record<string, AIAgentPreviewTurn[]>>({});
  const [previewStyleId, setPreviewStyleId] = React.useState<string>(AI_AGENT_DEFAULT_PREVIEW_STYLE_ID);
  const [initialStateTemplateJson, setInitialStateTemplateJson] = React.useState('{}');
  const [generating, setGenerating] = React.useState(false);
  const [generateError, setGenerateError] = React.useState<string | null>(null);
  const [iaRevisionDiffBySection, setIaRevisionDiffBySection] = React.useState<Partial<
    Record<AgentStructuredSectionId, IaSectionDiffPair>
  > | null>(null);
  const [hasAgentGeneration, setHasAgentGeneration] = React.useState(false);
  const [committedDesignDescription, setCommittedDesignDescription] = React.useState('');
  const [logicalSteps, setLogicalSteps] = React.useState<AIAgentLogicalStep[]>([]);
  const [useCases, setUseCases] = React.useState<AIAgentUseCase[]>([]);
  const [useCaseComposerBusy, setUseCaseComposerBusy] = React.useState(false);
  const [useCaseComposerError, setUseCaseComposerError] = React.useState<string | null>(null);

  /** True only after `loadFromRepository` has applied repo data for this mount / reload. */
  const [hydrated, setHydrated] = React.useState(false);
  /** True when local state diverges from last persisted snapshot (user edits or generation). */
  const [dirty, setDirty] = React.useState(false);

  const committedStructuredJsonRef = React.useRef<string>('');
  /** Pending debounced persist; cleared on flush or unmount. */
  const persistTimerRef = React.useRef<ReturnType<typeof window.setTimeout> | null>(null);
  /** Latest `dirty` / persist fn for unmount cleanup (avoids stale closure). */
  const dirtyRef = React.useRef(false);
  const persistEditorStateToRepositoryRef = React.useRef<() => void>(() => {});
  const structuredRev = useStructuredAgentSectionsRevision();
  const { loadFromPersisted } = structuredRev;

  const agentPrompt = structuredRev.composedRuntimeMarkdown;
  const agentStructuredSectionsJson = React.useMemo(
    () => serializePersistedStructuredSections(revisionStateToPersisted(structuredRev.sectionsState)),
    [structuredRev.sectionsState]
  );

  const setDesignDescriptionUser = React.useCallback((v: React.SetStateAction<string>) => {
    setDirty(true);
    setDesignDescription(v);
  }, []);

  const applyRevisionOps = React.useCallback(
    (sectionId: AgentStructuredSectionId, ops: readonly RevisionBatchOp[]) => {
      setDirty(true);
      structuredRev.applyRevisionOps(sectionId, ops);
    },
    [structuredRev]
  );

  const setUseCasesUser = React.useCallback((v: React.SetStateAction<AIAgentUseCase[]>) => {
    setDirty(true);
    setUseCases(v);
  }, []);

  const loadFromRepository = React.useCallback(() => {
    if (!instanceId) return;
    const raw = taskRepository.getTask(instanceId);
    if (!raw) return;
    const b = buildTaskSnapshotFromRaw(raw);
    setDesignDescription(b.agentDesignDescription);
    const parsed = parsePersistedStructuredSectionsJson(b.agentStructuredSectionsJson, b.agentPrompt);
    loadFromPersisted(parsed);
    committedStructuredJsonRef.current = serializePersistedStructuredSections(parsed);
    setCommittedDesignDescription(b.agentDesignDescription);
    setOutputVariableMappings(b.outputVariableMappings);
    setProposedFields(
      b.agentProposedFields.map((f) => ({
        ...f,
        type: normalizeEntityType(f.type),
      }))
    );
    const legacyTurns = mapSampleToPreviewTurns(
      Array.isArray(b.agentSampleDialogue) ? b.agentSampleDialogue : []
    );
    const { byStyle, styleId } = normalizeAgentPreviewFromTask(raw, legacyTurns);
    setPreviewByStyle(byStyle);
    setPreviewStyleId(styleId);
    setInitialStateTemplateJson(
      b.agentInitialStateTemplateJson.trim() ? b.agentInitialStateTemplateJson : '{}'
    );
    setHasAgentGeneration(resolveHasAgentGeneration(b));
    setLogicalSteps(b.logicalSteps);
    setUseCases(b.useCases);
    setUseCaseComposerError(null);
    setIaRevisionDiffBySection(null);
    logAiAgentDebug('loadFromRepository', {
      instanceId,
      ...summarizeAgentTaskFields(taskRepository.getTask(instanceId)),
    });
  }, [instanceId, loadFromPersisted]);

  /**
   * Writes current editor state into TaskRepository (full `buildAIAgentTaskPersistPatch`).
   * No `dirty` check — used before project save and on unmount when dirty.
   */
  const persistEditorStateToRepository = React.useCallback(() => {
    if (!instanceId || !hydrated) return;
    const patch = buildAIAgentTaskPersistPatch({
      designDescription,
      agentPrompt,
      agentStructuredSectionsJson,
      outputVariableMappings,
      proposedFields,
      previewByStyle,
      previewStyleId,
      initialStateTemplateJson,
      hasAgentGeneration,
      agentLogicalStepsJson: serializeLogicalSteps(logicalSteps),
      agentUseCasesJson: serializeUseCases(useCases),
    }) as Record<string, unknown>;
    const ok = taskRepository.updateTask(instanceId, patch as Partial<Task>, projectId);
    if (!ok) {
      console.error('[useAIAgentEditorController] taskRepository.updateTask failed — task missing from repository', {
        instanceId,
      });
      return;
    }
    // Do not update committedDesignDescription / committedStructuredJsonRef here — baseline for Create vs Refine only.
    setDirty(false);
    logAiAgentDebug('after updateTask', summarizeAgentTaskFields(taskRepository.getTask(instanceId)));
  }, [
    instanceId,
    hydrated,
    projectId,
    designDescription,
    agentPrompt,
    agentStructuredSectionsJson,
    outputVariableMappings,
    proposedFields,
    previewByStyle,
    previewStyleId,
    initialStateTemplateJson,
    hasAgentGeneration,
    logicalSteps,
    useCases,
  ]);

  dirtyRef.current = dirty;
  persistEditorStateToRepositoryRef.current = persistEditorStateToRepository;

  React.useLayoutEffect(() => {
    if (!instanceId) {
      setHydrated(false);
      return;
    }
    setHydrated(false);
    const existing = taskRepository.getTask(instanceId);
    if (!existing) {
      taskRepository.createTask(
        TaskType.AIAgent,
        null,
        createDefaultAIAgentTaskPayload() as Partial<Task>,
        instanceId,
        projectId
      );
    }
    loadFromRepository();
    setHydrated(true);
    setDirty(false);
  }, [instanceId, projectId, loadFromRepository]);

  /** Re-sync when project tasks are loaded from API into TaskRepository (fixes race: editor before load). */
  React.useEffect(() => {
    if (!instanceId || !projectId) return;
    const onTasksLoaded = (e: Event) => {
      const detail = (e as CustomEvent<{ projectId?: string }>).detail;
      if (detail?.projectId !== projectId) return;
      loadFromRepository();
      setHydrated(true);
      setDirty(false);
    };
    window.addEventListener('tasks:loaded', onTasksLoaded as EventListener);
    return () => window.removeEventListener('tasks:loaded', onTasksLoaded as EventListener);
  }, [instanceId, projectId, loadFromRepository]);

  /** Debounced persist: only after hydration and only when the user (or explicit actions) marked dirty. */
  React.useEffect(() => {
    if (!instanceId || !hydrated || !dirty) return;
    if (persistTimerRef.current) {
      window.clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    }
    persistTimerRef.current = window.setTimeout(() => {
      persistTimerRef.current = null;
      persistEditorStateToRepository();
    }, 400);
    return () => {
      if (persistTimerRef.current) {
        window.clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
    };
  }, [
    dirty,
    hydrated,
    instanceId,
    projectId,
    persistEditorStateToRepository,
  ]);

  /** Sync flush before project save pipeline reads TaskRepository (see `flushAiAgentEditorsBeforeProjectSave`). */
  React.useEffect(() => {
    const flushBeforeProjectSave = () => {
      if (persistTimerRef.current) {
        window.clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
      persistEditorStateToRepository();
    };
    return registerAiAgentProjectSaveFlush(flushBeforeProjectSave);
  }, [persistEditorStateToRepository]);

  /** On unmount, persist if still dirty (e.g. tab closed before debounce). Uses refs for latest persist + dirty. */
  React.useEffect(() => {
    return () => {
      if (persistTimerRef.current) {
        window.clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
      if (dirtyRef.current) {
        persistEditorStateToRepositoryRef.current();
      }
    };
  }, []);

  const dismissIaRevisionForSection = React.useCallback((sectionId: AgentStructuredSectionId) => {
    setDirty(true);
    setIaRevisionDiffBySection((prev) => {
      if (!prev) return null;
      const next = { ...prev };
      delete next[sectionId];
      return Object.keys(next).length > 0 ? next : null;
    });
  }, []);

  const handleGenerate = React.useCallback(async () => {
    const refining = hasAgentGeneration;
    const userDesc = refining
      ? `${designDescription.trim()}\n\n---\n\n${buildRefineUserDescFromSections(structuredRev.effectiveBySection).trim()}`.trim()
      : designDescription.trim();
    if (userDesc.length < AI_AGENT_MIN_INPUT_CHARS) {
      setGenerateError(
        refining
          ? `Inserisci almeno ${AI_AGENT_MIN_INPUT_CHARS} caratteri complessivi nelle sezioni (o nella descrizione) per Refine.`
          : `Inserisci almeno ${AI_AGENT_MIN_INPUT_CHARS} caratteri nella descrizione del task.`
      );
      return;
    }
    const prevEff = { ...structuredRev.effectiveBySection };
    setGenerateError(null);
    setGenerating(true);
    try {
      const { tag: outputLanguage } = resolveAiAgentOutputLanguage();
      const design = await generateAIAgentDesign({
        userDesc,
        provider,
        model,
        outputLanguage,
        ...(refining ? { sectionRefinements: structuredRev.collectRefinementBundles() } : {}),
      });
      const applied = applyGenerateDesignPayload(design);
      setProposedFields(applied.proposedFields);
      structuredRev.resetAllFromApiBases(applied.sectionBases);
      const nextPersist = persistedFromCleanSectionBases(applied.sectionBases);
      committedStructuredJsonRef.current = serializePersistedStructuredSections(nextPersist);
      setPreviewByStyle(applied.previewByStyle);
      setInitialStateTemplateJson(applied.initialStateTemplateJson);
      setOutputVariableMappings((prev) => applied.mergeOutputMappings(prev));
      setHasAgentGeneration(true);
      setCommittedDesignDescription(designDescription);
      if (refining) {
        const diff: Partial<Record<AgentStructuredSectionId, IaSectionDiffPair>> = {};
        for (const id of AGENT_STRUCTURED_SECTION_IDS) {
          const nextBase = applied.sectionBases[id];
          if (prevEff[id] !== nextBase) {
            diff[id] = { oldIaPrompt: prevEff[id], newIaPrompt: nextBase };
          }
        }
        setIaRevisionDiffBySection(Object.keys(diff).length > 0 ? diff : null);
      } else {
        setIaRevisionDiffBySection(null);
      }
      setDirty(true);
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  }, [hasAgentGeneration, designDescription, provider, model, structuredRev]);

  const updateProposedField = React.useCallback(
    (fieldName: string, patch: Partial<AIAgentProposedVariable>) => {
      setDirty(true);
      setProposedFields((prev) =>
        prev.map((p) => (p.field_name === fieldName ? { ...p, ...patch } : p))
      );
    },
    []
  );

  const syncFlowVariableFromLabel = React.useCallback(
    (fieldName: string, labelTrimmed: string) => {
      if (!projectId) return;
      setDirty(true);
      const flowId = getActiveFlowCanvasId();
      setOutputVariableMappings((prev) =>
        nextMappingsAfterLabelBlur(projectId, flowId, prev, fieldName, labelTrimmed)
      );
    },
    [projectId]
  );

  const clearUseCaseComposerError = React.useCallback(() => setUseCaseComposerError(null), []);

  const handleGenerateUseCaseBundle = React.useCallback(async () => {
    const userDesc = hasAgentGeneration
      ? `${designDescription.trim()}\n\n---\n\n${buildRefineUserDescFromSections(structuredRev.effectiveBySection).trim()}`.trim()
      : designDescription.trim();
    if (userDesc.length < AI_AGENT_MIN_INPUT_CHARS) {
      setUseCaseComposerError(
        `Inserisci almeno ${AI_AGENT_MIN_INPUT_CHARS} caratteri nella descrizione (o nelle sezioni strutturate dopo la prima generazione).`
      );
      return;
    }
    setUseCaseComposerError(null);
    setUseCaseComposerBusy(true);
    try {
      const { tag: outputLanguage } = resolveAiAgentOutputLanguage();
      const { logicalSteps: ls, useCases: ucs } = await generateAIAgentUseCases({
        userDesc,
        provider,
        model,
        runtimeContext: agentPrompt.trim(),
        outputLanguage,
      });
      setLogicalSteps(ls);
      setUseCases(ucs);
      setDirty(true);
    } catch (e) {
      setUseCaseComposerError(e instanceof Error ? e.message : String(e));
    } finally {
      setUseCaseComposerBusy(false);
    }
  }, [hasAgentGeneration, designDescription, structuredRev, agentPrompt, provider, model]);

  const handleRegenerateUseCase = React.useCallback(
    async (useCaseId: string) => {
      const uc = useCases.find((u) => u.id === useCaseId);
      if (!uc) {
        setUseCaseComposerError('Use case non trovato.');
        return;
      }
      setUseCaseComposerError(null);
      setUseCaseComposerBusy(true);
      try {
        const { tag: outputLanguage } = resolveAiAgentOutputLanguage();
        const next = await regenerateAIAgentUseCaseApi({
          useCase: uc,
          allUseCases: useCases,
          logicalSteps,
          provider,
          model,
          outputLanguage,
        });
        setUseCases((prev) =>
          prev.map((u) =>
            u.id === useCaseId
              ? {
                  ...next,
                  id: useCaseId,
                  parent_id: u.parent_id,
                  sort_order: u.sort_order,
                }
              : u
          )
        );
        setDirty(true);
      } catch (e) {
        setUseCaseComposerError(e instanceof Error ? e.message : String(e));
      } finally {
        setUseCaseComposerBusy(false);
      }
    },
    [useCases, logicalSteps, provider, model]
  );

  const handleRegenerateUseCaseTurn = React.useCallback(
    async (useCaseId: string, turnId: string) => {
      const uc = useCases.find((u) => u.id === useCaseId);
      if (!uc) {
        setUseCaseComposerError('Use case non trovato.');
        return;
      }
      const existingTurn = uc.dialogue.find((t) => t.turn_id === turnId);
      if (!existingTurn) {
        setUseCaseComposerError('Turno non trovato.');
        return;
      }
      setUseCaseComposerError(null);
      setUseCaseComposerBusy(true);
      try {
        const { tag: outputLanguage } = resolveAiAgentOutputLanguage();
        const nextTurn = await regenerateAIAgentUseCaseTurnApi({
          useCase: uc,
          turnId,
          provider,
          model,
          outputLanguage,
        });
        setUseCases((prev) =>
          prev.map((u) => {
            if (u.id !== useCaseId) return u;
            const dialogue = u.dialogue.map((t) =>
              t.turn_id === turnId
                ? {
                    ...t,
                    turn_id: turnId,
                    role: existingTurn.role,
                    content: nextTurn.content,
                  }
                : t
            );
            return { ...u, dialogue };
          })
        );
        setDirty(true);
      } catch (e) {
        setUseCaseComposerError(e instanceof Error ? e.message : String(e));
      } finally {
        setUseCaseComposerBusy(false);
      }
    },
    [useCases, provider, model]
  );

  const structuredDesignDirty = agentStructuredSectionsJson !== committedStructuredJsonRef.current;
  const descriptionDirty = designDescription !== committedDesignDescription;

  /** Pre–first generation: enough description to run Create Agent (same gate as handleGenerate). */
  const canOfferFirstGenerate =
    !hasAgentGeneration && designDescription.trim().length >= AI_AGENT_MIN_INPUT_CHARS;

  const showPrimaryAgentAction = generating
    ? true
    : hasAgentGeneration
      ? structuredDesignDirty || descriptionDirty
      : descriptionDirty || canOfferFirstGenerate;

  return {
    instanceId,
    designDescription,
    setDesignDescription: setDesignDescriptionUser,
    agentPrompt,
    structuredSectionsState: structuredRev.sectionsState,
    composedRuntimeMarkdown: structuredRev.composedRuntimeMarkdown,
    applyRevisionOps,
    outputVariableMappings,
    proposedFields,
    previewByStyle,
    setPreviewByStyle,
    previewStyleId,
    setPreviewStyleId,
    initialStateTemplateJson,
    setInitialStateTemplateJson,
    generating,
    generateError,
    iaRevisionDiffBySection,
    dismissIaRevisionForSection,
    hasAgentGeneration,
    showPrimaryAgentAction,
    handleGenerate,
    updateProposedField,
    syncFlowVariableFromLabel,
    logicalSteps,
    useCases,
    setLogicalSteps,
    setUseCases: setUseCasesUser,
    useCaseComposerBusy,
    useCaseComposerError,
    clearUseCaseComposerError,
    handleGenerateUseCaseBundle,
    handleRegenerateUseCase,
    handleRegenerateUseCaseTurn,
  };
}
