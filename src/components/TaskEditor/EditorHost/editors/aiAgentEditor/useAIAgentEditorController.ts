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
  extractStructuredDesign,
  generateAIAgentDesign,
  generateAIAgentUseCases,
  regenerateAIAgentUseCaseApi,
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
import { nextMappingsAfterLabelBlur } from './flowVariableMapping';
import { buildAIAgentTaskPersistPatch, type AIAgentPersistState } from './buildPersistPatch';
import { resolveAiAgentOutputLanguage } from './resolveAiAgentOutputLanguage';
import { buildRefineUserDescFromSections } from './composeRuntimePromptMarkdown';
import { rulesStringForCompilerFromTaskFields } from './composeRuntimeRulesFromCompact';
import {
  applyStructuredIrToGenerateApplyResult,
  buildDeterministicRuntimeCompactFromSectionBases,
  parseStructuredDesignIrFromApi,
} from './applyExtractStructureIr';
import { structuredDesignForPipelinePhase3 } from './structuredDesignForPipeline';
import type { AgentStructuredSectionId } from './agentStructuredSectionIds';
import { AGENT_STRUCTURED_SECTION_IDS } from './agentStructuredSectionIds';
import {
  type AgentPromptPlatformId,
  type BackendPlaceholderInstance,
  type PlatformPromptOutput,
  buildAgentStructuredSections,
  compilePromptFromStructuredSections,
  formatBackendDisplayToken,
  formatPlatformPromptOutput,
  normalizeAgentPromptPlatformId,
} from '@domain/agentPrompt';
import {
  parsePersistedStructuredSectionsJson,
  serializePersistedStructuredSections,
  persistedFromCleanSectionBases,
} from './structuredSectionPersist';
import { revisionStateToPersisted } from './revisionStateToPersisted';
import { isStructuredSectionsOtEnabled } from './structuredOtFlag';
import { useStructuredAgentSectionsRevision } from './useStructuredAgentSectionsRevision';
import { effectiveBySectionFromPersistedStructured } from './structuredSectionsRevisionReducer';
import type { OtOp } from './otTypes';
import type { IaSectionDiffPair } from './AIAgentStructuredSectionsPanel';
import {
  buildLinearDocument,
  linearEditToBatchOps,
  type RevisionBatchOp,
} from './textRevisionLinear';
import { diffToOps } from './otDiffToOps';
import {
  logAiAgentDebug,
  logAiAgentPersistUseCases,
  summarizeAgentTaskFields,
  summarizeUseCasesForPersistLog,
} from './aiAgentDebug';
import { registerAiAgentProjectSaveFlush } from './aiAgentProjectSaveFlush';
import { registerAiAgentPromptAlignmentFlush } from './aiAgentPromptAlignmentFlush';
import type { IAAgentConfig } from 'types/iaAgentRuntimeSetup';
import {
  mergeConvaiAgentIdFromGlobalDefaults,
  normalizeIAAgentConfig,
  parseOptionalIaRuntimeJson,
  serializeIaAgentConfigForTaskPersistence,
} from '@utils/iaAgentRuntime/iaAgentConfigNormalize';
import { getConvaiSessionBinding } from '@utils/iaAgentRuntime/convaiSessionAgentStore';
import { loadGlobalIaAgentConfig } from '@utils/iaAgentRuntime/globalIaAgentPersistence';
import { iaConvaiTracePersistTaskRepository } from '@utils/debug/iaConvaiFlowTrace';
import { withElevenLabsReprovisionAfterTtsChange } from '@utils/iaAgentRuntime/applyElevenLabsReprovisionFlag';

function logStructuredPipelineAlignment(event: string, detail?: unknown): void {
  if (import.meta.env.DEV) {
    console.info(`[StructuredPipeline][Alignment] ${event}`, detail ?? '');
  }
}

