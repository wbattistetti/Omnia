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
import type { ConversationStyleSelections } from '@domain/aiAgentConversationStyle/conversationStyleSelections';
import {
  extractStructuredDesign,
  createAIAgentUseCaseApi,
  splitRootUseCaseDraftApi,
  generateAIAgentDesign,
  generateAIAgentUseCases,
  reorderAIAgentUseCasesNarratively,
  categorizeAIAgentUseCases,
  annotateAIAgentAssistantMessageForJsonApi,
  propagateExamplePhraseStyleApi,
  propagateCorrectionStyleApi,
  type PropagateCorrectionStyleParams,
  type PropagateCorrectionStyleResult,
  regenerateAIAgentUseCaseApi,
  regenerateAIAgentUseCaseTurnApi,
  generalizeAIAgentUseCaseMetaApi,
  polishUseCaseScenarioApi,
  proposeCompileSlotMappingsApi,
} from '@services/aiAgentDesignApi';
import type { AIAgentProposedVariable } from '@types/aiAgentDesign';
import type {
  AIAgentLogicalStep,
  AIAgentUseCase,
  AIAgentUseCaseCategory,
} from '@types/aiAgentUseCases';
import {
  newAgentUseCaseTurnId,
  parseAgentUseCaseBundleWithCategories,
  serializeLogicalSteps,
  serializeUseCases,
} from '@types/aiAgentUseCases';
import {
  formatCategorizationFailureBanner,
  validateCategorizationResult,
} from '@domain/aiAgentUseCase/useCaseCategorizationRun';
import {
  loadProjectSlotLexicon,
  saveProjectSlotLexicon,
} from '@domain/useCaseBundle/projectLexiconAccess';
import {
  CATALOG_IA_FIRST_COMPILE_OPTIONS,
  collectCatalogCompileInputs,
  collectMappingsFromUseCases,
  collectSurfacesInCatalogUseCases,
  compileAllUseCases,
} from '@domain/useCaseBundle/semanticCompile';
import {
  emptyProjectSlotLexicon,
  isUnclassifiedSlotId,
  isValidSlotId,
  listRegisteredSlotIds,
  mergeMappingsIntoLexicon,
  normalizeSlotId,
  normalizeSurface,
  pruneLexiconOrphans,
  resolveSlotIdFromDraft,
} from '@domain/useCaseBundle/projectSlotLexicon';
import type { ProjectSlotLexicon } from '@domain/useCaseBundle/projectSlotLexicon';
import { upsertDesignerSlotRegistryEntry } from '@domain/useCaseBundle/dynamicSlotRegistry';
import {
  emptyAgentBackendOutputSlotBindings,
  parseAgentBackendOutputSlotBindingsJson,
  serializeAgentBackendOutputSlotBindings,
} from '@domain/backendOutputSlotBinding/parseSerialize';
import type { AgentBackendOutputSlotBindings } from '@domain/backendOutputSlotBinding/types';
import { buildBindingsFingerprint } from '@domain/backendOutputSlotBinding/buildBindingsFingerprint';
import { applyCompileSlotMappingProposal } from '@domain/backendOutputSlotBinding/applyCompileSlotMappingProposal';
import {
  collectBackendToolCompileContexts,
  syncSlotContractsFromRows,
} from '@domain/backendOutputSlotBinding/slotBackendContract';
import { collectBackendSendLeavesFromTasks } from '@domain/backendOutputSlotBinding/collectBackendSendLeaves';
import { collectBackendSendLeavesByTask } from '@domain/backendOutputSlotBinding/collectBackendSendLeavesByTask';
import {
  collectBackendReceiveLeavesByTask,
  collectReceivePathsFromGroups,
} from '@domain/backendOutputSlotBinding/collectBackendReceiveLeavesByTask';
import {
  buildParameterDestinationCatalog,
  type ParameterDestination,
} from '@domain/backendOutputSlotBinding/parameterDestinationTree';
import { reconcileSendHintsWithCatalog } from '@domain/backendOutputSlotBinding/reconcileBindingsWithCatalog';
import { proposeSurfaceSendHint } from '@domain/backendOutputSlotBinding/surfaceSendHints';
import { mergeSendHintsIntoBindings, updateSendHintForSurface } from '@domain/backendOutputSlotBinding/mergeSendHints';
import type { TokenSendRole } from '@domain/backendOutputSlotBinding/types';
import { mergeConvaiBackendToolIdLists } from '@domain/iaAgentTools/manualCatalogBackendToolIds';
import { buildAgentWebhookReadinessReport } from '@domain/openApi/webhookOpenApiReadiness';
import { shouldRunIaCompileSlotMapping } from '@domain/useCaseBundle/catalogCompileBackendGate';
import { computeCatalogCompileValidation } from './useCaseBundle/catalogCompileValidation';
import { normalizeEntityType } from '@types/dataEntityTypes';
import { AI_CALL_PURPOSE } from '@domain/aiCalls/purposes';
import type { AgentTaskTextFieldId } from '@domain/aiAgent/agentTaskTextFieldIds';
import {
  stripAssistantTurnsFromUseCase,
  stripAssistantTurnsFromUseCases,
} from '@domain/aiAgentUseCase/stripAssistantTurnsFromUseCases';
import {
  applySystemProposedUseCaseDefaults,
  applySystemProposedUseCaseDefaultsBatch,
} from '@domain/aiAgentUseCase/useCaseSystemProposedDefaults';
import { remapExtendUseCaseIds } from '@domain/aiAgentUseCase/remapExtendUseCaseIds';
import {
  USE_CASE_BUNDLE_MAX_TOTAL,
  formatUseCaseExtendBatchFailureMessage,
} from '@domain/aiAgentUseCase/useCaseBundleChunkConfig';
import { getScenarioText, withScenarioText } from '@domain/aiAgentUseCase/scenarioText';
import {
  emptyAgentStartPromptConfig,
  parseAgentStartPromptJson,
  serializeAgentStartPromptConfig,
  type AgentStartPromptConfig,
} from '@domain/useCaseGeneratorWizard/agentStartPrompt';
import {
  createConversationalRuleFromLabel,
  serializeConversationalRules,
} from '@domain/conversationalRules/parseSerialize';
import type { ConversationalRule } from '@domain/conversationalRules/types';
import {
  AI_AGENT_DEFAULT_PREVIEW_STYLE_ID,
  mapSampleToPreviewTurns,
  normalizeAgentPreviewFromTask,
} from '@types/aiAgentPreview';
import type { AIAgentPreviewTurn } from '@types/aiAgentPreview';
import { getActiveFlowCanvasId } from '../../../../../flows/activeFlowCanvas';
import { buildTaskSnapshotFromRaw, resolveHasAgentGeneration } from './buildTaskSnapshot';
import { createDefaultAIAgentTaskPayload } from './createDefaultAIAgentTaskPayload';
import {
  AI_AGENT_GLOBAL_USE_CASE_STYLES,
  AI_AGENT_MIN_INPUT_CHARS,
  DEFAULT_AI_AGENT_GLOBAL_USE_CASE_STYLE_ID,
  EMPTY_OUTPUT_MAPPINGS,
  LABEL_CREATING_MULTIPLE_USE_CASES,
  LABEL_CREATING_ONE_USE_CASE,
} from './constants';
import { mergeUseCaseGlobalStyleContract } from './mergeUseCaseGlobalStyleContract';
import { logUseCaseRootBatch } from './useCaseRootBatchDebug';
import { nextMappingsAfterLabelBlur } from './flowVariableMapping';
import { buildAIAgentTaskPersistPatch, type AIAgentPersistState } from './buildPersistPatch';
import { useKnowledgeBaseDocuments } from '@domain/knowledgeBase/useKnowledgeBaseDocuments';
import {
  buildKbAgentTaskSummary,
  buildKbExistingUseCaseSummaries,
  buildKbTaskVariablesWire,
} from '@domain/knowledgeBase/kbAgentTaskContext';
import { buildAgentDesignUserDesc } from '@domain/agentDesign/buildAgentDesignUserDesc';
import {
  buildAgentRuntimeAnalysisAppendix,
  mergeRuntimeAnalysisIntoContext,
} from '@domain/agentDesign/buildAgentRuntimeAnalysisAppendix';
import {
  parseAgentKnowledgeBaseDocumentsJson,
  serializeAgentKnowledgeBaseDocuments,
} from '@domain/knowledgeBase/serializeKbDocuments';
import { useAgentDockUseCaseInvalidationHandlers } from '@domain/agentEditorDock/useAgentDockUseCaseInvalidationHandlers';
import { agentDockPromptsPanelHandlersFromInvalidation } from '@domain/agentEditorDock/agentDockPromptsPanelHandlers';
import type { MappingEntry } from '@components/FlowMappingPanel/mappingTypes';
import {
  agentInterfaceRowsToMappingEntries,
  mappingEntriesToAgentInterfaceRows,
  parseAgentInterfaceJson,
  serializeAgentInterfaceJson,
  AGENT_INTERFACE_SCHEMA_VERSION,
} from '@domain/agentInterface/agentInterfaceState';
import {
  AGENT_WIZARD_FIRST_STEP_INDEX,
  AGENT_WIZARD_LAST_STEP_INDEX,
  type AgentConstructionPhase,
  type AgentWizardStepIndex,
  isAgentWizardStepIndex,
} from '@domain/aiAgentConstruction/agentConstructionPhase';
import { resolveAiAgentOutputLanguage } from './resolveAiAgentOutputLanguage';
import { buildRefineUserDescFromSections } from './composeRuntimePromptMarkdown';
import { resolveElevenLabsAgentPromptFromTask } from './resolveAiAgentPlatformRulesString';
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
import { persistedSectionsFromReviewImport } from './structuredSectionsFromReviewImport';
import type { AgentReviewStructuredSections } from '@domain/agentReviewChannel/reviewDocument';
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
import {
  registerConvaiLiveIaConfig,
  unregisterConvaiLiveIaConfig,
} from '@utils/iaAgentRuntime/convaiLiveIaConfigBridge';
import { loadGlobalIaAgentConfig } from '@utils/iaAgentRuntime/globalIaAgentPersistence';
import { iaConvaiTracePersistTaskRepository } from '@utils/debug/iaConvaiFlowTrace';
import { withElevenLabsReprovisionAfterTtsChange } from '@utils/iaAgentRuntime/applyElevenLabsReprovisionFlag';
import { useProjectData, useProjectDataUpdate } from '@context/ProjectDataContext';
import { extractManualCatalogBackendTaskIdsFromProjectData } from '@domain/iaAgentTools/manualCatalogBackendToolIds';
import {
  appendUseCaseToSiblingGroup,
  applySiblingReorderForPersist,
  normalizeUseCaseSiblingOrder,
  type UseCaseSiblingSortMode,
} from './useCaseHierarchy';
import { OMNIA_AI_AGENT_REHYDRATE_FROM_REPO } from './aiAgentDockPanelIds';

function logStructuredPipelineAlignment(event: string, detail?: unknown): void {
  if (import.meta.env.DEV) {
    console.info(`[StructuredPipeline][Alignment] ${event}`, detail ?? '');
  }
}

/**
 * Se il testo rules/prompt del task o «Avvio immediato» cambiano, richiede un nuovo `createAgent` ConvAI
 * (`first_message` diverso sul payload ElevenLabs).
 */
function withElevenLabsReprovisionWhenTaskEditorPromptChanged(
  iaRuntime: IAAgentConfig,
  taskBefore: Task,
  next: {
    agentPrompt: string;
    agentRuntimeCompactJson: string;
    agentStructuredSectionsJson: string;
    agentPromptTargetPlatform: AgentPromptPlatformId;
    agentImmediateStart: boolean;
  },
  manualCatalogBackendTaskIds?: readonly string[],
  backendCatalog?: import('@domain/backendCatalog/catalogTypes').ProjectBackendCatalogBlob
): IAAgentConfig {
  const hasConvaiSession = Boolean(getConvaiSessionBinding(taskBefore.id)?.agentId?.trim());
  if (iaRuntime.platform !== 'elevenlabs' || !hasConvaiSession) {
    return iaRuntime;
  }
  const appendixOpts = { manualCatalogBackendTaskIds, backendCatalog };
  const prevText = resolveElevenLabsAgentPromptFromTask(taskBefore, appendixOpts);
  const nextTask: Task = {
    ...taskBefore,
    agentPrompt: next.agentPrompt,
    agentRuntimeCompactJson: next.agentRuntimeCompactJson,
    agentStructuredSectionsJson: next.agentStructuredSectionsJson,
    agentPromptTargetPlatform: next.agentPromptTargetPlatform,
    agentImmediateStart: next.agentImmediateStart,
  };
  const nextText = resolveElevenLabsAgentPromptFromTask(nextTask, appendixOpts);
  const promptChanged = prevText !== nextText;
  const immediateChanged =
    Boolean(taskBefore.agentImmediateStart) !== Boolean(next.agentImmediateStart);
  if (!promptChanged && !immediateChanged) return iaRuntime;
  return { ...iaRuntime, elevenLabsNeedsReprovision: true };
}

/** Esito generazione lista use case (full replace o aggiunta). */
export interface GenerateUseCaseBundleOutcome {
  useCases: readonly AIAgentUseCase[];
  mode: 'replace' | 'extend';
  /** Nuovi in questo batch (per messaggio UI). */
  addedCount: number;
  /** Id da evidenziare nel composer. */
  highlightIds: readonly string[];
  /** Nota ordinamento narrativo (solo generazione full replace). */
  useCaseOrderingNote?: string;
}

/** Categorizzazione LLM post-bundle con validazione esito. */
async function runBundleUseCaseCategorization(params: {
  useCases: AIAgentUseCase[];
  logicalSteps: AIAgentLogicalStep[];
  provider: string;
  model: string;
  outputLanguage: string;
  buildCallMeta: (purpose: string) => import('@services/aiAgentDesignApi').AiCallMeta;
  normalizeGenerated: (ucs: AIAgentUseCase[]) => AIAgentUseCase[];
}): Promise<{ useCases: AIAgentUseCase[]; categories: AIAgentUseCaseCategory[] }> {
  const cat = await categorizeAIAgentUseCases({
    useCases: params.useCases,
    logicalSteps: params.logicalSteps,
    provider: params.provider,
    model: params.model,
    outputLanguage: params.outputLanguage,
    callMeta: params.buildCallMeta(AI_CALL_PURPOSE.USE_CASE_CATEGORIZE),
  });
  validateCategorizationResult(cat.useCases, cat.categories);
  return {
    useCases: params.normalizeGenerated(cat.useCases),
    categories: cat.categories,
  };
}