/** Se il testo rules/prompt del task cambia, richiede un nuovo `createAgent` ConvAI (stesso meccanismo del TTS). */
function withElevenLabsReprovisionWhenTaskEditorPromptChanged(
  iaRuntime: IAAgentConfig,
  taskBefore: Task,
  nextAgentPrompt: string,
  nextRuntimeCompactJson: string
): IAAgentConfig {
  const hasConvaiSession = Boolean(getConvaiSessionBinding(taskBefore.id)?.agentId?.trim());
  if (iaRuntime.platform !== 'elevenlabs' || !hasConvaiSession) {
    return iaRuntime;
  }
  const prevText = rulesStringForCompilerFromTaskFields({
    agentRuntimeCompactJson: taskBefore.agentRuntimeCompactJson ?? '',
    agentPrompt: taskBefore.agentPrompt ?? '',
  });
  const nextText = rulesStringForCompilerFromTaskFields({
    agentRuntimeCompactJson: nextRuntimeCompactJson,
    agentPrompt: nextAgentPrompt,
  });
  if (prevText === nextText) return iaRuntime;
  return { ...iaRuntime, elevenLabsNeedsReprovision: true };
}

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
  const [previewStyleId, setPreviewStyleIdState] = React.useState<string>(AI_AGENT_DEFAULT_PREVIEW_STYLE_ID);
  const [initialStateTemplateJson, setInitialStateTemplateJson] = React.useState('{}');
  const [agentRuntimeCompactJson, setAgentRuntimeCompactJson] = React.useState('');
  /** True when persisted `runtime_compact` matches deterministic Phase-2 output for the current IR. */
  const [promptFinalAligned, setPromptFinalAligned] = React.useState(false);
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
  const [backendPlaceholders, setBackendPlaceholders] = React.useState<BackendPlaceholderInstance[]>([]);
  const [agentPromptTargetPlatform, setAgentPromptTargetPlatformState] =
    React.useState<AgentPromptPlatformId>(() => normalizeAgentPromptPlatformId(undefined));

  const [iaRuntimeConfig, setIaRuntimeConfigState] = React.useState<IAAgentConfig>(() =>
    loadGlobalIaAgentConfig()
  );
  /** Set in `loadFromRepository`: task has `agentIaRuntimeOverrideJson` vs copy of global defaults. */
  const [iaRuntimeLoadedFrom, setIaRuntimeLoadedFrom] = React.useState<'saved_override' | 'global_defaults'>(
    'global_defaults'
  );

  /** True only after `loadFromRepository` has applied repo data for this mount / reload. */
  const [hydrated, setHydrated] = React.useState(false);
  /** True when local state diverges from last persisted snapshot (user edits or generation). */
  const [dirty, setDirty] = React.useState(false);

  const committedStructuredJsonRef = React.useRef<string>('');
  /** Pending debounced persist; cleared on flush or unmount. */
  const persistTimerRef = React.useRef<ReturnType<typeof window.setTimeout> | null>(null);
  /** Why {@link persistEditorStateToRepository} ran (for persist logs). */
  const persistReasonRef = React.useRef<'debounced' | 'projectSave' | 'unmount' | 'direct'>('direct');
  /** Latest `dirty` / persist fn for unmount cleanup (avoids stale closure). */
  const dirtyRef = React.useRef(false);
  const persistEditorStateToRepositoryRef = React.useRef<() => void>(() => {});
  const persistInputsRef = React.useRef<AIAgentPersistState | null>(null);
  const effectiveBySectionRef = React.useRef<Record<AgentStructuredSectionId, string>>(
    {} as Record<AgentStructuredSectionId, string>
  );
  const promptFinalAlignedRef = React.useRef(promptFinalAligned);
  const hasAgentGenerationRef = React.useRef(hasAgentGeneration);
  const instanceIdRef = React.useRef(instanceId);
  const projectIdRef = React.useRef(projectId);
  const structuredOtEnabled = isStructuredSectionsOtEnabled();
  const structuredRev = useStructuredAgentSectionsRevision(structuredOtEnabled);
  const { loadFromPersisted } = structuredRev;

  effectiveBySectionRef.current = structuredRev.effectiveBySection;
  promptFinalAlignedRef.current = promptFinalAligned;
  hasAgentGenerationRef.current = hasAgentGeneration;
  instanceIdRef.current = instanceId;
  projectIdRef.current = projectId;

  const markPromptFinalMisaligned = React.useCallback((reason: string) => {
    setPromptFinalAligned((prev) => {
      if (prev) {
        logStructuredPipelineAlignment('promptFinalAligned -> false', { reason });
      }
      return false;
    });
  }, []);

  const agentPrompt = structuredRev.composedRuntimeMarkdown;
  const agentStructuredSectionsJson = React.useMemo(
    () =>
      serializePersistedStructuredSections(revisionStateToPersisted(structuredRev.sectionsState), {
        backendPlaceholders,
      }),
    [structuredRev.sectionsState, backendPlaceholders]
  );

  const compiledPlatformOutput = React.useMemo((): PlatformPromptOutput => {
    const e = structuredRev.effectiveBySection;
    const ir = buildAgentStructuredSections(
      {
        goal: e.goal ?? '',
        operational_sequence: e.operational_sequence ?? '',
        context: e.context ?? '',
        constraints: e.constraints ?? '',
        personality: e.personality ?? '',
        tone: e.tone ?? '',
        examples: e.examples ?? '',
      },
      backendPlaceholders
    );
    return compilePromptFromStructuredSections(ir, normalizeAgentPromptPlatformId(agentPromptTargetPlatform));
  }, [structuredRev.effectiveBySection, backendPlaceholders, agentPromptTargetPlatform]);

  const compiledPromptForTargetPlatform = React.useMemo(
    () => formatPlatformPromptOutput(compiledPlatformOutput),
    [compiledPlatformOutput]
  );

  const setDesignDescriptionUser = React.useCallback((v: React.SetStateAction<string>) => {
    setDirty(true);
    markPromptFinalMisaligned('designDescription');
    setDesignDescription(v);
  }, [markPromptFinalMisaligned]);

  const applyRevisionOps = React.useCallback(
    (sectionId: AgentStructuredSectionId, ops: readonly RevisionBatchOp[]) => {
      setDirty(true);
      markPromptFinalMisaligned('structuredSectionRevision');
      structuredRev.applyRevisionOps(sectionId, ops);
    },
    [structuredRev, markPromptFinalMisaligned]
  );

  const applyOtCommit = React.useCallback(
    (sectionId: AgentStructuredSectionId, newOps: readonly OtOp[]) => {
      setDirty(true);
      markPromptFinalMisaligned('structuredSectionOtCommit');
      structuredRev.applyOtCommit(sectionId, newOps);
    },
    [structuredRev, markPromptFinalMisaligned]
  );

  const undoSection = React.useCallback(
    (sectionId: AgentStructuredSectionId) => {
      setDirty(true);
      markPromptFinalMisaligned('structuredSectionUndo');
      structuredRev.undoSection(sectionId);
    },
    [structuredRev, markPromptFinalMisaligned]
  );

  const redoSection = React.useCallback(
    (sectionId: AgentStructuredSectionId) => {
      setDirty(true);
      markPromptFinalMisaligned('structuredSectionRedo');
      structuredRev.redoSection(sectionId);
    },
    [structuredRev, markPromptFinalMisaligned]
  );

  const setUseCasesUser = React.useCallback((v: React.SetStateAction<AIAgentUseCase[]>) => {
    setDirty(true);
    setUseCases(v);
  }, []);

  const setPreviewStyleId = React.useCallback((id: string) => {
    setDirty(true);
    setPreviewStyleIdState(id);
  }, []);

  const setAgentPromptTargetPlatform = React.useCallback((v: AgentPromptPlatformId) => {
    setDirty(true);
    markPromptFinalMisaligned('agentPromptTargetPlatform');
    setAgentPromptTargetPlatformState(normalizeAgentPromptPlatformId(v));
  }, [markPromptFinalMisaligned]);

  const hydratedRef = React.useRef(false);
  React.useEffect(() => {
    hydratedRef.current = hydrated;
  }, [hydrated]);

  const setIaRuntimeConfig = React.useCallback((next: IAAgentConfig) => {
    setDirty(true);
    setIaRuntimeConfigState((prev) => {
      const globals = loadGlobalIaAgentConfig();
      const merged = mergeConvaiAgentIdFromGlobalDefaults(next, globals);
      return withElevenLabsReprovisionAfterTtsChange(prev, merged, hydratedRef.current);
    });
  }, []);

  const insertBackendPathAtSection = React.useCallback(
    (sectionId: AgentStructuredSectionId, path: string, rangeStart: number, rangeEnd?: number) => {
      const trimmed = String(path ?? '').trim();
      if (!trimmed) return;
      const token = formatBackendDisplayToken(trimmed);
      const id =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `bp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      setDirty(true);
      markPromptFinalMisaligned('insertBackendPathAtSection');
      const eff = structuredRev.effectiveBySection[sectionId] ?? '';
      const s = Math.max(0, Math.min(Math.floor(rangeStart), eff.length));
      const e =
        rangeEnd === undefined ? s : Math.max(s, Math.min(Math.floor(rangeEnd), eff.length));
      const nextEff = eff.slice(0, s) + token + eff.slice(e);

      const slice = structuredRev.sectionsState[sectionId];

      if (structuredOtEnabled && slice.storageMode === 'ot' && slice.ot) {
        const ops = diffToOps(eff, nextEff);
        if (ops.length > 0) structuredRev.applyOtCommit(sectionId, ops);
      } else {
        const prevDoc = buildLinearDocument(slice.promptBaseText, slice.deletedMask, slice.inserts);
        const batchOps = linearEditToBatchOps(
          prevDoc.linear,
          nextEff,
          prevDoc.meta,
          slice.promptBaseText,
          slice.deletedMask,
          slice.inserts
        );
        if (batchOps.length > 0) structuredRev.applyRevisionOps(sectionId, batchOps);
      }
      setBackendPlaceholders((prev) => [...prev, { id, definitionId: trimmed }]);
    },
    [structuredRev, structuredOtEnabled, markPromptFinalMisaligned]
  );

  const insertBackendPathInDesign = React.useCallback((path: string, rangeStart: number, rangeEnd?: number) => {
    const trimmed = String(path ?? '').trim();
    if (!trimmed) return;
    const token = formatBackendDisplayToken(trimmed);
    const id =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `bp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setDirty(true);
    markPromptFinalMisaligned('insertBackendPathInDesign');
    setDesignDescription((prev) => {
      const p = String(prev ?? '');
      const s = Math.max(0, Math.min(Math.floor(rangeStart), p.length));
      const e =
        rangeEnd === undefined ? s : Math.max(s, Math.min(Math.floor(rangeEnd), p.length));
      return p.slice(0, s) + token + p.slice(e);
    });
    setBackendPlaceholders((prev) => [...prev, { id, definitionId: trimmed }]);
  }, [markPromptFinalMisaligned]);

  const loadFromRepository = React.useCallback(() => {
    if (!instanceId) return;
    const raw = taskRepository.getTask(instanceId);
    if (!raw) return;
    const b = buildTaskSnapshotFromRaw(raw);
    setDesignDescription(b.agentDesignDescription);
    const parsed = parsePersistedStructuredSectionsJson(b.agentStructuredSectionsJson, b.agentPrompt);
    loadFromPersisted(parsed.sections);
    setBackendPlaceholders(parsed.backendPlaceholders);
    committedStructuredJsonRef.current = serializePersistedStructuredSections(parsed.sections, {
      backendPlaceholders: parsed.backendPlaceholders,
    });
    setAgentPromptTargetPlatformState(normalizeAgentPromptPlatformId(b.agentPromptTargetPlatform));
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
    setPreviewStyleIdState(styleId);
    setInitialStateTemplateJson(
      b.agentInitialStateTemplateJson.trim() ? b.agentInitialStateTemplateJson : '{}'
    );
    setAgentRuntimeCompactJson(b.agentRuntimeCompactJson.trim());
    const hasGen = resolveHasAgentGeneration(b);
    setHasAgentGeneration(hasGen);
    setLogicalSteps(b.logicalSteps);
    setUseCases(b.useCases);
    const iaRaw = b.agentIaRuntimeOverrideJson.trim();
    if (iaRaw) {
      try {
        const globals = loadGlobalIaAgentConfig();
        {
          const merged = mergeConvaiAgentIdFromGlobalDefaults(
            normalizeIAAgentConfig(JSON.parse(iaRaw) as unknown),
            globals
          );
          const { convaiAgentId: _drop, ...iaWithoutConvaiId } = merged as IAAgentConfig & {
            convaiAgentId?: string;
          };
          setIaRuntimeConfigState(iaWithoutConvaiId as IAAgentConfig);
        }
        setIaRuntimeLoadedFrom('saved_override');
      } catch {
        setIaRuntimeConfigState(loadGlobalIaAgentConfig());
        setIaRuntimeLoadedFrom('global_defaults');
      }
    } else {
      setIaRuntimeConfigState(loadGlobalIaAgentConfig());
      setIaRuntimeLoadedFrom('global_defaults');
    }
    setUseCaseComposerError(null);
    setIaRevisionDiffBySection(null);
    const effLoaded = effectiveBySectionFromPersistedStructured(parsed.sections);
    const expectedCompact = JSON.stringify(
      buildDeterministicRuntimeCompactFromSectionBases({
        goal: effLoaded.goal ?? '',
        operational_sequence: effLoaded.operational_sequence ?? '',
        context: effLoaded.context ?? '',
        constraints: effLoaded.constraints ?? '',
        personality: effLoaded.personality ?? '',
        tone: effLoaded.tone ?? '',
        examples: effLoaded.examples ?? '',
      }),
      null,
      2
    );
    setPromptFinalAligned(!hasGen || expectedCompact.trim() === b.agentRuntimeCompactJson.trim());
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
    const reason = persistReasonRef.current;
    persistReasonRef.current = 'direct';
    const agentUseCasesJson = serializeUseCases(useCases);
    const taskBeforePersist = taskRepository.getTask(instanceId);
    let iaRuntimeForPersist = mergeConvaiAgentIdFromGlobalDefaults(
      iaRuntimeConfig,
      loadGlobalIaAgentConfig()
    );
    if (taskBeforePersist) {
      iaRuntimeForPersist = withElevenLabsReprovisionWhenTaskEditorPromptChanged(
        iaRuntimeForPersist,
        taskBeforePersist,
        agentPrompt,
        agentRuntimeCompactJson
      );
    }
    const patch = buildAIAgentTaskPersistPatch({
      designDescription,
      agentPrompt,
      agentPromptTargetPlatform: normalizeAgentPromptPlatformId(agentPromptTargetPlatform),
      agentStructuredSectionsJson,
      outputVariableMappings,
      proposedFields,
      previewByStyle,
      previewStyleId,
      initialStateTemplateJson,
      agentRuntimeCompactJson,
      hasAgentGeneration,
      agentLogicalStepsJson: serializeLogicalSteps(logicalSteps),
      agentUseCasesJson,
      agentIaRuntimeOverrideJson: serializeIaAgentConfigForTaskPersistence(iaRuntimeForPersist),
    }) as Record<string, unknown>;
    const ok = taskRepository.updateTask(instanceId, patch as Partial<Task>, projectId);
    if (!ok) {
      console.error('[useAIAgentEditorController] taskRepository.updateTask failed — task missing from repository', {
        instanceId,
      });
      return;
    }
    logAiAgentPersistUseCases('TaskRepository.updateTask (in-memory before Mongo)', {
      reason,
      instanceId,
      projectId: projectId ?? null,
      agentUseCasesJsonChars: agentUseCasesJson.length,
      logicalStepsCount: logicalSteps.length,
      ...summarizeUseCasesForPersistLog(useCases),
    });
    // Do not update committedDesignDescription / committedStructuredJsonRef here — baseline for Create vs Refine only.
    setDirty(false);
    logAiAgentDebug('after updateTask', summarizeAgentTaskFields(taskRepository.getTask(instanceId)));
  }, [
    instanceId,
    hydrated,
    projectId,
    designDescription,
    agentPrompt,
    agentPromptTargetPlatform,
    agentStructuredSectionsJson,
    outputVariableMappings,
    proposedFields,
    previewByStyle,
    previewStyleId,
    initialStateTemplateJson,
    agentRuntimeCompactJson,
    hasAgentGeneration,
    logicalSteps,
    useCases,
    iaRuntimeConfig,
  ]);

  /**
   * Persists IA runtime override: parse repo JSON (or global defaults), merge `partial`, normalize twice,
   * write only `agentIaRuntimeOverrideJson`. TaskRepository is the source of truth; no hydrated gate.
   */
  const persistIaRuntimeOverrideSnapshot = React.useCallback(
    (partial: Partial<IAAgentConfig>) => {
      if (!instanceId) {
        console.error('[useAIAgentEditorController] persistIaRuntimeOverrideSnapshot: missing instanceId');
        return;
      }
      console.log('[IA·ConvAI] DIAG persist start', {
        taskId: instanceId,
        partialKeys: Object.keys(partial),
        partialConvaiAgentId: partial.convaiAgentId,
        partialConvaiAgentIdChars: partial.convaiAgentId?.length ?? 0,
      });
      const task = taskRepository.getTask(instanceId);
      console.log('[IA·ConvAI] DIAG repo before update', {
        taskId: instanceId,
        repoTaskFound: !!task,
        repoJsonChars: task?.agentIaRuntimeOverrideJson?.length ?? 0,
        repoJson: task?.agentIaRuntimeOverrideJson,
      });
      if (!task) {
        console.error(
          '[useAIAgentEditorController] persistIaRuntimeOverrideSnapshot: task not in TaskRepository',
          { instanceId }
        );
        return;
      }

      persistReasonRef.current = 'direct';
      const globals = loadGlobalIaAgentConfig();
      const parsed = parseOptionalIaRuntimeJson(task.agentIaRuntimeOverrideJson);
      const base = normalizeIAAgentConfig(parsed ?? globals);
      const { convaiAgentId: _omitPartial, ...partialRest } = partial as Partial<IAAgentConfig> & {
        convaiAgentId?: string;
      };
      const updated = normalizeIAAgentConfig({ ...base, ...partialRest });
      const iaJson = serializeIaAgentConfigForTaskPersistence(updated);
      const { convaiAgentId: _u, ...updatedForUi } = updated as IAAgentConfig & { convaiAgentId?: string };
      console.log('[IA·ConvAI] DIAG updated override', {
        taskId: instanceId,
        updatedConvaiAgentId: '(non persistito — sessione tab)',
        updatedConvaiAgentIdChars: 0,
      });

      const ok = taskRepository.updateTask(
        instanceId,
        { agentIaRuntimeOverrideJson: iaJson } as Partial<Task>,
        projectId
      );
      console.log('[IA·ConvAI] DIAG repo after update', {
        taskId: instanceId,
        newJsonChars: iaJson.length,
        newJson: iaJson,
      });
      if (!ok) {
        console.error('[useAIAgentEditorController] persistIaRuntimeOverrideSnapshot: updateTask failed', {
          instanceId,
        });
        return;
      }

      setIaRuntimeConfigState(updatedForUi as IAAgentConfig);
      setIaRuntimeLoadedFrom('saved_override');
      setDirty(false);
      iaConvaiTracePersistTaskRepository(instanceId, iaJson);
      logAiAgentDebug('after persistIaRuntimeOverrideSnapshot', summarizeAgentTaskFields(taskRepository.getTask(instanceId)));
    },
    [instanceId, projectId]
  );

  /**
   * Persists current {@link iaRuntimeConfig} into `agentIaRuntimeOverrideJson` on the task (plus full agent patch).
   */
  const saveIaRuntimeOverrideToTask = React.useCallback(() => {
    if (!instanceId || !hydrated) return;
    if (persistTimerRef.current) {
      window.clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    }
    persistReasonRef.current = 'direct';
    persistEditorStateToRepository();
    setIaRuntimeLoadedFrom('saved_override');
  }, [instanceId, hydrated, persistEditorStateToRepository]);

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
      persistReasonRef.current = 'debounced';
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
      persistReasonRef.current = 'projectSave';
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
        persistReasonRef.current = 'unmount';
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
    const nlDescription = designDescription.trim();
    const descriptionChanged =
      refining && nlDescription !== committedDesignDescription.trim();
    const structuredRegenerateScope = refining
      ? descriptionChanged
        ? ('from_description' as const)
        : ('sections_only' as const)
      : undefined;

    if (structuredRegenerateScope === 'sections_only') {
      const userDescForMin = `${nlDescription}\n\n---\n\n${buildRefineUserDescFromSections(structuredRev.effectiveBySection).trim()}`.trim();
      if (userDescForMin.length < AI_AGENT_MIN_INPUT_CHARS) {
        setGenerateError(
          `Inserisci almeno ${AI_AGENT_MIN_INPUT_CHARS} caratteri complessivi nelle sezioni (o nella descrizione) per Refine.`
        );
        return;
      }
    } else if (nlDescription.length < AI_AGENT_MIN_INPUT_CHARS) {
      setGenerateError(
        `Inserisci almeno ${AI_AGENT_MIN_INPUT_CHARS} caratteri nella descrizione del task.`
      );
      return;
    }

    const prevEff = { ...structuredRev.effectiveBySection };
    setGenerateError(null);
    setGenerating(true);
    try {
      const { tag: outputLanguage } = resolveAiAgentOutputLanguage();
      const structuredDesignForPhase3Payload =
        structuredRegenerateScope === 'sections_only'
          ? structuredDesignForPipelinePhase3(
              structuredRev.effectiveBySection as Record<string, string | undefined>
            )
          : undefined;
      const compilePlatform = normalizeAgentPromptPlatformId(agentPromptTargetPlatform);

      if (structuredRegenerateScope === 'sections_only') {
        const result = await generateAIAgentDesign({
          userDesc: nlDescription,
          provider,
          model,
          outputLanguage,
          compilePlatform,
          structuredRegenerateScope: 'sections_only',
          ...(structuredDesignForPhase3Payload
            ? { structuredDesignForPhase3: structuredDesignForPhase3Payload as Record<string, unknown> }
            : {}),
        });
        if (result.mode !== 'sections_only') {
          throw new Error('Risposta server inattesa: atteso compile sections_only.');
        }
        logAiAgentDebug('structured_pipeline_sections_only', {
          platform: result.platform,
          systemPromptChars: result.system_prompt.length,
        });
        setIaRevisionDiffBySection(null);
        setDirty(true);
        markPromptFinalMisaligned('structured_pipeline_sections_only');
        return;
      }

      const rawIr = await extractStructuredDesign({
        description: nlDescription,
        provider,
        model,
        outputLanguage,
      });
      const ir = parseStructuredDesignIrFromApi(rawIr);
      if (!ir) {
        throw new Error('Risposta extract-structure non valida o JSON IR incompleto.');
      }
      const applied = applyStructuredIrToGenerateApplyResult(ir);
      setProposedFields(applied.proposedFields);
      structuredRev.resetAllFromApiBases(applied.sectionBases);
      const nextPersist = persistedFromCleanSectionBases(applied.sectionBases, {
        structuredOt: structuredOtEnabled,
      });
      committedStructuredJsonRef.current = serializePersistedStructuredSections(nextPersist, {
        backendPlaceholders,
      });
      setPreviewByStyle(applied.previewByStyle);
      setInitialStateTemplateJson(applied.initialStateTemplateJson);
      setAgentRuntimeCompactJson(applied.agentRuntimeCompactJson);
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
      setPromptFinalAligned(true);
      setDirty(true);
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  }, [
    hasAgentGeneration,
    designDescription,
    committedDesignDescription,
    provider,
    model,
    structuredRev,
    structuredOtEnabled,
    backendPlaceholders,
    agentPromptTargetPlatform,
    markPromptFinalMisaligned,
  ]);

  const updateProposedField = React.useCallback(
    (slotId: string, patch: Partial<AIAgentProposedVariable>) => {
      setDirty(true);
      setProposedFields((prev) =>
        prev.map((p) => (p.slotId === slotId ? { ...p, ...patch } : p))
      );
    },
    []
  );

  const removeProposedField = React.useCallback((slotId: string) => {
    setDirty(true);
    setProposedFields((prev) => prev.filter((p) => p.slotId !== slotId));
    setOutputVariableMappings((prev) => {
      const next = { ...prev };
      delete next[slotId];
      return next;
    });
  }, []);

  const syncFlowVariableFromLabel = React.useCallback(
    (slotId: string, labelTrimmed: string) => {
      if (!projectId) return;
      setDirty(true);
      const flowId = getActiveFlowCanvasId();
      setOutputVariableMappings((prev) =>
        nextMappingsAfterLabelBlur(projectId, flowId, prev, slotId, labelTrimmed)
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

  persistInputsRef.current = {
    designDescription,
    agentPrompt,
    agentPromptTargetPlatform: normalizeAgentPromptPlatformId(agentPromptTargetPlatform),
    agentStructuredSectionsJson,
    outputVariableMappings,
    proposedFields,
    previewByStyle,
    previewStyleId,
    initialStateTemplateJson,
    agentRuntimeCompactJson,
    hasAgentGeneration,
    agentLogicalStepsJson: serializeLogicalSteps(logicalSteps),
    agentUseCasesJson: serializeUseCases(useCases),
    agentIaRuntimeOverrideJson: serializeIaAgentConfigForTaskPersistence(
      mergeConvaiAgentIdFromGlobalDefaults(iaRuntimeConfig, loadGlobalIaAgentConfig())
    ),
  };

  const ensurePromptFinalDeterministicCompileSync = React.useCallback((reason: string) => {
    const id = instanceIdRef.current;
    if (!id || !hydratedRef.current || !hasAgentGenerationRef.current) {
      return;
    }
    if (promptFinalAlignedRef.current) {
      return;
    }
    const eff = effectiveBySectionRef.current;
    const runtime = buildDeterministicRuntimeCompactFromSectionBases({
      goal: eff.goal ?? '',
      operational_sequence: eff.operational_sequence ?? '',
      context: eff.context ?? '',
      constraints: eff.constraints ?? '',
      personality: eff.personality ?? '',
      tone: eff.tone ?? '',
      examples: eff.examples ?? '',
    });
    const nextJson = JSON.stringify(runtime, null, 2);
    const basePersistence = persistInputsRef.current;
    if (!basePersistence) {
      return;
    }
    const prevTrim = (basePersistence.agentRuntimeCompactJson ?? '').trim();
    if (nextJson.trim() === prevTrim) {
      promptFinalAlignedRef.current = true;
      setPromptFinalAligned(true);
      return;
    }
    logStructuredPipelineAlignment('recompile prompt finale (deterministic)', { reason, chars: nextJson.length });
    if (reason === 'beforeFlowCompile') {
      logStructuredPipelineAlignment('debug required deterministic recompile', { instanceId: id });
    }
    const patch = buildAIAgentTaskPersistPatch({
      ...basePersistence,
      agentRuntimeCompactJson: nextJson,
    }) as Record<string, unknown>;
    const ok = taskRepository.updateTask(id, patch as Partial<Task>, projectIdRef.current);
    if (!ok) {
      console.error('[useAIAgentEditorController] ensurePromptFinalDeterministicCompileSync: updateTask failed', {
        instanceId: id,
      });
      return;
    }
    setAgentRuntimeCompactJson(nextJson);
    promptFinalAlignedRef.current = true;
    setPromptFinalAligned(true);
  }, []);

  React.useEffect(() => {
    return registerAiAgentPromptAlignmentFlush(() => {
      ensurePromptFinalDeterministicCompileSync('beforeFlowCompile');
    });
  }, [ensurePromptFinalDeterministicCompileSync]);

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
    structuredDesignDirty,
    applyRevisionOps,
    applyOtCommit,
    undoSection,
    redoSection,
    structuredOtEnabled,
    outputVariableMappings,
    proposedFields,
    previewByStyle,
    setPreviewByStyle,
    previewStyleId,
    setPreviewStyleId,
    initialStateTemplateJson,
    setInitialStateTemplateJson,
    agentRuntimeCompactJson,
    promptFinalAligned,
    ensurePromptFinalDeterministicCompile: ensurePromptFinalDeterministicCompileSync,
    generating,
    generateError,
    iaRevisionDiffBySection,
    dismissIaRevisionForSection,
    hasAgentGeneration,
    showPrimaryAgentAction,
    handleGenerate,
    updateProposedField,
    removeProposedField,
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
    backendPlaceholders,
    insertBackendPathAtSection,
    insertBackendPathInDesign,
    agentPromptTargetPlatform,
    setAgentPromptTargetPlatform,
    compiledPlatformOutput,
    compiledPromptForTargetPlatform,
    iaRuntimeConfig,
    setIaRuntimeConfig,
    iaRuntimeLoadedFrom,
    saveIaRuntimeOverrideToTask,
    persistIaRuntimeOverrideSnapshot,
  };
}