export interface UseAIAgentEditorControllerParams {
  instanceId: string | undefined;
  projectId: string | undefined;
  provider: string;
  model: string;
  /**
   * Snapshot della label del task instance al momento del render. Inviato come `taskLabel`
   * nel cost log di ogni chiamata IA originata dal task editor: serve come header del nodo
   * "macro-task" nel report ad albero (vedi {@link import('../../../../services/aiAgentDesignApi').AiCallMeta}).
   */
  taskLabel?: string;
  /**
   * Passo 1 wizard: niente messaggi assistente su bundle/create (letto al momento dell’azione).
   */
  getDeferAgentMessages?: () => boolean;
}

export function useAIAgentEditorController({
  instanceId,
  projectId,
  provider,
  model,
  taskLabel,
  getDeferAgentMessages,
}: UseAIAgentEditorControllerParams) {
  const { data: projectData } = useProjectData();
  const { updateDataDirectly } = useProjectDataUpdate();
  const manualCatalogBackendTaskIds = React.useMemo(
    () => extractManualCatalogBackendTaskIdsFromProjectData(projectData),
    [projectData]
  );

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
  /** Baseline agente per revisione osservazioni (descrizione + sezioni strutturate). */
  const [taskTextBaselines, setTaskTextBaselines] = React.useState<Record<string, string>>(() => {
    const m: Record<string, string> = { designDescription: '' };
    for (const id of AGENT_STRUCTURED_SECTION_IDS) m[id] = '';
    return m;
  });
  const [taskTextReviewDismissed, setTaskTextReviewDismissed] = React.useState<
    Partial<Record<AgentTaskTextFieldId, boolean>>
  >({});
  /** True dopo edit manuale utente su un campo (reset a sync baseline / finalize IA). */
  const [taskTextManualEditByField, setTaskTextManualEditByField] = React.useState<
    Partial<Record<AgentTaskTextFieldId, boolean>>
  >({});
  const [logicalSteps, setLogicalSteps] = React.useState<AIAgentLogicalStep[]>([]);
  const [useCases, setUseCases] = React.useState<AIAgentUseCase[]>([]);
  const [useCaseCategories, setUseCaseCategories] = React.useState<AIAgentUseCaseCategory[]>([]);
  const [conversationalRules, setConversationalRules] = React.useState<ConversationalRule[]>([]);
  /** Ref: letto da setter senza dipendenze stale; default ordine dialogo (non alfabetico). */
  const useCaseSiblingSortModeRef = React.useRef<UseCaseSiblingSortMode>('logical');
  const [useCaseSiblingSortMode, setUseCaseSiblingSortModeState] =
    React.useState<UseCaseSiblingSortMode>('logical');
  const [useCaseGlobalStyleId, setUseCaseGlobalStyleIdState] = React.useState<string>(
    DEFAULT_AI_AGENT_GLOBAL_USE_CASE_STYLE_ID
  );
  /** Note designer persistite su `Task.agentUseCaseStyleLearningNotes`, unite al preset stile nelle API. */
  const [agentUseCaseStyleLearningNotes, setAgentUseCaseStyleLearningNotesState] =
    React.useState('');
  const [agentStartPromptConfig, setAgentStartPromptConfigState] = React.useState(() =>
    emptyAgentStartPromptConfig()
  );
  const [agentStartUseCaseId, setAgentStartUseCaseIdState] = React.useState('');
  const [useCaseComposerBusy, setUseCaseComposerBusy] = React.useState(false);
  /** Solo generazione bundle use case (wizard): non propagare agli altri pulsanti del pannello DX. */
  const [useCaseBundleGenerationBusy, setUseCaseBundleGenerationBusy] = React.useState(false);
  /** Conteggio use case generati durante il pipeline chunked (null se idle). */
  const [useCaseBundleGenerationCount, setUseCaseBundleGenerationCount] = React.useState<
    number | null
  >(null);
  /** Pass finale di riordino narrativo dopo i batch. */
  const [useCaseBundleGenerationOrdering, setUseCaseBundleGenerationOrdering] =
    React.useState(false);
  /** Pass IA di categorizzazione tematica dopo riordino narrativo. */
  const [useCaseBundleGenerationCategorizing, setUseCaseBundleGenerationCategorizing] =
    React.useState(false);
  /** Solo propagazione stile frasi esempio (LLM): indipendente da {@link useCaseBundleGenerationBusy}. */
  const [useCasePhraseStylePropagationBusy, setUseCasePhraseStylePropagationBusy] =
    React.useState(false);
  /** Progresso batch omogeneizzazione (use case per use case); null se idle. */
  const [useCasePhraseStyleBatchProgress, setUseCasePhraseStyleBatchProgress] = React.useState<{
    current: number;
    total: number;
  } | null>(null);
  const [useCaseComposerError, setUseCaseComposerError] = React.useState<string | null>(null);
  const [useCaseCreationMessage, setUseCaseCreationMessage] = React.useState<string | null>(null);
  const [backendPlaceholders, setBackendPlaceholders] = React.useState<BackendPlaceholderInstance[]>([]);
  const [agentPromptTargetPlatform, setAgentPromptTargetPlatformState] =
    React.useState<AgentPromptPlatformId>(() => normalizeAgentPromptPlatformId(undefined));
  const [agentImmediateStart, setAgentImmediateStartState] = React.useState(false);
  /** JSON wizard use case: passo pipeline + baseline IA (Task.agentUseCaseWizardStateJson). */
  const [agentUseCaseWizardStateJson, setAgentUseCaseWizardStateJson] = React.useState('');
  /**
   * Phase machine top-level del Task Editor AI Agent. Default difensivo: `'wizard'` per nuovi
   * task; `loadFromRepository` legge il valore reale (con fallback a `agentDesignHasGeneration`
   * via `resolveAgentConstructionPhase`).
   */
  const [agentConstructionPhase, setAgentConstructionPhaseState] =
    React.useState<AgentConstructionPhase>('wizard');
  /** Indice (0-based) dello step corrente del wizard di costruzione (0..4). */
  const [agentWizardCurrentStep, setAgentWizardCurrentStepState] =
    React.useState<AgentWizardStepIndex>(AGENT_WIZARD_FIRST_STEP_INDEX);
  /**
   * True dopo che l'utente ha cliccato «Cominciamo» nella Tutor di benvenuto.
   * Default false per nuovi task (mostriamo la Tutor); `loadFromRepository` legge il valore reale.
   */
  const [agentWizardTutorAcknowledged, setAgentWizardTutorAcknowledgedState] =
    React.useState(false);

  /**
   * Stato del **gate di stile v2 multi-pill** del passo «Conversazione».
   *
   * - `agentConversationStyleAuto`: checkbox **GLOBALE** «Lascia che Omnia scelga uno stile».
   *   Quando true, gli esempi non sono richiesti per nessuno stile checkato.
   * - `agentConversationStyleSelections`: mappa `styleId → { checked, description, example }`.
   *   Una entry per ogni stile attivato dal designer (con override testuali). Persiste anche
   *   se `checked=false` per non perdere le modifiche al toggle.
   * - `agentConversationDeployStyleId`: stile target di Upload (singolo per ora).
   *
   * Il vecchio `agentConversationStyleExample` viene mantenuto in stato per sopravvivere a un
   * load → save senza perdere il dato legacy, ma non viene più scritto dai setter (vedi
   * migrazione lazy in `buildTaskSnapshotFromRaw` → `migrateLegacyStyleExample`).
   */
  const [agentConversationStyleExample, setAgentConversationStyleExampleState] =
    React.useState('');
  const [agentConversationStyleAuto, setAgentConversationStyleAutoState] = React.useState(false);
  const [agentConversationStyleSelections, setAgentConversationStyleSelectionsState] =
    React.useState<ConversationStyleSelections>({});
  const [agentConversationDeployStyleId, setAgentConversationDeployStyleIdState] = React.useState<
    string | null
  >(null);

  /**
   * Toggle "Logga Use Case" del deploy menu. Quando true, il compilatore di prompt:
   *  1. Aggiunge `log: "USECASE: \"<N> — <NOME>\""` a ogni elemento di `UseCaseConversationalJson`.
   *  2. Antepone in testa al blocco use cases l'istruzione testuale per il caso
   *     "non riconosciuto" (vedi `Task.agentLogUseCase`).
   *
   * Default false: i task esistenti non cambiano comportamento finché il designer
   * non attiva esplicitamente la checkbox dal pannellino Upload.
   */
  const [agentLogUseCase, setAgentLogUseCaseState] = React.useState<boolean>(false);
  const [agentLogBackendCalls, setAgentLogBackendCallsState] = React.useState<boolean>(false);
  const [agentBehavior, setAgentBehaviorState] = React.useState<'A' | 'B' | 'C'>('B');
  const [agentInterfaceInput, setAgentInterfaceInputState] = React.useState<MappingEntry[]>([]);
  const [agentInterfaceOutput, setAgentInterfaceOutputState] = React.useState<MappingEntry[]>([]);
  const [compilePhrasesBusy, setCompilePhrasesBusy] = React.useState(false);
  const [backendOutputSlotBindings, setBackendOutputSlotBindings] =
    React.useState<AgentBackendOutputSlotBindings>(emptyAgentBackendOutputSlotBindings);
  const [compileMappingBanner, setCompileMappingBanner] = React.useState<string | null>(null);
  const openSlotMappingOnCompileFailRef = React.useRef<(() => void) | null>(null);
  const [projectSlotLexicon, setProjectSlotLexicon] = React.useState<ProjectSlotLexicon>(() =>
    loadProjectSlotLexicon(
      typeof localStorage !== 'undefined' ? localStorage.getItem('currentProjectId') : null
    )
  );

  const [iaRuntimeConfig, setIaRuntimeConfigState] = React.useState<IAAgentConfig>(() =>
    loadGlobalIaAgentConfig()
  );
  const backendTaskIdsMerged = React.useMemo(
    () =>
      mergeConvaiBackendToolIdLists(
        iaRuntimeConfig.convaiBackendToolTaskIds ?? [],
        manualCatalogBackendTaskIds ?? []
      ),
    [iaRuntimeConfig.convaiBackendToolTaskIds, manualCatalogBackendTaskIds]
  );

  const getBackendTask = React.useCallback(
    (id: string) => taskRepository.getTask(id),
    []
  );

  const buildWebhookReadinessReport = React.useCallback(
    () =>
      buildAgentWebhookReadinessReport({
        backendTaskIds: backendTaskIdsMerged,
        getTask: getBackendTask,
      }),
    [backendTaskIdsMerged, getBackendTask]
  );

  const backendSendLeavesByTask = React.useMemo(
    () => collectBackendSendLeavesByTask(backendTaskIdsMerged, getBackendTask),
    [backendTaskIdsMerged, getBackendTask]
  );

  const backendReceiveLeavesByTask = React.useMemo(
    () => collectBackendReceiveLeavesByTask(backendTaskIdsMerged, getBackendTask),
    [backendTaskIdsMerged, getBackendTask]
  );

  const backendSendParamLeaves = React.useMemo(
    () => backendSendLeavesByTask.flatMap((g) => g.leaves),
    [backendSendLeavesByTask]
  );

  const parameterDestinationCatalog = React.useMemo(() => {
    const mapped = new Set<string>(listRegisteredSlotIds(projectSlotLexicon));
    return buildParameterDestinationCatalog(
      backendSendLeavesByTask,
      backendReceiveLeavesByTask,
      [...mapped]
    );
  }, [backendSendLeavesByTask, backendReceiveLeavesByTask, projectSlotLexicon]);
  /** Set in `loadFromRepository`: task has `agentIaRuntimeOverrideJson` vs copy of global defaults. */
  const [iaRuntimeLoadedFrom, setIaRuntimeLoadedFrom] = React.useState<'saved_override' | 'global_defaults'>(
    'global_defaults'
  );

  /**
   * Helper: costruisce l'oggetto `callMeta` con `(purpose, taskId, taskLabel)` per ogni chiamata
   * IA originata dal task editor. `taskId` \u00e8 sempre l'instance id; `taskLabel` lo snapshot
   * della label corrente. Le chiamate raggiunte dal report ad albero useranno questa triade per
   * raggruppare i record sotto il "macro-task" giusto, anche se il task viene rinominato in
   * seguito (label snapshot \u00e8 fedele al momento storico della call).
   */
  const buildCallMeta = React.useCallback(
    (purpose: string) => ({
      purpose,
      taskId: typeof instanceId === 'string' && instanceId ? instanceId : undefined,
      taskLabel: typeof taskLabel === 'string' && taskLabel ? taskLabel : undefined,
    }),
    [instanceId, taskLabel]
  );

  /** True only after `loadFromRepository` has applied repo data for this mount / reload. */
  const [hydrated, setHydrated] = React.useState(false);
  /** True when local state diverges from last persisted snapshot (user edits or generation). */
  const [dirty, setDirty] = React.useState(false);

  const {
    documents: knowledgeBaseDocuments,
    addFiles: knowledgeBaseAddFilesInternal,
    removeDocument: knowledgeBaseRemoveInternal,
    updateDocument: knowledgeBaseUpdateInternal,
    reorderDocuments: knowledgeBaseReorderInternal,
    toPersisted: knowledgeBaseToPersisted,
    hydrateFromPersisted: hydrateKnowledgeBaseDocuments,
  } = useKnowledgeBaseDocuments({
    projectId,
    onDirty: () => setDirty(true),
  });

  const committedStructuredJsonRef = React.useRef<string>('');
  const iaRuntimeConfigRef = React.useRef<IAAgentConfig>(iaRuntimeConfig);
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
  iaRuntimeConfigRef.current = iaRuntimeConfig;

  React.useEffect(() => {
    const id = String(instanceId ?? '').trim();
    if (!id) return () => {};
    if (!hydrated) {
      unregisterConvaiLiveIaConfig(id);
      return () => {
        unregisterConvaiLiveIaConfig(id);
      };
    }
    registerConvaiLiveIaConfig(id, iaRuntimeConfig);
    return () => {
      unregisterConvaiLiveIaConfig(id);
    };
  }, [instanceId, hydrated, iaRuntimeConfig]);

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
    const runtimeAppendix = buildAgentRuntimeAnalysisAppendix({
      documents: knowledgeBaseDocuments,
      backendCatalog: projectData?.backendCatalog,
      agentTaskId: instanceId,
      manualCatalogBackendTaskIds,
    });
    const ir = buildAgentStructuredSections(
      {
        goal: e.goal ?? '',
        operational_sequence: e.operational_sequence ?? '',
        context: mergeRuntimeAnalysisIntoContext(e.context ?? '', runtimeAppendix),
        constraints: e.constraints ?? '',
        personality: e.personality ?? '',
        tone: e.tone ?? '',
        examples: e.examples ?? '',
      },
      backendPlaceholders
    );
    return compilePromptFromStructuredSections(ir, normalizeAgentPromptPlatformId(agentPromptTargetPlatform));
  }, [
    structuredRev.effectiveBySection,
    backendPlaceholders,
    agentPromptTargetPlatform,
    knowledgeBaseDocuments,
    projectData?.backendCatalog,
    instanceId,
    manualCatalogBackendTaskIds,
  ]);

  const compiledPromptForTargetPlatform = React.useMemo(
    () => formatPlatformPromptOutput(compiledPlatformOutput),
    [compiledPlatformOutput]
  );

  const setDesignDescriptionUser = React.useCallback((v: React.SetStateAction<string>) => {
    setDirty(true);
    markPromptFinalMisaligned('designDescription');
    setDesignDescription(v);
  }, [markPromptFinalMisaligned]);

  const notifyTaskTextManualEdit = React.useCallback((fieldId: AgentTaskTextFieldId) => {
    setTaskTextManualEditByField((prev) => ({ ...prev, [fieldId]: true }));
  }, []);

  const hasTaskTextManualEdit = React.useCallback(
    (fieldId: AgentTaskTextFieldId) => Boolean(taskTextManualEditByField[fieldId]),
    [taskTextManualEditByField]
  );

  const applyRevisionOps = React.useCallback(
    (sectionId: AgentStructuredSectionId, ops: readonly RevisionBatchOp[]) => {
      setDirty(true);
      markPromptFinalMisaligned('structuredSectionRevision');
      structuredRev.applyRevisionOps(sectionId, ops);
      notifyTaskTextManualEdit(sectionId);
    },
    [structuredRev, markPromptFinalMisaligned, notifyTaskTextManualEdit]
  );

  const applyOtCommit = React.useCallback(
    (sectionId: AgentStructuredSectionId, newOps: readonly OtOp[]) => {
      setDirty(true);
      markPromptFinalMisaligned('structuredSectionOtCommit');
      structuredRev.applyOtCommit(sectionId, newOps);
      notifyTaskTextManualEdit(sectionId);
    },
    [structuredRev, markPromptFinalMisaligned, notifyTaskTextManualEdit]
  );

  /** Reset observation-review baselines to current agent output (Create/Refine), not designer deltas. */
  const syncTaskTextBaselinesFromAgentOutput = React.useCallback(
    (sectionBases?: Partial<Record<AgentStructuredSectionId, string>>) => {
      const next: Record<string, string> = { designDescription: designDescription.trim() };
      for (const id of AGENT_STRUCTURED_SECTION_IDS) {
        next[id] = (sectionBases?.[id] ?? structuredRev.effectiveBySection[id] ?? '').trim();
      }
      setTaskTextBaselines(next);
      setTaskTextReviewDismissed({});
      setTaskTextManualEditByField({});
    },
    [designDescription, structuredRev.effectiveBySection]
  );

  const getTaskTextBaseline = React.useCallback(
    (fieldId: AgentTaskTextFieldId) => taskTextBaselines[fieldId] ?? '',
    [taskTextBaselines]
  );

  const setTaskTextBaseline = React.useCallback((fieldId: AgentTaskTextFieldId, text: string) => {
    setTaskTextBaselines((prev) => ({ ...prev, [fieldId]: text.trim() }));
  }, []);

  const getTaskTextCurrentText = React.useCallback(
    (fieldId: AgentTaskTextFieldId): string => {
      if (fieldId === 'designDescription') return designDescription;
      return structuredRev.effectiveBySection[fieldId] ?? '';
    },
    [designDescription, structuredRev.effectiveBySection]
  );

  const dismissTaskTextReviewOffer = React.useCallback((fieldId: AgentTaskTextFieldId) => {
    setTaskTextReviewDismissed((prev) => ({ ...prev, [fieldId]: true }));
  }, []);

  const clearTaskTextReviewOfferDismissed = React.useCallback((fieldId: AgentTaskTextFieldId) => {
    setTaskTextReviewDismissed((prev) => {
      if (!prev[fieldId]) return prev;
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });
  }, []);

  /**
   * After IA finalize (observation review): apply stabilized markdown and reset baseline for this field.
   * Structured sections replace revision state with a clean base (no accumulated mask/inserts).
   */
  const commitAgentStabilizedTaskText = React.useCallback(
    (fieldId: AgentTaskTextFieldId, stabilizedText: string) => {
      const text = stabilizedText.trim();
      if (fieldId === 'designDescription') {
        setDesignDescriptionUser(text);
      } else {
        structuredRev.resetSectionBaseFromAgent(fieldId, text);
        markPromptFinalMisaligned('structuredSectionAgentStabilize');
      }
      setTaskTextBaseline(fieldId, text);
      clearTaskTextReviewOfferDismissed(fieldId);
      setTaskTextManualEditByField((prev) => {
        if (!prev[fieldId]) return prev;
        const next = { ...prev };
        delete next[fieldId];
        return next;
      });
      setDirty(true);
    },
    [
      setDesignDescriptionUser,
      structuredRev,
      markPromptFinalMisaligned,
      setTaskTextBaseline,
      clearTaskTextReviewOfferDismissed,
    ]
  );

  const isTaskTextReviewOfferDismissed = React.useCallback(
    (fieldId: AgentTaskTextFieldId) => Boolean(taskTextReviewDismissed[fieldId]),
    [taskTextReviewDismissed]
  );

  const undoSection = React.useCallback(
    (sectionId: AgentStructuredSectionId) => {
      setDirty(true);
      markPromptFinalMisaligned('structuredSectionUndo');
      structuredRev.undoSection(sectionId);
      notifyTaskTextManualEdit(sectionId);
    },
    [structuredRev, markPromptFinalMisaligned, notifyTaskTextManualEdit]
  );

  const redoSection = React.useCallback(
    (sectionId: AgentStructuredSectionId) => {
      setDirty(true);
      markPromptFinalMisaligned('structuredSectionRedo');
      structuredRev.redoSection(sectionId);
      notifyTaskTextManualEdit(sectionId);
    },
    [structuredRev, markPromptFinalMisaligned, notifyTaskTextManualEdit]
  );

  const setUseCaseSiblingSortMode = React.useCallback((mode: UseCaseSiblingSortMode) => {
    useCaseSiblingSortModeRef.current = mode;
    setUseCaseSiblingSortModeState(mode);
    setUseCases((prev) => normalizeUseCaseSiblingOrder(prev, mode));
    setDirty(true);
  }, []);

  const setUseCasesUser = React.useCallback((v: React.SetStateAction<AIAgentUseCase[]>) => {
    setDirty(true);
    setUseCases((prev) =>
      normalizeUseCaseSiblingOrder(
        typeof v === 'function' ? v(prev) : v,
        useCaseSiblingSortModeRef.current
      )
    );
  }, []);

  const setConversationalRulesUser = React.useCallback(
    (v: React.SetStateAction<ConversationalRule[]>) => {
      setDirty(true);
      setConversationalRules(v);
    },
    []
  );

  /**
   * Riordino drag & drop tra fratelli: forza modalità «elenco» (logical) e persiste l'ordine
   * senza che la normalizzazione per prima occorrenza annulli il nuovo `sort_order`.
   */
  const reorderUseCaseSiblingByDrag = React.useCallback(
    (draggedId: string, targetId: string, position: 'before' | 'after') => {
      setDirty(true);
      useCaseSiblingSortModeRef.current = 'logical';
      setUseCaseSiblingSortModeState('logical');
      setUseCasesUser((prev) => applySiblingReorderForPersist(prev, draggedId, targetId, position));
    },
    [setUseCasesUser]
  );

  const setPreviewStyleId = React.useCallback((id: string) => {
    setDirty(true);
    setPreviewStyleIdState(id);
  }, []);

  const setUseCaseGlobalStyleId = React.useCallback((id: string) => {
    const selected = AI_AGENT_GLOBAL_USE_CASE_STYLES.find((x) => x.id === id);
    if (!selected) {
      throw new Error(`Stile globale non valido: ${id}`);
    }
    setDirty(true);
    setUseCaseGlobalStyleIdState(id);
    setUseCases((prev) =>
      normalizeUseCaseSiblingOrder(
        prev.map((uc) => ({
          ...uc,
          notes: {
            ...uc.notes,
            tone: selected.contract,
          },
        })),
        useCaseSiblingSortModeRef.current
      )
    );
  }, []);

  const setAgentUseCaseStyleLearningNotes = React.useCallback((next: string) => {
    setAgentUseCaseStyleLearningNotesState((prev) => {
      if (prev === next) return prev;
      setDirty(true);
      return next;
    });
  }, []);

  const globalStyleContract = React.useMemo(() => {
    const match = AI_AGENT_GLOBAL_USE_CASE_STYLES.find((x) => x.id === useCaseGlobalStyleId);
    const base = match?.contract ?? AI_AGENT_GLOBAL_USE_CASE_STYLES[0].contract;
    return mergeUseCaseGlobalStyleContract(base, agentUseCaseStyleLearningNotes.trim());
  }, [useCaseGlobalStyleId, agentUseCaseStyleLearningNotes]);

  const setAgentPromptTargetPlatform = React.useCallback((v: AgentPromptPlatformId) => {
    setDirty(true);
    markPromptFinalMisaligned('agentPromptTargetPlatform');
    setAgentPromptTargetPlatformState(normalizeAgentPromptPlatformId(v));
  }, [markPromptFinalMisaligned]);

  const setAgentImmediateStart = React.useCallback((value: boolean) => {
    setDirty(true);
    setAgentImmediateStartState(value);
  }, []);

  /**
   * Sostituisce la phase top-level (wizard ↔ edit). Setter user-driven: marca dirty e
   * persiste alla prossima flush. NON tocca `hasAgentGeneration` (relazione 1:1 col flag
   * legacy: la transizione `wizard → edit` viene effettuata altrove quando opportuno —
   * tipicamente al completamento di tutti gli step del wizard).
   */
  const setAgentConstructionPhase = React.useCallback((next: AgentConstructionPhase) => {
    setDirty(true);
    setAgentConstructionPhaseState(next);
  }, []);

  /**
   * Naviga ad uno step specifico del wizard di costruzione. Fail-loud su input invalidi
   * (non degrada silenziosamente): un index fuori range è un bug del chiamante, non un caso
   * legittimo da gestire.
   */
  const setAgentWizardCurrentStep = React.useCallback((next: number) => {
    if (!isAgentWizardStepIndex(next)) {
      throw new Error(
        `[useAIAgentEditorController] Invalid wizard step index: ${next}. ` +
          `Expected integer in [0, ${AGENT_WIZARD_LAST_STEP_INDEX}].`
      );
    }
    setDirty(true);
    setAgentWizardCurrentStepState(next);
  }, []);

  /**
   * Marca la Tutor come «vista». Setter idempotente: chiamarlo pi\u00f9 volte non riporta a
   * false. Tipicamente invocato una sola volta nella vita del task (al click di
   * «Cominciamo»). Volutamente solo monodirezionale: non c'\u00e8 «un-acknowledge».
   */
  const acknowledgeAgentWizardTutor = React.useCallback(() => {
    setAgentWizardTutorAcknowledgedState((prev) => {
      if (prev) return prev;
      setDirty(true);
      return true;
    });
  }, []);

  /**
   * Setter del **gate di stile** del passo «Conversazione». Marcano dirty per persistere.
   *
   * Disgiunzione: una sola delle due fa "valido" lo stato (testo non vuoto OPPURE flag true).
   * Quando l'utente scrive nell'esempio, NON resetta automaticamente la checkbox auto: stati
   * indipendenti — il gate UI considera valido se *almeno uno* dei due è valorizzato.
   */
  const setAgentConversationStyleExample = React.useCallback((next: string) => {
    setAgentConversationStyleExampleState((prev) => {
      if (prev === next) return prev;
      setDirty(true);
      return next;
    });
  }, []);
  const setAgentConversationStyleAuto = React.useCallback((next: boolean) => {
    setAgentConversationStyleAutoState((prev) => {
      if (prev === next) return prev;
      setDirty(true);
      return next;
    });
  }, []);

  /**
   * Setter generico per le selezioni stile (v2). Accetta sia l'oggetto completo sia una
   * funzione updater (stile React). Marca dirty solo se il riferimento cambia (no-op idempotente).
   *
   * Esempio uso (toggle checked di una pill):
   *   setAgentConversationStyleSelections(prev => ({
   *     ...prev,
   *     cortese: { ...(prev.cortese ?? defaultStyleEntryForRegistryId('cortese')), checked: true }
   *   }));
   */
  const setAgentConversationStyleSelections = React.useCallback(
    (
      next:
        | ConversationStyleSelections
        | ((prev: ConversationStyleSelections) => ConversationStyleSelections)
    ) => {
      setAgentConversationStyleSelectionsState((prev) => {
        const computed = typeof next === 'function' ? next(prev) : next;
        if (computed === prev) return prev;
        setDirty(true);
        return computed;
      });
    },
    []
  );

  const setAgentConversationDeployStyleId = React.useCallback((next: string | null) => {
    setAgentConversationDeployStyleIdState((prev) => {
      if (prev === next) return prev;
      setDirty(true);
      return next;
    });
  }, []);

  const setAgentLogUseCase = React.useCallback((next: boolean) => {
    setAgentLogUseCaseState((prev) => {
      if (prev === next) return prev;
      setDirty(true);
      return next;
    });
  }, []);

  const setAgentLogBackendCalls = React.useCallback((next: boolean) => {
    setAgentLogBackendCallsState((prev) => {
      if (prev === next) return prev;
      setDirty(true);
      return next;
    });
  }, []);

  const setAgentBehavior = React.useCallback((next: 'A' | 'B' | 'C') => {
    setAgentBehaviorState((prev) => {
      if (prev === next) return prev;
      setDirty(true);
      return next;
    });
  }, []);

  const setAgentInterfaceInput = React.useCallback(
    (updater: React.SetStateAction<MappingEntry[]>) => {
      setDirty(true);
      setAgentInterfaceInputState(updater);
    },
    []
  );

  const setAgentInterfaceOutput = React.useCallback(
    (updater: React.SetStateAction<MappingEntry[]>) => {
      setDirty(true);
      setAgentInterfaceOutputState(updater);
    },
    []
  );

  const agentInterfaceJson = React.useMemo(
    () =>
      serializeAgentInterfaceJson({
        schemaVersion: AGENT_INTERFACE_SCHEMA_VERSION,
        input: mappingEntriesToAgentInterfaceRows(agentInterfaceInput),
        output: mappingEntriesToAgentInterfaceRows(agentInterfaceOutput),
      }),
    [agentInterfaceInput, agentInterfaceOutput]
  );

  const agentKnowledgeBaseDocumentsJson = React.useMemo(
    () => serializeAgentKnowledgeBaseDocuments(knowledgeBaseToPersisted()),
    [knowledgeBaseDocuments]
  );

  const agentBackendOutputSlotBindingsJson = React.useMemo(
    () => serializeAgentBackendOutputSlotBindings(backendOutputSlotBindings),
    [backendOutputSlotBindings]
  );

  const knowledgeBaseAddFiles = React.useCallback(
    (files: readonly File[]) => {
      knowledgeBaseAddFilesInternal(files);
      setDirty(true);
    },
    [knowledgeBaseAddFilesInternal]
  );

  const knowledgeBaseRemoveDocument = React.useCallback(
    (docId: string) => {
      knowledgeBaseRemoveInternal(docId);
      setDirty(true);
    },
    [knowledgeBaseRemoveInternal]
  );

  const knowledgeBaseUpdateDocument = React.useCallback(
    (
      docId: string,
      patch: Parameters<typeof knowledgeBaseUpdateInternal>[1]
    ) => {
      knowledgeBaseUpdateInternal(docId, patch);
      setDirty(true);
    },
    [knowledgeBaseUpdateInternal]
  );

  const knowledgeBaseReorderDocuments = React.useCallback(
    (next: readonly import('@domain/knowledgeBase/kbDocumentTypes').StagedKbDocument[]) => {
      knowledgeBaseReorderInternal(next);
      setDirty(true);
    },
    [knowledgeBaseReorderInternal]
  );

  const useCaseInvalidationHandlers = useAgentDockUseCaseInvalidationHandlers({
    useCases,
    setUseCases: setUseCasesUser,
    knowledgeBaseDocuments,
    knowledgeBaseReorderDocuments,
    onMutate: () => setDirty(true),
  });

  const promptsPanelHandlers = React.useMemo(
    () =>
      agentDockPromptsPanelHandlersFromInvalidation(
        useCaseInvalidationHandlers,
        (useCaseId: string) => {
          if (!useCases.some((u) => u.id === useCaseId)) {
            setUseCaseComposerError('Use case non trovato.');
            return;
          }
          setUseCaseComposerError(null);
          useCaseInvalidationHandlers.deleteUseCaseWithInvalidationKb(useCaseId);
          setAgentStartUseCaseIdState((cur) => (cur === useCaseId ? '' : cur));
        }
      ),
    [useCaseInvalidationHandlers, useCases]
  );

  const handleUseCaseInvalidationNoteChange =
    useCaseInvalidationHandlers.onUseCaseInvalidationNoteChange;
  const handleUseCaseInvalidationStateChange =
    useCaseInvalidationHandlers.onUseCaseInvalidationStateChange;

  const knowledgeBaseTaskContext = React.useMemo(
    () => ({
      agentTaskSummary: buildKbAgentTaskSummary(
        designDescription,
        structuredRev.composedRuntimeMarkdown
      ),
      taskVariables: buildKbTaskVariablesWire(proposedFields),
      existingUseCaseSummaries: buildKbExistingUseCaseSummaries(useCases),
    }),
    [designDescription, structuredRev.composedRuntimeMarkdown, proposedFields, useCases]
  );

  /**
   * Allinea il lessico alle surface ancora presenti nei messaggi UC (rimuove orfani).
   * Chiamato all'apertura di Slot Mapping e dopo Compila.
   */
  const reconcileLexiconOrphansWithCatalog = React.useCallback(
    (catalog: readonly AIAgentUseCase[] = useCases) => {
      const surfaces = collectSurfacesInCatalogUseCases(catalog);
      setProjectSlotLexicon((prev) => {
        const { lexicon: next, removedEntryCount, removedProposalCount } =
          pruneLexiconOrphans(prev, surfaces);
        if (removedEntryCount === 0 && removedProposalCount === 0) return prev;
        saveProjectSlotLexicon(projectId ?? null, next);
        setDirty(true);
        return next;
      });

      const groups = collectBackendSendLeavesByTask(backendTaskIdsMerged, getBackendTask);
      const leaves = groups.flatMap((g) => g.leaves);
      if (groups.length > 0 && leaves.length > 0) {
        setBackendOutputSlotBindings((prev) =>
          reconcileSendHintsWithCatalog(prev, catalog, leaves, { backendGroups: groups })
        );
        setDirty(true);
      }
    },
    [useCases, projectId, backendTaskIdsMerged, getBackendTask]
  );

  const registerOpenSlotMappingOnCompileFail = React.useCallback((open: () => void) => {
    openSlotMappingOnCompileFailRef.current = open;
  }, []);

  const runCompileUseCasePhrasesForCatalog = React.useCallback(
    async (seed?: {
      lexicon?: ProjectSlotLexicon;
      bindings?: AgentBackendOutputSlotBindings;
    }) => {
    setCompilePhrasesBusy(true);
    try {
      const backendIds = mergeConvaiBackendToolIdLists(
        iaRuntimeConfig.convaiBackendToolTaskIds ?? [],
        manualCatalogBackendTaskIds ?? []
      );
      const backendLinked = backendIds.length > 0;
      const getBackendTask = (id: string) => taskRepository.getTask(id);
      let bindings = seed?.bindings ?? backendOutputSlotBindings;
      if (backendLinked) {
        const fp = buildBindingsFingerprint(backendIds, getBackendTask);
        if (fp !== bindings.sourceFingerprint) {
          bindings = { ...bindings, sourceFingerprint: fp };
          setBackendOutputSlotBindings(bindings);
        }
      }

      let lexicon = seed?.lexicon ?? projectSlotLexicon;
      const { surfaces, phraseTokens } = collectCatalogCompileInputs(useCases, lexicon);
      const compileMappingInputs = {
        surfaceCount: surfaces.length,
        phraseTokenCount: phraseTokens.length,
      };
      const sendLeaves = backendLinked
        ? collectBackendSendLeavesFromTasks(backendIds, getBackendTask)
        : [];

      if (shouldRunIaCompileSlotMapping(compileMappingInputs)) {
        if (!provider.trim() || !model.trim()) {
          const msg =
            'Compila: imposta provider e modello in Omnia Tutor (LLM designer) per il dizionario slot IA.';
          setUseCaseComposerError(msg);
          setCompileMappingBanner(msg);
          return false;
        }
        try {
          const { tag: outputLanguage } = resolveAiAgentOutputLanguage();
          const receiveGroups = collectBackendReceiveLeavesByTask(backendIds, getBackendTask);
          const proposal = await proposeCompileSlotMappingsApi({
            surfaces,
            phraseTokens,
            receivePaths: collectReceivePathsFromGroups(receiveGroups),
            receiveParamLeaves: receiveGroups.flatMap((g) =>
              g.leaves.map((l) => ({
                path: l.path,
                type: l.type,
                ...(l.format ? { format: l.format } : {}),
                ...(l.description ? { description: l.description } : {}),
                suggestedSlotId: l.suggestedSlotId,
              }))
            ),
            backendTaskId: backendIds[0] ?? '',
            backendToolContexts: collectBackendToolCompileContexts(backendIds, getBackendTask),
            sendParamLeaves: sendLeaves.map((l) => ({
              path: l.path,
              type: l.type,
              ...(l.format ? { format: l.format } : {}),
              ...(l.description ? { description: l.description } : {}),
              semanticRole: l.semanticRole,
            })),
            outputLanguage,
            provider,
            model,
            callMeta: buildCallMeta(AI_CALL_PURPOSE.USE_CASE_COMPILE_SLOT_MAPPING),
          });
          const applied = applyCompileSlotMappingProposal(lexicon, bindings, proposal, {
            backendTaskId: backendIds[0] ?? '',
            sourceTaskId: instanceId,
            sendLeaves,
          });
          lexicon = applied.lexicon;
          bindings = {
            ...applied.bindings,
            slotContracts: syncSlotContractsFromRows(applied.bindings, getBackendTask),
          };
          setProjectSlotLexicon(lexicon);
          saveProjectSlotLexicon(projectId ?? null, lexicon);
          setBackendOutputSlotBindings(bindings);
        } catch (err) {
          const detail = err instanceof Error ? err.message : String(err ?? '');
          const msg = `Compila: mappatura IA non riuscita${detail ? ` — ${detail}` : ''}.`;
          setUseCaseComposerError(msg);
          setCompileMappingBanner(msg);
          openSlotMappingOnCompileFailRef.current?.();
          return false;
        }
      }

      let compiled = compileAllUseCases(useCases, lexicon, CATALOG_IA_FIRST_COMPILE_OPTIONS);
      const mappings = collectMappingsFromUseCases(compiled);
      const { lexicon: merged } = mergeMappingsIntoLexicon(lexicon, mappings, {
        sourceTaskId: instanceId,
        upgradeUnclassified: true,
      });
      const surfacesInCatalog = collectSurfacesInCatalogUseCases(compiled);
      const { lexicon: reconciled } = pruneLexiconOrphans(merged, surfacesInCatalog);
      setProjectSlotLexicon(reconciled);
      saveProjectSlotLexicon(projectId ?? null, reconciled);
      if (reconciled !== lexicon) {
        compiled = compileAllUseCases(useCases, reconciled, CATALOG_IA_FIRST_COMPILE_OPTIONS);
      }
      const backendGroups = collectBackendSendLeavesByTask(backendIds, getBackendTask);
      if (backendLinked && backendGroups.length > 0 && sendLeaves.length > 0) {
        bindings = reconcileSendHintsWithCatalog(bindings, compiled, sendLeaves, {
          backendGroups,
        });
        setBackendOutputSlotBindings(bindings);
      }
      setUseCases(compiled);

      const validation = computeCatalogCompileValidation(
        reconciled,
        compiled,
        bindings,
        backendLinked,
        { sendLeaves, backendGroups }
      );
      setCompileMappingBanner(validation.bannerMessage);
      if (validation.status === 'invalid') {
        setUseCaseComposerError(validation.bannerMessage);
        reconcileLexiconOrphansWithCatalog(compiled);
        openSlotMappingOnCompileFailRef.current?.();
      } else {
        setUseCaseComposerError(null);
      }
      setDirty(true);
      return validation.status === 'valid';
    } finally {
      setCompilePhrasesBusy(false);
    }
    },
    [
      useCases,
      projectSlotLexicon,
      instanceId,
      projectId,
      backendOutputSlotBindings,
      iaRuntimeConfig.convaiBackendToolTaskIds,
      manualCatalogBackendTaskIds,
      provider,
      model,
      buildCallMeta,
      reconcileLexiconOrphansWithCatalog,
    ]
  );

  const compileUseCasePhrasesForCatalog = React.useCallback(
    async () => runCompileUseCasePhrasesForCatalog(),
    [runCompileUseCasePhrasesForCatalog]
  );

  const rebuildSlotMappingFromScratch = React.useCallback(async () => {
    const cleanLexicon = emptyProjectSlotLexicon();
    const cleanBindings = emptyAgentBackendOutputSlotBindings();
    setProjectSlotLexicon(cleanLexicon);
    saveProjectSlotLexicon(projectId ?? null, cleanLexicon);
    setBackendOutputSlotBindings(cleanBindings);
    setCompileMappingBanner('MAPPING — Rebuild in corso: rigenerazione dizionario slot da zero…');
    setUseCaseComposerError(null);
    return runCompileUseCasePhrasesForCatalog({
      lexicon: cleanLexicon,
      bindings: cleanBindings,
    });
  }, [projectId, runCompileUseCasePhrasesForCatalog]);

  const patchLexiconEntries = React.useCallback(
    (map: (entries: ProjectSlotLexicon['entries']) => ProjectSlotLexicon['entries']) => {
      setProjectSlotLexicon((prev) => {
        const next = { ...prev, entries: map(prev.entries) };
        saveProjectSlotLexicon(projectId ?? null, next);
        return next;
      });
      setDirty(true);
    },
    [projectId]
  );

  const approveLexiconSurface = React.useCallback(
    (surface: string) => {
      const key = surface.trim().toLowerCase();
      patchLexiconEntries((entries) =>
        entries.map((e) => (e.surface === key ? { ...e, approved: true } : e))
      );
    },
    [patchLexiconEntries]
  );

  const revokeLexiconSurface = React.useCallback(
    (surface: string) => {
      const key = surface.trim().toLowerCase();
      patchLexiconEntries((entries) =>
        entries.map((e) => (e.surface === key ? { ...e, approved: false } : e))
      );
    },
    [patchLexiconEntries]
  );

  const updateSurfaceSendHint = React.useCallback(
    (
      surface: string,
      patch: {
        sendPath: string;
        slotId?: string;
        valueKind?: string;
        role?: TokenSendRole;
      }
    ) => {
      setBackendOutputSlotBindings((prev) =>
        updateSendHintForSurface(prev, surface, patch, backendSendParamLeaves)
      );
      setDirty(true);
    },
    [backendSendParamLeaves]
  );

  const applyParameterDestination = React.useCallback(
    (surface: string, destination: ParameterDestination) => {
      const key = surface.trim().toLowerCase();
      const nextSlot = normalizeSlotId(destination.slotId);
      const classified = !isUnclassifiedSlotId(nextSlot);
      patchLexiconEntries((entries) =>
        entries.map((e) =>
          e.surface === key
            ? {
                ...e,
                slot_id: nextSlot,
                approved: classified,
                conflictWith: undefined,
              }
            : e
        )
      );

      setBackendOutputSlotBindings((prev) => {
        const without = {
          ...prev,
          sendHints: (prev.sendHints ?? []).filter(
            (h) => normalizeSurface(h.surface) !== key
          ),
        };
        if (destination.kind === 'send' && destination.sendPath?.trim()) {
          const hint = {
            surface: key,
            slotId: nextSlot,
            role: destination.role ?? 'value',
            sendPath: destination.sendPath.trim(),
            ...(destination.valueKind ? { valueKind: destination.valueKind } : {}),
            ...(destination.toolName ? { toolName: destination.toolName } : {}),
            ...(destination.backendTaskId ? { backendTaskId: destination.backendTaskId } : {}),
          };
          return mergeSendHintsIntoBindings(without, [hint], backendSendParamLeaves);
        }
        if (destination.kind === 'receive' && destination.receivePath?.trim()) {
          const backendTaskId =
            destination.backendTaskId?.trim() || backendSendLeavesByTask[0]?.backendTaskId || '';
          const apiPath = destination.receivePath.trim();
          const rowKey = `${backendTaskId}::${apiPath}`;
          const rows = [...without.rows];
          const idx = rows.findIndex(
            (r) => `${r.backendTaskId}::${r.apiPath}` === rowKey
          );
          const tokenInPhrase = key;
          const nextRow = {
            backendTaskId,
            apiPath,
            slotId: nextSlot,
            tokenInPhrase,
            approved: idx >= 0 ? rows[idx]?.approved : undefined,
          };
          if (idx >= 0) rows[idx] = { ...rows[idx]!, ...nextRow };
          else rows.push(nextRow);
          const contracts = [...(without.slotContracts ?? [])];
          const cIdx = contracts.findIndex((c) => c.slotId === nextSlot);
          const toolName = destination.toolName?.trim() || '';
          const nextContract = {
            slotId: nextSlot,
            toolName: toolName || contracts[cIdx]?.toolName || '',
            backendTaskId,
            receive: apiPath,
            approved: cIdx >= 0 ? contracts[cIdx]?.approved : undefined,
          };
          if (cIdx >= 0) contracts[cIdx] = { ...contracts[cIdx]!, ...nextContract };
          else contracts.push(nextContract);
          return { ...without, rows, slotContracts: contracts };
        }
        return without;
      });
      setDirty(true);
    },
    [patchLexiconEntries, backendSendParamLeaves, backendSendLeavesByTask]
  );

  const updateLexiconSlotId = React.useCallback(
    (surface: string, slotId: string) => {
      const key = surface.trim().toLowerCase();
      const nextSlot = resolveSlotIdFromDraft(slotId) ?? normalizeSlotId(slotId);
      if (!isValidSlotId(nextSlot) || isUnclassifiedSlotId(nextSlot)) return;
      const classified = !isUnclassifiedSlotId(nextSlot);
      patchLexiconEntries((entries) =>
        entries.map((e) =>
          e.surface === key
            ? {
                ...e,
                slot_id: nextSlot,
                approved: classified,
                conflictWith: undefined,
              }
            : e
        )
      );

      if (backendSendParamLeaves.length > 0) {
        const proposed = proposeSurfaceSendHint(surface, nextSlot, backendSendParamLeaves, {
          backendTaskId: backendSendLeavesByTask[0]?.backendTaskId ?? '',
          toolName: backendSendLeavesByTask[0]?.toolName,
        });
        if (proposed) {
          setBackendOutputSlotBindings((prev) =>
            mergeSendHintsIntoBindings(prev, [proposed], backendSendParamLeaves)
          );
        }
      }
      setDirty(true);
    },
    [patchLexiconEntries, backendSendParamLeaves, backendSendLeavesByTask]
  );

  const upsertDesignerSlotRegistry = React.useCallback(
    (slotId: string, description: string) => {
      setProjectSlotLexicon((prev) => {
        const next = upsertDesignerSlotRegistryEntry(prev, slotId, { description });
        saveProjectSlotLexicon(projectId ?? null, next);
        return next;
      });
      setDirty(true);
    },
    [projectId]
  );

  /** Surface leggibile → slot_id nel lessico progetto (dopo Aggiorna nel layer semantico). */
  const assignDesignerSurfaceSlotMapping = React.useCallback(
    (surface: string, slotId: string, description: string) => {
      const surf = String(surface ?? '').trim();
      const sid = normalizeSlotId(slotId);
      if (!surf || !isValidSlotId(sid) || isUnclassifiedSlotId(sid)) return;
      setProjectSlotLexicon((prev) => {
        const merged = mergeMappingsIntoLexicon(
          prev,
          [{ surface: surf, slot_id: sid }],
          { approve: true }
        ).lexicon;
        const next = upsertDesignerSlotRegistryEntry(merged, sid, { description });
        saveProjectSlotLexicon(projectId ?? null, next);
        return next;
      });
      setDirty(true);
    },
    [projectId]
  );

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
    notifyTaskTextManualEdit('designDescription');
  }, [markPromptFinalMisaligned, notifyTaskTextManualEdit]);

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
    const effLoaded = effectiveBySectionFromPersistedStructured(parsed.sections);
    const baselines: Record<string, string> = {
      designDescription: b.agentDesignDescription.trim(),
    };
    for (const id of AGENT_STRUCTURED_SECTION_IDS) {
      baselines[id] = (effLoaded[id] ?? '').trim();
    }
    setTaskTextBaselines(baselines);
    setTaskTextReviewDismissed({});
    setTaskTextManualEditByField({});
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
    setAgentImmediateStartState(b.agentImmediateStart);
    setAgentUseCaseWizardStateJson(b.agentUseCaseWizardStateJson);
    setAgentConstructionPhaseState(b.agentConstructionPhase);
    setAgentWizardCurrentStepState(b.agentWizardCurrentStep);
    setAgentWizardTutorAcknowledgedState(b.agentWizardTutorAcknowledged);
    setAgentConversationStyleExampleState(b.agentConversationStyleExample);
    setAgentConversationStyleAutoState(b.agentConversationStyleAuto);
    setAgentConversationStyleSelectionsState(b.agentConversationStyleSelections);
    setAgentConversationDeployStyleIdState(b.agentConversationDeployStyleId);
    setAgentLogUseCaseState(b.agentLogUseCase);
    setAgentLogBackendCallsState(b.agentLogBackendCalls);
    setAgentBehaviorState(b.agentBehavior);
    const ifaceLoaded = parseAgentInterfaceJson(b.agentInterfaceJson);
    setAgentInterfaceInputState(agentInterfaceRowsToMappingEntries(ifaceLoaded.input));
    setAgentInterfaceOutputState(agentInterfaceRowsToMappingEntries(ifaceLoaded.output));
    hydrateKnowledgeBaseDocuments(
      parseAgentKnowledgeBaseDocumentsJson(b.agentKnowledgeBaseDocumentsJson)
    );
    setProjectSlotLexicon(loadProjectSlotLexicon(projectId ?? null));
    setBackendOutputSlotBindings(
      parseAgentBackendOutputSlotBindingsJson(b.agentBackendOutputSlotBindingsJson)
    );
    setCompileMappingBanner(null);
    setLogicalSteps(b.logicalSteps);
    useCaseSiblingSortModeRef.current = 'logical';
    setUseCaseSiblingSortModeState('logical');
    const loadedBundle = parseAgentUseCaseBundleWithCategories(b.agentUseCasesJson);
    setUseCases(normalizeUseCaseSiblingOrder(loadedBundle.useCases, 'logical'));
    setUseCaseCategories(loadedBundle.categories);
    setConversationalRules(b.conversationalRules);
    const storedStyle = String(b.agentUseCaseGlobalStyleId || '').trim();
    setUseCaseGlobalStyleIdState(
      AI_AGENT_GLOBAL_USE_CASE_STYLES.some((x) => x.id === storedStyle)
        ? storedStyle
        : DEFAULT_AI_AGENT_GLOBAL_USE_CASE_STYLE_ID
    );
    setAgentUseCaseStyleLearningNotesState(b.agentUseCaseStyleLearningNotes);
    setAgentStartPromptConfigState(parseAgentStartPromptJson(b.agentStartPromptJson));
    setAgentStartUseCaseIdState(String(b.agentStartUseCaseId ?? '').trim());
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
  }, [instanceId, loadFromPersisted, hydrateKnowledgeBaseDocuments]);

  /**
   * Writes current editor state into TaskRepository (full `buildAIAgentTaskPersistPatch`).
   * No `dirty` check — used before project save and on unmount when dirty.
   */
  const persistEditorStateToRepository = React.useCallback(() => {
    if (!instanceId || !hydrated) return;
    const reason = persistReasonRef.current;
    persistReasonRef.current = 'direct';
    const agentUseCasesJson = serializeUseCases(useCases, useCaseCategories);
    const agentConversationalRulesJson = serializeConversationalRules(conversationalRules);
    const taskBeforePersist = taskRepository.getTask(instanceId);
    let iaRuntimeForPersist = mergeConvaiAgentIdFromGlobalDefaults(
      iaRuntimeConfig,
      loadGlobalIaAgentConfig()
    );
    if (taskBeforePersist) {
      iaRuntimeForPersist = withElevenLabsReprovisionWhenTaskEditorPromptChanged(
        iaRuntimeForPersist,
        taskBeforePersist,
        {
          agentPrompt,
          agentRuntimeCompactJson,
          agentStructuredSectionsJson,
          agentPromptTargetPlatform: normalizeAgentPromptPlatformId(agentPromptTargetPlatform),
          agentImmediateStart,
        },
        manualCatalogBackendTaskIds,
        projectData?.backendCatalog
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
      agentUseCaseGlobalStyleId: useCaseGlobalStyleId,
      agentUseCaseStyleLearningNotes,
      initialStateTemplateJson,
      agentRuntimeCompactJson,
      hasAgentGeneration,
      agentLogicalStepsJson: serializeLogicalSteps(logicalSteps),
      agentUseCasesJson,
      agentStartPromptJson: serializeAgentStartPromptConfig(agentStartPromptConfig),
      agentStartUseCaseId: String(agentStartUseCaseId ?? '').trim(),
      agentConversationalRulesJson,
      agentUseCaseWizardStateJson,
      agentIaRuntimeOverrideJson: serializeIaAgentConfigForTaskPersistence(iaRuntimeForPersist),
      agentImmediateStart,
      agentConstructionPhase,
      agentWizardCurrentStep,
      agentWizardTutorAcknowledged,
      agentConversationStyleExample,
      agentConversationStyleAuto,
      agentConversationStyleSelections,
      agentConversationDeployStyleId,
      agentLogUseCase,
      agentLogBackendCalls,
      agentBehavior,
      agentInterfaceJson,
      agentKnowledgeBaseDocumentsJson,
      agentBackendOutputSlotBindingsJson,
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
    useCaseGlobalStyleId,
    agentUseCaseStyleLearningNotes,
    initialStateTemplateJson,
    agentRuntimeCompactJson,
    hasAgentGeneration,
    logicalSteps,
    useCases,
    conversationalRules,
    iaRuntimeConfig,
    agentImmediateStart,
    manualCatalogBackendTaskIds,
    agentUseCaseWizardStateJson,
    agentConstructionPhase,
    agentWizardCurrentStep,
    agentWizardTutorAcknowledged,
    agentConversationStyleExample,
    agentConversationStyleAuto,
    agentConversationStyleSelections,
    agentConversationDeployStyleId,
    agentLogUseCase,
    agentBehavior,
    agentInterfaceJson,
    agentKnowledgeBaseDocumentsJson,
    agentBackendOutputSlotBindingsJson,
    agentStartPromptConfig,
    agentStartUseCaseId,
    agentLogBackendCalls,
  ]);

  const persistAgentUseCaseWizardState = React.useCallback((json: string) => {
    setAgentUseCaseWizardStateJson(json);
    setDirty(true);
  }, []);

  /**
   * «Pulisci tutto» (wizard toolbar): azzera la sola famiglia di dati «output del wizard»,
   * mantenendo intatti input/setup del task (descrizione, sezioni IR, proposed fields,
   * initial state, runtime IA config, preview e stile globale use case).
   *
   * Dati cancellati:
   * - `logicalSteps`, `useCases` (con dialogue, motor_snapshot, tokenization, voti)
   * - `agentRuntimeCompactJson` (compact runtime)
   * - `agentUseCaseWizardStateJson` (intero stato wizard: step, baselines, conversazioni)
   *
   * Conseguenze automatiche via dependency:
   * - lo hook `useUseCaseGeneratorWizard` riceve `taskPersistedWizardJson=''` ma deve essere
   *   anche resettato in memoria dal chiamante (non solo dal prop, perché il sub-hook tiene
   *   ref interni e sessionStorage può contenere copie del payload precedente — vedi
   *   {@link UseCaseGeneratorWizardModel.resetAll}).
   *
   * NON tocca: `designDescription`, `structuredSectionsState`, `proposedFields`,
   * `initialStateTemplateJson`, `iaRuntimeConfig`, `previewByStyle`, `useCaseGlobalStyleId`.
   */
  const handleClearWizardOutput = React.useCallback(() => {
    setLogicalSteps([]);
    setUseCases([]);
    setUseCaseCategories([]);
    setAgentRuntimeCompactJson('');
    setAgentUseCaseWizardStateJson('');
    setUseCaseComposerError(null);
    setUseCaseCreationMessage(null);
    setDirty(true);
  }, []);

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

  /**
   * Re-sync when project tasks are loaded from API into TaskRepository (fixes race: editor before load).
   * Guard: if the user has local IA runtime changes that are more recent than the incoming snapshot,
   * preserve the local iaRuntimeConfig and re-write it into the freshly loaded task so it is not lost.
   */
  React.useEffect(() => {
    if (!instanceId || !projectId) return;
    const onTasksLoaded = (e: Event) => {
      const detail = (e as CustomEvent<{ projectId?: string }>).detail;
      if (detail?.projectId !== projectId) return;
      const wasDirty = dirtyRef.current;
      const localIaConfig = wasDirty ? iaRuntimeConfigRef.current : null;
      loadFromRepository();
      setHydrated(true);
      setDirty(false);
      if (wasDirty && localIaConfig) {
        setIaRuntimeConfigState(localIaConfig);
        setDirty(true);
      }
    };
    window.addEventListener('tasks:loaded', onTasksLoaded as EventListener);
    return () => window.removeEventListener('tasks:loaded', onTasksLoaded as EventListener);
  }, [instanceId, projectId, loadFromRepository]);

  /** Debugger «Aggiungi use case»: repository updated out-of-band — reload agent* fields for this editor instance. */
  React.useEffect(() => {
    if (!instanceId) return;
    const onRehydrate = (e: Event) => {
      const d = (e as CustomEvent<{ taskId?: string }>).detail;
      if (!d?.taskId || d.taskId !== instanceId) return;
      if (dirtyRef.current) return;
      loadFromRepository();
    };
    document.addEventListener(OMNIA_AI_AGENT_REHYDRATE_FROM_REPO, onRehydrate as EventListener);
    return () =>
      document.removeEventListener(OMNIA_AI_AGENT_REHYDRATE_FROM_REPO, onRehydrate as EventListener);
  }, [instanceId, loadFromRepository]);

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
          callMeta: buildCallMeta(AI_CALL_PURPOSE.AGENT_REFINE),
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
        callMeta: buildCallMeta(
          hasAgentGeneration ? AI_CALL_PURPOSE.AGENT_REFINE : AI_CALL_PURPOSE.AGENT_CREATE
        ),
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
      syncTaskTextBaselinesFromAgentOutput(applied.sectionBases);
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
    syncTaskTextBaselinesFromAgentOutput,
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

  const appendProposedFields = React.useCallback((fields: AIAgentProposedVariable[]) => {
    if (!fields.length) return;
    setDirty(true);
    setProposedFields((prev) => [...prev, ...fields]);
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

  const onTaskTextReviewError = React.useCallback((message: string | null) => {
    if (message) setUseCaseComposerError(message);
  }, []);

  const handleGenerateUseCaseBundle = React.useCallback(async (): Promise<
    GenerateUseCaseBundleOutcome | null
  > => {
    setUseCaseBundleGenerationBusy(true);
    setUseCaseBundleGenerationCount(null);
    setUseCaseBundleGenerationOrdering(false);

    const baseUserDesc = hasAgentGeneration
      ? `${designDescription.trim()}\n\n---\n\n${buildRefineUserDescFromSections(structuredRev.effectiveBySection).trim()}`.trim()
      : designDescription.trim();

    let userDesc = baseUserDesc;
    let kbContextWarning: string | null = null;
    try {
      try {
        const kbCtx = await buildAgentDesignUserDesc({
          projectId,
          agentTaskId: instanceId,
          baseUserDesc,
          documents: knowledgeBaseDocuments,
          backendCatalog: projectData?.backendCatalog,
          runtimeDistill: {
            provider,
            model,
            callMeta: buildCallMeta(AI_CALL_PURPOSE.RUNTIME_ANALYSIS_DISTILL),
          },
          runtimeDistillCallbacks: {
            applyKbDocumentPatch: (docId, patch) => knowledgeBaseUpdateInternal(docId, patch),
          },
        });
        userDesc = kbCtx.userDesc;
        if (kbCtx.backendCatalogPatch && projectData) {
          updateDataDirectly({
            ...projectData,
            backendCatalog: kbCtx.backendCatalogPatch,
          });
        }
        if (kbCtx.kbWarnings.length > 0) {
          kbContextWarning = `Avvisi knowledge base: ${kbCtx.kbWarnings.join(' ')}`;
        }
      } catch (err) {
        setUseCaseComposerError(
          err instanceof Error ? err.message : 'Lettura knowledge base non riuscita.'
        );
        return null;
      }

      if (userDesc.length < AI_AGENT_MIN_INPUT_CHARS) {
        setUseCaseComposerError(
          `Inserisci almeno ${AI_AGENT_MIN_INPUT_CHARS} caratteri nella descrizione (o carica documenti KB leggibili nel repository).`
        );
        return null;
      }
      setUseCaseComposerError(kbContextWarning);
      const { tag: outputLanguage } = resolveAiAgentOutputLanguage();
      const extendMode = useCases.length > 0;

      const normalizeGeneratedUseCases = (ucs: AIAgentUseCase[]): AIAgentUseCase[] => {
        let normalized = normalizeUseCaseSiblingOrder(ucs, useCaseSiblingSortModeRef.current);
        if (getDeferAgentMessages?.()) {
          normalized = normalizeUseCaseSiblingOrder(
            stripAssistantTurnsFromUseCases(normalized),
            useCaseSiblingSortModeRef.current
          );
        }
        return normalized;
      };

      if (extendMode) {
        const { useCases: ucsNew } = await generateAIAgentUseCases({
          userDesc,
          provider,
          model,
          runtimeContext: agentPrompt.trim(),
          outputLanguage,
          globalStyleContract,
          globalStyleId: useCaseGlobalStyleId,
          extendFrom: { logicalSteps, useCases },
          callMeta: buildCallMeta(AI_CALL_PURPOSE.USE_CASE_GENERATE_MORE),
        });
        let newOnes = applySystemProposedUseCaseDefaultsBatch(
          normalizeUseCaseSiblingOrder(ucsNew, useCaseSiblingSortModeRef.current)
        );
        if (getDeferAgentMessages?.()) {
          newOnes = applySystemProposedUseCaseDefaultsBatch(
            normalizeUseCaseSiblingOrder(
              stripAssistantTurnsFromUseCases(newOnes),
              useCaseSiblingSortModeRef.current
            )
          );
        }
        newOnes = remapExtendUseCaseIds(newOnes);
        const merged = normalizeUseCaseSiblingOrder(
          [...useCases, ...newOnes],
          useCaseSiblingSortModeRef.current
        );
        let mergedFinal = merged;
        if (mergedFinal.length >= 2) {
          setUseCaseBundleGenerationCategorizing(true);
          try {
            const cat = await runBundleUseCaseCategorization({
              useCases: mergedFinal,
              logicalSteps,
              provider,
              model,
              outputLanguage,
              buildCallMeta,
              normalizeGenerated: normalizeGeneratedUseCases,
            });
            mergedFinal = cat.useCases;
            setUseCaseCategories(cat.categories);
          } catch (catErr) {
            console.warn('[useCaseBundle] categorize (extend) failed:', catErr);
            setUseCaseComposerError(
              formatCategorizationFailureBanner(mergedFinal.length, catErr)
            );
          } finally {
            setUseCaseBundleGenerationCategorizing(false);
          }
        }
        setUseCases(mergedFinal);
        setDirty(true);
        const ids = newOnes.map((u) => u.id);
        return {
          useCases: mergedFinal,
          mode: 'extend',
          addedCount: newOnes.length,
          highlightIds: ids,
        };
      }

      const initial = await generateAIAgentUseCases({
        userDesc,
        provider,
        model,
        runtimeContext: agentPrompt.trim(),
        outputLanguage,
        globalStyleContract,
        globalStyleId: useCaseGlobalStyleId,
        chunkInitial: true,
        callMeta: buildCallMeta(AI_CALL_PURPOSE.USE_CASE_BUNDLE_INITIAL),
      });
      const ls = initial.logicalSteps;
      setLogicalSteps(ls);
      let accumulated = applySystemProposedUseCaseDefaultsBatch(
        normalizeGeneratedUseCases(initial.useCases)
      );
      setUseCases(accumulated);
      setUseCaseBundleGenerationCount(accumulated.length);
      setDirty(true);

      let coverageComplete = false;
      let extendBatchWarning: string | null = null;
      while (accumulated.length < USE_CASE_BUNDLE_MAX_TOTAL && !coverageComplete) {
        try {
          const ext = await generateAIAgentUseCases({
            userDesc,
            provider,
            model,
            runtimeContext: agentPrompt.trim(),
            outputLanguage,
            globalStyleContract,
            globalStyleId: useCaseGlobalStyleId,
            extendFrom: { logicalSteps: ls, useCases: accumulated },
            chunkedExtend: true,
            callMeta: buildCallMeta(AI_CALL_PURPOSE.USE_CASE_GENERATE_MORE),
          });
          coverageComplete = ext.coverageComplete === true;
          if (ext.useCases.length === 0) break;
          const newOnes = applySystemProposedUseCaseDefaultsBatch(
            normalizeGeneratedUseCases(remapExtendUseCaseIds(ext.useCases))
          );
          accumulated = normalizeUseCaseSiblingOrder(
            [...accumulated, ...newOnes],
            useCaseSiblingSortModeRef.current
          );
          setUseCases(accumulated);
          setUseCaseBundleGenerationCount(accumulated.length);
          setDirty(true);
          if (accumulated.length >= USE_CASE_BUNDLE_MAX_TOTAL) break;
        } catch (batchErr) {
          extendBatchWarning = formatUseCaseExtendBatchFailureMessage(
            accumulated.length,
            batchErr
          );
          break;
        }
      }

      setUseCaseBundleGenerationOrdering(true);
      let normalized = accumulated;
      let useCaseOrderingNote: string | undefined;
      try {
        const reordered = await reorderAIAgentUseCasesNarratively({
          useCases: accumulated,
          logicalSteps: ls,
          provider,
          model,
          outputLanguage,
          callMeta: buildCallMeta('USE_CASE_BUNDLE_NARRATIVE_ORDER'),
        });
        normalized = normalizeGeneratedUseCases(reordered.useCases);
        useCaseOrderingNote = reordered.useCaseOrderingNote;
      } catch {
        const reorderNote = ' Ordinamento narrativo non applicato; puoi riordinare manualmente.';
        extendBatchWarning = extendBatchWarning
          ? `${extendBatchWarning}${reorderNote}`
          : `Generati ${accumulated.length} scenari.${reorderNote} Salva e usa «Crea altri use case» se serve altro coverage.`;
      }
      setUseCaseBundleGenerationOrdering(false);
      if (normalized.length >= 2) {
        setUseCaseBundleGenerationCategorizing(true);
        try {
          const cat = await runBundleUseCaseCategorization({
            useCases: normalized,
            logicalSteps: ls,
            provider,
            model,
            outputLanguage,
            buildCallMeta,
            normalizeGenerated: normalizeGeneratedUseCases,
          });
          normalized = cat.useCases;
          setUseCaseCategories(cat.categories);
        } catch (catErr) {
          console.warn('[useCaseBundle] categorize failed:', catErr);
          const catBanner = formatCategorizationFailureBanner(normalized.length, catErr);
          extendBatchWarning = extendBatchWarning
            ? `${extendBatchWarning} ${catBanner}`
            : catBanner;
        } finally {
          setUseCaseBundleGenerationCategorizing(false);
        }
      }
      setUseCases(normalized);
      setUseCaseBundleGenerationCount(normalized.length);
      setDirty(true);
      const tailMsg = [extendBatchWarning, kbContextWarning].filter(Boolean).join(' ');
      if (tailMsg) {
        setUseCaseComposerError(tailMsg);
      }
      const ids = normalized.map((u) => u.id);
      return {
        useCases: normalized,
        mode: 'replace',
        addedCount: normalized.length,
        highlightIds: ids,
        useCaseOrderingNote,
      };
    } catch (e) {
      setUseCaseComposerError(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setUseCaseBundleGenerationBusy(false);
      setUseCaseBundleGenerationCount(null);
      setUseCaseBundleGenerationOrdering(false);
      setUseCaseBundleGenerationCategorizing(false);
    }
  }, [
    hasAgentGeneration,
    designDescription,
    structuredRev,
    agentPrompt,
    provider,
    model,
    globalStyleContract,
    useCaseGlobalStyleId,
    getDeferAgentMessages,
    useCases,
    useCaseCategories,
    logicalSteps,
    knowledgeBaseDocuments,
    projectId,
    instanceId,
    projectData,
    projectData?.backendCatalog,
    updateDataDirectly,
    knowledgeBaseUpdateInternal,
    buildCallMeta,
  ]);

  const handleRegenerateUseCase = React.useCallback(
    async (useCaseId: string): Promise<AIAgentUseCase | null> => {
      const uc = useCases.find((u) => u.id === useCaseId);
      if (!uc) {
        setUseCaseComposerError('Use case non trovato.');
        return null;
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
          globalStyleContract,
          globalStyleId: useCaseGlobalStyleId,
          callMeta: buildCallMeta('USE_CASE_REGENERATE'),
        });
        const merged: AIAgentUseCase = {
          ...next,
          id: useCaseId,
          parent_id: uc.parent_id,
          sort_order: uc.sort_order,
          dialogue: next.dialogue.map((t) =>
            t.role === 'assistant' ? { ...t, motor_snapshot: undefined } : t
          ),
        };
        const toStore = getDeferAgentMessages?.()
          ? stripAssistantTurnsFromUseCase(merged)
          : merged;
        setUseCases((prev) =>
          normalizeUseCaseSiblingOrder(
            prev.map((u) => (u.id === useCaseId ? toStore : u)),
            useCaseSiblingSortModeRef.current
          )
        );
        setDirty(true);
        return toStore;
      } catch (e) {
        setUseCaseComposerError(e instanceof Error ? e.message : String(e));
        return null;
      } finally {
        setUseCaseComposerBusy(false);
      }
    },
    [
      useCases,
      logicalSteps,
      provider,
      model,
      globalStyleContract,
      useCaseGlobalStyleId,
      getDeferAgentMessages,
    ]
  );

  const handleGeneralizeUseCaseMeta = React.useCallback(
    async (useCaseId: string): Promise<AIAgentUseCase | null> => {
      const uc = useCases.find((u) => u.id === useCaseId);
      if (!uc) {
        setUseCaseComposerError('Use case non trovato.');
        return null;
      }
      setUseCaseComposerError(null);
      setUseCaseComposerBusy(true);
      try {
        const { tag: outputLanguage } = resolveAiAgentOutputLanguage();
        const { label: nextLabel, payoff: nextPayoff } = await generalizeAIAgentUseCaseMetaApi({
          label: uc.label ?? '',
          payoff: typeof uc.payoff === 'string' ? uc.payoff : '',
          provider,
          model,
          outputLanguage,
          globalStyleContract,
          globalStyleId: useCaseGlobalStyleId,
          callMeta: buildCallMeta(AI_CALL_PURPOSE.USE_CASE_GENERALIZE_META),
        });
        const merged: AIAgentUseCase = {
          ...uc,
          label: nextLabel,
          payoff: nextPayoff,
          designer_edit_confirmed: true,
          designer_label_vote: 'up',
          designer_payoff_vote: 'up',
        };
        setUseCases((prev) =>
          normalizeUseCaseSiblingOrder(
            prev.map((u) => (u.id === useCaseId ? merged : u)),
            useCaseSiblingSortModeRef.current
          )
        );
        setDirty(true);
        return merged;
      } catch (e) {
        setUseCaseComposerError(e instanceof Error ? e.message : String(e));
        return null;
      } finally {
        setUseCaseComposerBusy(false);
      }
    },
    [
      useCases,
      provider,
      model,
      globalStyleContract,
      useCaseGlobalStyleId,
      buildCallMeta,
      setUseCases,
    ]
  );

  const handlePolishUseCaseScenario = React.useCallback(
    async (
      useCaseId: string,
      scenarioTextOverride?: string
    ): Promise<AIAgentUseCase | null> => {
      const uc = useCases.find((u) => u.id === useCaseId);
      if (!uc) {
        setUseCaseComposerError('Use case non trovato.');
        return null;
      }
      const raw =
        typeof scenarioTextOverride === 'string' && scenarioTextOverride.trim()
          ? scenarioTextOverride.trim()
          : getScenarioText(uc);
      if (raw.length < 8) {
        setUseCaseComposerError('Scrivi almeno qualche parola nello scenario prima di aggiustare.');
        return null;
      }
      setUseCaseComposerError(null);
      setUseCaseComposerBusy(true);
      try {
        const { tag: outputLanguage } = resolveAiAgentOutputLanguage();
        const { scenario_llm } = await polishUseCaseScenarioApi({
          scenarioText: raw,
          provider,
          model,
          outputLanguage,
          callMeta: buildCallMeta(AI_CALL_PURPOSE.USE_CASE_POLISH_SCENARIO),
        });
        const merged = withScenarioText(uc, scenario_llm);
        const withVotes: AIAgentUseCase = {
          ...merged,
          designer_edit_confirmed: true,
          designer_payoff_vote: 'up',
        };
        setUseCases((prev) =>
          normalizeUseCaseSiblingOrder(
            prev.map((u) => (u.id === useCaseId ? withVotes : u)),
            useCaseSiblingSortModeRef.current
          )
        );
        setDirty(true);
        return withVotes;
      } catch (e) {
        setUseCaseComposerError(e instanceof Error ? e.message : String(e));
        return null;
      } finally {
        setUseCaseComposerBusy(false);
      }
    },
    [useCases, provider, model, buildCallMeta, setUseCases]
  );

  /**
   * Wizard passo 2: riscrivi le frasi esempio ancora alla baseline IA usando quelle modificate come riferimento di stile.
   */
  const handlePropagateExamplePhraseStyle = React.useCallback(
    async (params: {
      styleExampleUseCaseIds: readonly string[];
      targetUseCaseIds: readonly string[];
    }): Promise<{ updatedIds: string[]; nextUseCases: AIAgentUseCase[] } | null> => {
      const { styleExampleUseCaseIds, targetUseCaseIds } = params;
      if (styleExampleUseCaseIds.length === 0 || targetUseCaseIds.length === 0) return null;
      setUseCaseComposerError(null);
      setUseCasePhraseStylePropagationBusy(true);
      const targets = [...targetUseCaseIds];
      const total = targets.length;
      setUseCasePhraseStyleBatchProgress(total > 0 ? { current: 1, total } : null);
      try {
        const { tag: outputLanguage } = resolveAiAgentOutputLanguage();
        const byContent = new Map<string, string>();
        for (let i = 0; i < targets.length; i += 1) {
          setUseCasePhraseStyleBatchProgress({ current: i + 1, total });
          const res = await propagateExamplePhraseStyleApi({
            allUseCases: useCases,
            logicalSteps,
            styleExampleUseCaseIds: [...styleExampleUseCaseIds],
            targetUseCaseIds: [targets[i]],
            provider,
            model,
            outputLanguage,
            globalStyleContract,
            globalStyleId: useCaseGlobalStyleId,
            callMeta: buildCallMeta('USE_CASE_PROPAGATE_STYLE'),
          });
          for (const row of res.updates) {
            byContent.set(row.use_case_id, row.assistant_content);
          }
        }
        const nextUseCases = normalizeUseCaseSiblingOrder(
          useCases.map((u) => {
            const newContent = byContent.get(u.id);
            if (newContent === undefined) return u;
            const turnId = u.dialogue.find((t) => t.role === 'assistant')?.turn_id;
            if (!turnId) return u;
            return {
              ...u,
              dialogue: u.dialogue.map((t) =>
                t.turn_id === turnId && t.role === 'assistant'
                  ? {
                      ...t,
                      content: newContent,
                      motor_snapshot: undefined,
                    }
                  : t
              ),
              designer_edit_confirmed: true as const,
            };
          }),
          useCaseSiblingSortModeRef.current
        );
        const updatedIds = targets.filter((id) => byContent.has(id));
        setUseCases(nextUseCases);
        setDirty(true);
        return { updatedIds, nextUseCases };
      } catch (e) {
        setUseCaseComposerError(e instanceof Error ? e.message : String(e));
        return null;
      } finally {
        setUseCasePhraseStylePropagationBusy(false);
        setUseCasePhraseStyleBatchProgress(null);
      }
    },
    [useCases, logicalSteps, provider, model, globalStyleContract, useCaseGlobalStyleId]
  );

  /**
   * Toolbar wizard «Completa correzione»: chiama l'endpoint directional
   * (`propagate_correction_style`) passando coppie (original→modified) per gli
   * esempi e l'`original` di ogni target. Il caller (composer) costruisce il
   * payload usando `useCaseSubstantialEdits.ts` + `fieldBaselineByUseCaseId`.
   *
   * Questo controller helper si limita alla chiamata HTTP + propagazione errori:
   * NON tocca `setUseCases` né `fieldBaselineByUseCaseId` (responsabilità del
   * composer, che ha la baseline e i marker [NEW] da gestire localmente).
   *
   * Riusa `useCasePhraseStylePropagationBusy` come lock: si tratta della stessa
   * famiglia di operazioni (propagazione stile via LLM) ed evita due concorrenti
   * sullo stesso task. Il flag `useCasePhraseStyleBatchProgress` non è più
   * settato perché il backend itera internamente i target ma non emette progress
   * incrementale al client (single fetch atomica): mostriamo solo "busy".
   */
  const handleCompleteCorrection = React.useCallback(
    async (params: {
      directionalExamples: PropagateCorrectionStyleParams['directionalExamples'];
      directionalTargets: PropagateCorrectionStyleParams['directionalTargets'];
    }): Promise<PropagateCorrectionStyleResult | null> => {
      const { directionalExamples, directionalTargets } = params;
      if (directionalExamples.length === 0 || directionalTargets.length === 0) return null;
      setUseCaseComposerError(null);
      setUseCasePhraseStylePropagationBusy(true);
      try {
        const { tag: outputLanguage } = resolveAiAgentOutputLanguage();
        const result = await propagateCorrectionStyleApi({
          directionalExamples,
          directionalTargets,
          provider,
          model,
          outputLanguage,
          globalStyleContract,
          callMeta: buildCallMeta(AI_CALL_PURPOSE.USE_CASE_COMPLETE_CORRECTION),
        });
        setDirty(true);
        return result;
      } catch (e) {
        setUseCaseComposerError(e instanceof Error ? e.message : String(e));
        return null;
      } finally {
        setUseCasePhraseStylePropagationBusy(false);
      }
    },
    [provider, model, globalStyleContract]
  );

  /**
   * Regenerate a single assistant dialogue turn (e.g. empty after failed create); adds an assistant shell if missing.
   */
  const handleRegenerateAgentMessage = React.useCallback(
    async (useCaseId: string): Promise<string | null> => {
      const uc = useCases.find((u) => u.id === useCaseId);
      if (!uc) {
        setUseCaseComposerError('Use case non trovato.');
        return null;
      }
      let turnId = uc.dialogue.find((t) => t.role === 'assistant')?.turn_id;
      let snapshot: AIAgentUseCase = uc;
      if (!turnId) {
        turnId = newAgentUseCaseTurnId();
        snapshot = {
          ...uc,
          dialogue: [
            ...uc.dialogue,
            { turn_id: turnId, role: 'assistant', content: '', editable: true },
          ],
        };
        setUseCases((prev) => prev.map((u) => (u.id === useCaseId ? snapshot : u)));
      }
      setUseCaseComposerError(null);
      setUseCaseComposerBusy(true);
      try {
        const { tag: outputLanguage } = resolveAiAgentOutputLanguage();
        const turn = await regenerateAIAgentUseCaseTurnApi({
          useCase: snapshot,
          turnId,
          provider,
          model,
          outputLanguage,
          callMeta: buildCallMeta('USE_CASE_REGENERATE_TURN'),
        });
        setUseCases((prev) =>
          prev.map((u) => {
            if (u.id !== useCaseId) return u;
            const has = u.dialogue.some((t) => t.turn_id === turnId);
            const dialogue = has
              ? u.dialogue.map((t) =>
                  t.turn_id === turnId
                    ? {
                        ...t,
                        content: turn.content,
                        role: turn.role,
                        editable: turn.role === 'assistant',
                        motor_snapshot: undefined,
                      }
                    : t
                )
              : [...u.dialogue, { ...turn, editable: turn.role === 'assistant' }];
            return { ...u, dialogue };
          })
        );
        setDirty(true);
        return typeof turn.content === 'string' ? turn.content : null;
      } catch (e) {
        setUseCaseComposerError(e instanceof Error ? e.message : String(e));
        return null;
      } finally {
        setUseCaseComposerBusy(false);
      }
    },
    [useCases, provider, model]
  );

  /**
   * LLM annotates assistant message with [slot] tokens for motor JSON (explicit designer action).
   */
  const handleAnnotateAgentMessageForJson = React.useCallback(
    async (useCaseId: string, assistantContentFromEditor?: string): Promise<boolean> => {
      const uc = useCases.find((u) => u.id === useCaseId);
      if (!uc) {
        setUseCaseComposerError('Use case non trovato.');
        return false;
      }
      let turnId = uc.dialogue.find((t) => t.role === 'assistant')?.turn_id;
      let snapshot: AIAgentUseCase = uc;
      if (!turnId) {
        turnId = newAgentUseCaseTurnId();
        snapshot = {
          ...uc,
          dialogue: [
            ...uc.dialogue,
            { turn_id: turnId, role: 'assistant', content: '', editable: true },
          ],
        };
        setUseCases((prev) => prev.map((u) => (u.id === useCaseId ? snapshot : u)));
      }
      /**
       * Testo letto dalla textarea al click: evita stato React non ancora committato dopo l’ultima modifica.
       * Allinea anche lo stato così il campo controllato non «salta» alla versione precedente durante busy.
       */
      if (typeof assistantContentFromEditor === 'string' && turnId) {
        snapshot = {
          ...snapshot,
          dialogue: snapshot.dialogue.map((t) =>
            t.turn_id === turnId ? { ...t, content: assistantContentFromEditor, userEdited: true } : t
          ),
        };
        setUseCasesUser((prev) =>
          prev.map((u) =>
            u.id !== useCaseId
              ? u
              : {
                  ...u,
                  dialogue: u.dialogue.map((t) =>
                    t.turn_id === turnId
                      ? { ...t, content: assistantContentFromEditor, userEdited: true }
                      : t
                  ),
                }
          )
        );
      }
      const msgTrim = snapshot.dialogue.find((t) => t.turn_id === turnId)?.content?.trim() ?? '';
      if (!msgTrim) {
        setUseCaseComposerError('Scrivi prima un messaggio agente da annotare.');
        return false;
      }
      setUseCaseComposerError(null);
      setUseCaseComposerBusy(true);
      try {
        const { tag: outputLanguage } = resolveAiAgentOutputLanguage();
        const { content: annotated, motor } = await annotateAIAgentAssistantMessageForJsonApi({
          useCase: snapshot,
          turnId,
          provider,
          model,
          outputLanguage,
          globalStyleContract,
          ...(typeof assistantContentFromEditor === 'string'
            ? { assistantMessageText: assistantContentFromEditor }
            : {}),
          callMeta: buildCallMeta('USE_CASE_ANNOTATE'),
        });
        setUseCasesUser((prev) =>
          prev.map((u) => {
            if (u.id !== useCaseId) return u;
            return {
              ...u,
              dialogue: u.dialogue.map((t) =>
                t.turn_id === turnId
                  ? {
                      ...t,
                      content: annotated,
                      userEdited: true,
                      motor_snapshot: { source_content: annotated, payload: motor },
                    }
                  : t
              ),
            };
          })
        );
        setDirty(true);
        return true;
      } catch (e) {
        setUseCaseComposerError(e instanceof Error ? e.message : String(e));
        return false;
      } finally {
        setUseCaseComposerBusy(false);
      }
    },
    [useCases, provider, model, globalStyleContract, setUseCasesUser]
  );

  /**
   * Removes a use case and all descendants from the hierarchy; re-normalizes sibling order.
   */
  const handleDeleteUseCase = React.useCallback(
    (useCaseId: string) => {
      promptsPanelHandlers.onDeleteUseCase(useCaseId);
    },
    [promptsPanelHandlers]
  );

  const handleDeleteConversationalRule = React.useCallback((ruleId: string) => {
    if (!conversationalRules.some((r) => r.id === ruleId)) {
      setUseCaseComposerError('Regola non trovata.');
      return;
    }
    setUseCaseComposerError(null);
    setConversationalRules((prev) => prev.filter((r) => r.id !== ruleId));
    setDirty(true);
  }, [conversationalRules]);

  const handleCreateConversationalRule = React.useCallback(
    async (params: {
      label: string;
      parentId: string | null;
      creationScope?: 'single' | 'batch';
    }): Promise<string> => {
      const label = String(params.label || '').trim();
      if (!label) {
        throw new Error('Il titolo della regola è obbligatorio.');
      }
      if (params.parentId !== null) {
        throw new Error('Le regole conversazionali non supportano sotto-regole.');
      }
      const maxOrder = conversationalRules.reduce(
        (max, r) => Math.max(max, r.sort_order),
        -1
      );
      const rule = createConversationalRuleFromLabel(label, maxOrder + 1);
      setConversationalRules((prev) => [...prev, rule]);
      setDirty(true);
      return rule.id;
    },
    [conversationalRules]
  );

  const handleSplitRootUseCaseDraft = React.useCallback(
    async (draftText: string): Promise<import('./parseRootUseCaseDraft').SplitRootUseCaseDraftResult> => {
      const draft = String(draftText || '').trim();
      if (!draft) return { labels: [], startLabel: null };
      const { tag: outputLanguage } = resolveAiAgentOutputLanguage();
      const { labels, startLabelIndex } = await splitRootUseCaseDraftApi({
        draftText: draft,
        allUseCases: useCases,
        provider,
        model,
        outputLanguage,
        callMeta: buildCallMeta(AI_CALL_PURPOSE.USE_CASE_SPLIT_ROOT_DRAFT),
      });
      const startLabel =
        typeof startLabelIndex === 'number' &&
        startLabelIndex >= 0 &&
        startLabelIndex < labels.length
          ? labels[startLabelIndex]
          : null;
      logUseCaseRootBatch('controller_splitRootUseCaseDraft_ok', {
        labelCount: labels.length,
        startLabelPreview: startLabel?.slice(0, 80) ?? null,
      });
      return { labels, startLabel };
    },
    [useCases, provider, model, buildCallMeta]
  );

  const handleCreateUseCase = React.useCallback(
    async (params: {
      label: string;
      parentId: string | null;
      /** Root batch: plural progress copy while the LLM runs. */
      creationScope?: 'single' | 'batch';
      /** When true, busy/creation message stay until a later create clears them (root batch). */
      holdComposerBusy?: boolean;
      /**
       * Root batch: append in place without `normalizeUseCaseSiblingOrder` until depth returns 0
       * (evita salti di ordinamento / flicker tra una creazione LLM e l'altra).
       */
      deferSiblingReorder?: boolean;
    }): Promise<string> => {
      const rawLabel = String(params.label || '').trim();
      logUseCaseRootBatch('controller_handleCreateUseCase_enter', {
        rawLabelPreview: rawLabel.slice(0, 120),
        parentId: params.parentId ?? null,
        existingUseCaseCount: useCases.length,
      });
      if (!rawLabel) {
        throw new Error('Il titolo del use case e obbligatorio.');
      }
      const parentId = params.parentId ?? null;
      const parentExists = parentId === null || useCases.some((x) => x.id === parentId);
      if (!parentExists) {
        logUseCaseRootBatch('controller_handleCreateUseCase_invalid_parent', { parentId });
        throw new Error('Nodo padre non valido per la creazione del use case.');
      }

      const newUseCaseId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `uc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const placeholder: AIAgentUseCase = {
        id: newUseCaseId,
        label: rawLabel,
        parent_id: parentId,
        sort_order: 0,
        refinement_prompt: '',
        style_id: useCaseGlobalStyleId,
        payoff: '',
        dialogue: [],
        notes: {
          behavior: rawLabel,
          tone: globalStyleContract,
        },
        bubble_notes: {},
      };

      setUseCaseComposerError(null);
      const deferReorder = params.deferSiblingReorder === true;
      if (!useCaseComposerBusy) {
        setUseCaseCreationMessage(
          params.creationScope === 'batch'
            ? LABEL_CREATING_MULTIPLE_USE_CASES
            : LABEL_CREATING_ONE_USE_CASE
        );
        setUseCaseComposerBusy(true);
      }
      setUseCases((prev) =>
        deferReorder
          ? appendUseCaseToSiblingGroup(prev, placeholder)
          : normalizeUseCaseSiblingOrder([...prev, placeholder], useCaseSiblingSortModeRef.current)
      );
      setDirty(true);

      try {
        logUseCaseRootBatch('controller_createAIAgentUseCaseApi_before', {
          newUseCaseId,
          logicalStepsCount: logicalSteps.length,
        });
        const { tag: outputLanguage } = resolveAiAgentOutputLanguage();
        const created = await createAIAgentUseCaseApi({
          useCase: placeholder,
          allUseCases: useCases,
          logicalSteps,
          provider,
          model,
          outputLanguage,
          globalStyleContract,
          globalStyleId: useCaseGlobalStyleId,
          callMeta: buildCallMeta(AI_CALL_PURPOSE.USE_CASE_DIALOGUE_CREATE),
        });
        logUseCaseRootBatch('controller_createAIAgentUseCaseApi_after', {
          newUseCaseId,
          createdLabelPreview: String(created.label ?? '').slice(0, 80),
        });
        const mergedCreated: AIAgentUseCase = {
          ...created,
          id: newUseCaseId,
          parent_id: parentId,
        };
        const mergedForList = applySystemProposedUseCaseDefaults(
          getDeferAgentMessages?.()
            ? stripAssistantTurnsFromUseCase(mergedCreated)
            : mergedCreated
        );
        setUseCases((prev) => {
          const mapped = prev.map((item) => (item.id === newUseCaseId ? mergedForList : item));
          return deferReorder
            ? mapped
            : normalizeUseCaseSiblingOrder(mapped, useCaseSiblingSortModeRef.current);
        });
        setDirty(true);
        const assistantAfterCreate = mergedCreated.dialogue.find((t) => t.role === 'assistant');
        const assistantTurnId = assistantAfterCreate?.turn_id;
        if (
          !getDeferAgentMessages?.() &&
          assistantAfterCreate?.content?.trim() &&
          assistantTurnId
        ) {
          try {
            const { content: annotated, motor } = await annotateAIAgentAssistantMessageForJsonApi({
              useCase: mergedCreated,
              turnId: assistantTurnId,
              provider,
              model,
              outputLanguage,
              globalStyleContract,
              callMeta: buildCallMeta('USE_CASE_ANNOTATE'),
            });
            setUseCases((prev) => {
              const mapped = prev.map((item) =>
                item.id === newUseCaseId
                  ? {
                      ...item,
                      dialogue: item.dialogue.map((t) =>
                        t.turn_id === assistantTurnId
                          ? {
                              ...t,
                              content: annotated,
                              motor_snapshot: {
                                source_content: annotated,
                                payload: motor,
                              },
                            }
                          : t
                      ),
                    }
                  : item
              );
              return deferReorder
                ? mapped
                : normalizeUseCaseSiblingOrder(mapped, useCaseSiblingSortModeRef.current);
            });
            setDirty(true);
          } catch {
            /* Messaggio creato senza motor snapshot — designer può usare Crea JSON */
          }
        }
        return newUseCaseId;
      } catch (e) {
        logUseCaseRootBatch('controller_createAIAgentUseCaseApi_error', {
          newUseCaseId,
          message: e instanceof Error ? e.message : String(e),
        });
        setUseCaseComposerError(e instanceof Error ? e.message : String(e));
        setUseCases((prev) => {
          const filtered = prev.filter((item) => item.id !== newUseCaseId);
          return params.deferSiblingReorder === true
            ? normalizeUseCaseSiblingOrder(filtered, useCaseSiblingSortModeRef.current)
            : filtered;
        });
        setUseCaseComposerBusy(false);
        setUseCaseCreationMessage(null);
        throw e;
      } finally {
        if (!params.holdComposerBusy) {
          if (params.deferSiblingReorder === true) {
            setUseCases((prev) =>
              normalizeUseCaseSiblingOrder(prev, useCaseSiblingSortModeRef.current)
            );
          }
          setUseCaseComposerBusy(false);
          setUseCaseCreationMessage(null);
        }
        logUseCaseRootBatch('controller_handleCreateUseCase_finally', {
          newUseCaseId,
          holdComposerBusy: params.holdComposerBusy === true,
          deferSiblingReorder: params.deferSiblingReorder === true,
        });
      }
    },
    [
      useCases,
      logicalSteps,
      provider,
      model,
      globalStyleContract,
      useCaseGlobalStyleId,
      getDeferAgentMessages,
      useCaseComposerBusy,
    ]
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
    agentUseCaseGlobalStyleId: useCaseGlobalStyleId,
    agentUseCaseStyleLearningNotes,
    initialStateTemplateJson,
    agentRuntimeCompactJson,
    hasAgentGeneration,
    agentLogicalStepsJson: serializeLogicalSteps(logicalSteps),
    agentUseCasesJson: serializeUseCases(useCases, useCaseCategories),
    agentConversationalRulesJson: serializeConversationalRules(conversationalRules),
    agentUseCaseWizardStateJson,
    agentIaRuntimeOverrideJson: serializeIaAgentConfigForTaskPersistence(
      mergeConvaiAgentIdFromGlobalDefaults(iaRuntimeConfig, loadGlobalIaAgentConfig())
    ),
    agentImmediateStart,
    agentConstructionPhase,
    agentWizardCurrentStep,
    agentWizardTutorAcknowledged,
    agentConversationStyleExample,
    agentConversationStyleAuto,
    agentConversationStyleSelections,
    agentConversationDeployStyleId,
    agentLogUseCase,
    agentLogBackendCalls,
    agentBehavior,
    agentInterfaceJson,
    agentKnowledgeBaseDocumentsJson,
    agentBackendOutputSlotBindingsJson,
    agentStartPromptJson: serializeAgentStartPromptConfig(agentStartPromptConfig),
    agentStartUseCaseId: String(agentStartUseCaseId ?? '').trim(),
  };

  const setAgentStartPromptConfig = React.useCallback((next: AgentStartPromptConfig) => {
    setAgentStartPromptConfigState(next);
    setDirty(true);
  }, []);

  const setAgentStartUseCaseId = React.useCallback((next: string) => {
    setAgentStartUseCaseIdState(String(next ?? '').trim());
    setDirty(true);
  }, []);

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

  const importReviewStructuredSections = React.useCallback(
    (sections: AgentReviewStructuredSections) => {
      loadFromPersisted(persistedSectionsFromReviewImport(sections));
      setDirty(true);
    },
    [loadFromPersisted]
  );

  return {
    instanceId,
    /** Helper esposto per altri hook locali (es. `useAIAgentConversationActions`) che hanno
     *  bisogno di costruire il `callMeta` con la stessa snapshot `taskId`/`taskLabel`. */
    buildCallMeta,
    designDescription,
    setDesignDescription: setDesignDescriptionUser,
    getTaskTextBaseline,
    setTaskTextBaseline,
    syncTaskTextBaselinesFromAgentOutput,
    commitAgentStabilizedTaskText,
    getTaskTextCurrentText,
    dismissTaskTextReviewOffer,
    clearTaskTextReviewOfferDismissed,
    isTaskTextReviewOfferDismissed,
    notifyTaskTextManualEdit,
    hasTaskTextManualEdit,
    onTaskTextReviewError,
    agentPrompt,
    agentStructuredSectionsJson,
    structuredSectionsState: structuredRev.sectionsState,
    composedRuntimeMarkdown: structuredRev.composedRuntimeMarkdown,
    structuredDesignDirty,
    importReviewStructuredSections,
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
    useCaseGlobalStyleId,
    setUseCaseGlobalStyleId,
    agentUseCaseStyleLearningNotes,
    setAgentUseCaseStyleLearningNotes,
    initialStateTemplateJson,
    setInitialStateTemplateJson,
    agentRuntimeCompactJson,
    promptFinalAligned,
    ensurePromptFinalDeterministicCompile: ensurePromptFinalDeterministicCompileSync,
    agentImmediateStart,
    setAgentImmediateStart,
    generating,
    generateError,
    iaRevisionDiffBySection,
    dismissIaRevisionForSection,
    hasAgentGeneration,
    showPrimaryAgentAction,
    handleGenerate,
    updateProposedField,
    removeProposedField,
    appendProposedFields,
    syncFlowVariableFromLabel,
    logicalSteps,
    useCases,
    conversationalRules,
    setConversationalRules: setConversationalRulesUser,
    setLogicalSteps,
    setUseCases: setUseCasesUser,
    useCaseComposerBusy,
    useCaseBundleGenerationBusy,
    useCaseBundleGenerationCount,
    useCaseBundleGenerationOrdering,
    useCaseBundleGenerationCategorizing,
    useCaseCategories,
    setUseCaseCategories,
    useCasePhraseStylePropagationBusy,
    useCasePhraseStyleBatchProgress,
    useCaseCreationMessage,
    useCaseComposerError,
    clearUseCaseComposerError,
    handleGenerateUseCaseBundle,
    handleCreateUseCase,
    handleSplitRootUseCaseDraft,
    handleRegenerateUseCase,
    handleGeneralizeUseCaseMeta,
    handlePolishUseCaseScenario,
    handlePropagateExamplePhraseStyle,
    handleCompleteCorrection,
    globalStyleContract,
    persistAgentUseCaseWizardState,
    agentUseCaseWizardStateJson,
    handleClearWizardOutput,
    handleRegenerateAgentMessage,
    handleAnnotateAgentMessageForJson,
    handleDeleteUseCase,
    handleUseCaseInvalidationNoteChange,
    handleUseCaseInvalidationStateChange,
    handleCreateConversationalRule,
    handleDeleteConversationalRule,
    useCaseSiblingSortMode,
    setUseCaseSiblingSortMode,
    reorderUseCaseSiblingByDrag,
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
    agentConstructionPhase,
    setAgentConstructionPhase,
    agentWizardCurrentStep,
    setAgentWizardCurrentStep,
    agentWizardTutorAcknowledged,
    acknowledgeAgentWizardTutor,
    agentConversationStyleExample,
    setAgentConversationStyleExample,
    agentConversationStyleAuto,
    setAgentConversationStyleAuto,
    agentConversationStyleSelections,
    setAgentConversationStyleSelections,
    agentConversationDeployStyleId,
    setAgentConversationDeployStyleId,
    agentLogUseCase,
    setAgentLogUseCase,
    agentLogBackendCalls,
    setAgentLogBackendCalls,
    agentBehavior,
    setAgentBehavior,
    agentInterfaceInput,
    agentInterfaceOutput,
    setAgentInterfaceInput,
    setAgentInterfaceOutput,
    agentInterfaceJson,
    knowledgeBaseDocuments,
    knowledgeBaseAddFiles,
    knowledgeBaseRemoveDocument,
    knowledgeBaseUpdateDocument,
    knowledgeBaseReorderDocuments,
    knowledgeBaseTaskContext,
    agentUseCasesJson: serializeUseCases(useCases, useCaseCategories),
    agentStartPromptConfig,
    setAgentStartPromptConfig,
    agentStartUseCaseId,
    setAgentStartUseCaseId,
    agentConversationalRulesJson: serializeConversationalRules(conversationalRules),
    compileUseCasePhrasesForCatalog,
    rebuildSlotMappingFromScratch,
    compilePhrasesBusy,
    buildWebhookReadinessReport,
    compileMappingBanner,
    registerOpenSlotMappingOnCompileFail,
    backendOutputSlotBindings,
    backendSendParamLeaves,
    backendSendLeavesByTask,
    parameterDestinationCatalog,
    projectSlotLexicon,
    reconcileLexiconOrphansWithCatalog,
    approveLexiconSurface,
    revokeLexiconSurface,
    updateLexiconSlotId,
    upsertDesignerSlotRegistry,
    assignDesignerSurfaceSlotMapping,
    updateSurfaceSendHint,
    applyParameterDestination,
    markAgentEditorDirty: () => setDirty(true),
  };
}
