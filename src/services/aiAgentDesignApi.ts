/**
 * Client for design-time AI Agent generation (Node backend /design/ai-agent-generate).
 */

/**
 * Cost-tracking metadata propagati end-to-end FE -> BE -> log per ogni chiamata IA del task
 * editor. La triade `(purpose, taskId, taskLabel)` permette al report ad albero di raggruppare
 * tutte le chiamate originate da uno specifico task instance ("macro-task"). Per chiamate
 * globali non legate a un task (es. traduzioni dalla UI globale) `taskId/taskLabel` restano
 * undefined e i record finiscono sotto il nodo "Globale (senza task)" del report.
 */
export interface AiCallMeta {
  /** AI_CALL_PURPOSE id (vedi {@link import('../domain/aiCalls/purposes').AiCallPurposeId}). */
  readonly purpose?: string;
  /** TaskTreeNode.taskId del task originante (snapshot al momento della call). */
  readonly taskId?: string;
  /** Snapshot della label del task al momento della call (per fedelt\u00e0 storica del report). */
  readonly taskLabel?: string;
}

/**
 * Inietta selettivamente i campi non-vuoti di `callMeta` nel body di una request /design/*.
 * Mutates and returns `bodyPayload` for chained build patterns.
 */
function applyCallMetaToBody(
  bodyPayload: Record<string, unknown>,
  callMeta: AiCallMeta | undefined
): Record<string, unknown> {
  if (!callMeta) return bodyPayload;
  if (typeof callMeta.purpose === 'string' && callMeta.purpose.trim()) {
    bodyPayload.purpose = callMeta.purpose.trim();
  }
  if (typeof callMeta.taskId === 'string' && callMeta.taskId.trim()) {
    bodyPayload.taskId = callMeta.taskId.trim();
  }
  if (typeof callMeta.taskLabel === 'string' && callMeta.taskLabel.trim()) {
    bodyPayload.taskLabel = callMeta.taskLabel.trim();
  }
  return bodyPayload;
}

import type { AIAgentDesignApiError, AIAgentDesignApiSuccess, AIAgentDesignPayload } from '@types/aiAgentDesign';
import type {
  AIAgentLogicalStep,
  AIAgentUseCase,
  AIAgentUseCaseCategory,
  AIAgentUseCaseTurn,
} from '@types/aiAgentUseCases';
import type { UseCaseTestQuestion } from '@domain/aiAgentUseCase/useCaseTestQuestions';
import type {
  UseCaseGeneratorWizardConversation,
  UseCaseGeneratorWizardConversationOutcome,
  UseCaseGeneratorWizardTurn,
  UseCaseGeneratorWizardTurnAgent,
  UseCaseGeneratorWizardTurnSuggestion,
  UseCaseGeneratorWizardTurnUser,
} from '@domain/useCaseGeneratorWizard/types';
import { isSuggestedUseCaseId } from '@domain/useCaseGeneratorWizard/types';
import {
  normalizeAnalyzeDebuggerTurnUseCaseResult,
  type AnalyzeDebuggerTurnUseCaseResult,
} from '@domain/aiAgentDebugger/analyzeDebuggerTurnUseCaseResult';
import type { AgentMessageMotorPayload } from '@domain/aiAgentUseCase/splitAgentMessageTemplate';
import {
  parseAgentLogicalStepsFromApi,
  parseAgentUseCasesFromApi,
  parseOneUseCaseFromApi,
  parseAgentUseCaseTurnFromApi,
} from '@types/aiAgentUseCases';
import type { StructuredRefinementOp } from '../components/TaskEditor/EditorHost/editors/aiAgentEditor/structuredRefinementOps';
import { emitDesignAiLlmBurstFromErrorResponse } from '../utils/aiAgentHighFrequencyAlert';
import { confirmAiAgentGenerateIfEnabled } from '../utils/aiAgentGenerateConfirmGate';
import { parseDesignApiJsonResponse } from './designApiResponse';
import { designAiFetch } from './designAiRequestPipeline';
import { AI_CALL_PURPOSE } from '@domain/aiCalls/purposes';

async function fetchAiAgentDesignAgentGenerate(init: RequestInit): Promise<Response> {
  await confirmAiAgentGenerateIfEnabled();
  return designAiFetch('/design/ai-agent-generate', init);
}

/** Per-section refine bundle (positions relative to that section's baseText only). */
export interface SectionRefinementBundle {
  sectionId: string;
  baseText: string;
  refinementPatch: StructuredRefinementOp[];
}

/** Refine/generate routing for structured pipeline alignment (client + /design/ai-agent-generate). */
export type StructuredRegenerateScope = 'from_description' | 'sections_only';

export interface GenerateAIAgentDesignParams {
  userDesc: string;
  provider: string;
  model: string;
  /** Clean IA snapshot before user revisions (legacy single-field refine). */
  baseText?: string;
  /** Chronological structured revision ops (legacy single-field refine). */
  refinementPatch?: StructuredRefinementOp[];
  /** Multi-section structured refine (preferred when present). */
  sectionRefinements?: SectionRefinementBundle[];
  /** BCP 47 tag (e.g. it-IT): all natural-language fields in the design should use this language. */
  outputLanguage?: string;
  /**
   * Refine: `sections_only` runs deterministic compile only on {@link structuredDesignForPhase3}.
   * `from_description` is handled by the client via {@link extractStructuredDesign} (Phase 1 NL-only).
   */
  structuredRegenerateScope?: StructuredRegenerateScope;
  /** Required when {@link structuredRegenerateScope} is `sections_only` (validated server-side). */
  structuredDesignForPhase3?: Record<string, unknown>;
  /** Target platform id for Phase 3 shadow / sections_only (e.g. openai, omnia). */
  compilePlatform?: string;
  /** Cost-tracking metadata; default purpose `AGENT_REFINE` lato backend se omesso. */
  callMeta?: AiCallMeta;
}

/** Discriminated result: full design payload vs sections-only platform compile. */
export type GenerateAIAgentDesignResult =
  | { mode: 'full'; design: AIAgentDesignPayload }
  | { mode: 'sections_only'; platform: string; system_prompt: string };

const DEFAULT_TIMEOUT_MS = 120000;

/** Use case bundle generation can exceed the default design timeout. */
const GENERATE_USE_CASES_TIMEOUT_MS = 300000;

/** Debugger analyze-turn LLM call (aligned with backend ANALYZE_DEBUG_TURN_TIMEOUT_MS). */
const ANALYZE_DEBUG_TURN_TIMEOUT_MS = 90000;

/**
 * Phase 1: structured IR extraction from natural language only (POST /design/extract-structure).
 */
export async function extractStructuredDesign(params: {
  description: string;
  provider: string;
  model: string;
  /** BCP 47 tag (e.g. it-IT); all IR string fields should be written in this language. */
  outputLanguage?: string;
  /** Cost-tracking metadata; default purpose `AGENT_CREATE` lato backend se omesso. */
  callMeta?: AiCallMeta;
}): Promise<unknown> {
  const { description, provider, model, outputLanguage } = params;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const bodyPayload: Record<string, unknown> = {
      description: description.trim(),
      provider: provider.toLowerCase(),
      model,
    };
    if (typeof outputLanguage === 'string' && outputLanguage.trim().length > 0) {
      bodyPayload.outputLanguage = outputLanguage.trim();
    }
    const res = await designAiFetch('/design/extract-structure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(applyCallMetaToBody(bodyPayload, params.callMeta)),
      signal: controller.signal,
    });
    const body = (await parseDesignApiJsonResponse(res)) as
      | { success: true; structured_design: unknown }
      | AIAgentDesignApiError;
    if (!res.ok || !body.success) {
      emitDesignAiLlmBurstFromErrorResponse(res, body);
      const err = body as AIAgentDesignApiError;
      const msg = err.error || `HTTP ${res.status}`;
      const extra = err.rawSnippet ? ` — snippet: ${err.rawSnippet.slice(0, 200)}` : '';
      throw new Error(msg + extra);
    }
    return (body as { structured_design: unknown }).structured_design;
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateAIAgentDesign(
  params: GenerateAIAgentDesignParams
): Promise<GenerateAIAgentDesignResult> {
  const {
    userDesc,
    provider,
    model,
    refinementPatch,
    baseText,
    sectionRefinements,
    outputLanguage,
    structuredRegenerateScope,
    structuredDesignForPhase3,
    compilePlatform,
  } = params;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const bodyPayload: Record<string, unknown> = {
      userDesc,
      provider: provider.toLowerCase(),
      model,
    };
    if (typeof baseText === 'string' && baseText.length > 0) {
      bodyPayload.baseText = baseText;
    }
    if (refinementPatch && refinementPatch.length > 0) {
      bodyPayload.refinementPatch = refinementPatch;
    }
    if (sectionRefinements && sectionRefinements.length > 0) {
      bodyPayload.sectionRefinements = sectionRefinements;
    }
    if (typeof outputLanguage === 'string' && outputLanguage.trim().length > 0) {
      bodyPayload.outputLanguage = outputLanguage.trim();
    }
    if (structuredRegenerateScope) {
      bodyPayload.structuredRegenerateScope = structuredRegenerateScope;
    }
    if (structuredDesignForPhase3 && typeof structuredDesignForPhase3 === 'object') {
      bodyPayload.structured_design = structuredDesignForPhase3;
    }
    if (typeof compilePlatform === 'string' && compilePlatform.trim().length > 0) {
      bodyPayload.compilePlatform = compilePlatform.trim().toLowerCase();
    }

    const res = await fetchAiAgentDesignAgentGenerate({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(applyCallMetaToBody(bodyPayload, params.callMeta)),
      signal: controller.signal,
    });
    const body = (await parseDesignApiJsonResponse(res)) as
      | AIAgentDesignApiSuccess
      | AIAgentDesignApiError
      | {
          success: true;
          refineMode: 'sections_only';
          platform: string;
          system_prompt: string;
        };
    if (!res.ok || !body.success) {
      emitDesignAiLlmBurstFromErrorResponse(res, body);
      const err = body as AIAgentDesignApiError;
      const msg = err.error || `HTTP ${res.status}`;
      const extra = err.rawSnippet ? ` — snippet: ${err.rawSnippet.slice(0, 200)}` : '';
      throw new Error(msg + extra);
    }
    if (
      'refineMode' in body &&
      body.refineMode === 'sections_only' &&
      typeof body.system_prompt === 'string'
    ) {
      return {
        mode: 'sections_only',
        platform: typeof body.platform === 'string' ? body.platform : '',
        system_prompt: body.system_prompt,
      };
    }
    const full = body as AIAgentDesignApiSuccess;
    if (!full.design) {
      throw new Error('Risposta non valida: design mancante.');
    }
    return { mode: 'full', design: full.design };
  } finally {
    clearTimeout(timeout);
  }
}

export interface InduceStyleRuleParams {
  wrongText: string;
  correctText: string;
  provider: string;
  model?: string;
  outputLanguage?: string;
  callMeta?: AiCallMeta;
}

/**
 * Debugger: infer one style rule from wrong vs correct assistant lines (POST /design/ai-agent-induce-style-rule).
 */
export async function induceStyleRuleFromCorrectionApi(
  params: InduceStyleRuleParams
): Promise<{ rule_text: string }> {
  const { wrongText, correctText, provider, model, outputLanguage } = params;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const bodyPayload: Record<string, unknown> = {
      wrongText: wrongText.trim(),
      correctText: correctText.trim(),
      provider: provider.toLowerCase(),
    };
    if (typeof model === 'string' && model.trim().length > 0) {
      bodyPayload.model = model.trim();
    }
    if (typeof outputLanguage === 'string' && outputLanguage.trim().length > 0) {
      bodyPayload.outputLanguage = outputLanguage.trim();
    }
    const res = await designAiFetch('/design/ai-agent-induce-style-rule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(applyCallMetaToBody(bodyPayload, params.callMeta)),
      signal: controller.signal,
    });
    const body = (await parseDesignApiJsonResponse(res)) as { success: true; rule_text: string } | AIAgentDesignApiError;
    if (!res.ok || !body || typeof body !== 'object' || !('success' in body) || !body.success) {
      emitDesignAiLlmBurstFromErrorResponse(res, body);
      const err = body as AIAgentDesignApiError;
      const msg = err.error || `HTTP ${res.status}`;
      const extra = err.rawSnippet ? ` — snippet: ${err.rawSnippet.slice(0, 200)}` : '';
      throw new Error(msg + extra);
    }
    const ok = body as { success: true; rule_text: string };
    if (typeof ok.rule_text !== 'string' || !ok.rule_text.trim()) {
      throw new Error('Risposta induce-style-rule non valida: rule_text mancante.');
    }
    return { rule_text: ok.rule_text.trim() };
  } finally {
    clearTimeout(timeout);
  }
}

export type { AnalyzeDebuggerTurnUseCaseResult };

export interface AnalyzeDebuggerTurnUseCaseApiParams {
  userTurn?: string;
  assistantTurn: string;
  agentUseCasesJson: string;
  globalStyleContract?: string;
  provider: string;
  model?: string;
  outputLanguage?: string;
}

/**
 * Debugger flow-mode: classify transcript vs catalog / suggest new scenario (POST /design/ai-agent-analyze-debug-turn).
 */
export async function analyzeDebuggerTurnUseCaseApi(
  params: AnalyzeDebuggerTurnUseCaseApiParams
): Promise<AnalyzeDebuggerTurnUseCaseResult> {
  const {
    userTurn,
    assistantTurn,
    agentUseCasesJson,
    globalStyleContract,
    provider,
    model,
    outputLanguage,
  } = params;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ANALYZE_DEBUG_TURN_TIMEOUT_MS);
  try {
    const bodyPayload: Record<string, unknown> = {
      assistantTurn: assistantTurn.trim(),
      agentUseCasesJson:
        typeof agentUseCasesJson === 'string' ? agentUseCasesJson : JSON.stringify(agentUseCasesJson ?? []),
      provider: provider.toLowerCase(),
    };
    if (typeof userTurn === 'string' && userTurn.length > 0) {
      bodyPayload.userTurn = userTurn;
    }
    if (typeof model === 'string' && model.trim().length > 0) {
      bodyPayload.model = model.trim();
    }
    if (typeof outputLanguage === 'string' && outputLanguage.trim().length > 0) {
      bodyPayload.outputLanguage = outputLanguage.trim();
    }
    if (typeof globalStyleContract === 'string' && globalStyleContract.trim().length > 0) {
      bodyPayload.globalStyleContract = globalStyleContract.trim();
    }
    const res = await designAiFetch('/design/ai-agent-analyze-debug-turn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(applyCallMetaToBody(bodyPayload, params.callMeta)),
      signal: controller.signal,
    });
    const body = (await parseDesignApiJsonResponse(res)) as
      | ({ success: true } & Record<string, unknown>)
      | AIAgentDesignApiError;
    if (!res.ok || !body || typeof body !== 'object' || !('success' in body) || !body.success) {
      emitDesignAiLlmBurstFromErrorResponse(res, body);
      const err = body as AIAgentDesignApiError;
      const msg = err.error || `HTTP ${res.status}`;
      const extra = err.rawSnippet ? ` — snippet: ${err.rawSnippet.slice(0, 200)}` : '';
      throw new Error(msg + extra);
    }
    const ok = body as { success: true } & Record<string, unknown>;
    const { success: _s, ...rest } = ok;
    return normalizeAnalyzeDebuggerTurnUseCaseResult(rest);
  } finally {
    clearTimeout(timeout);
  }
}

export interface GenerateAIAgentUseCasesParams {
  userDesc: string;
  provider: string;
  model: string;
  /** Runtime prompt / structured sections markdown for context. */
  runtimeContext?: string;
  outputLanguage?: string;
  globalStyleContract?: string;
  /** cortese | ironico | formale — persisted as style_id on each use case after normalize. */
  globalStyleId?: string;
  /**
   * Se valorizzato con lista non vuota, il backend genera **solo** nuovi use case da aggiungere
   * (evitando duplicati rispetto a questi).
   */
  extendFrom?: {
    logicalSteps: readonly AIAgentLogicalStep[];
    useCases: readonly AIAgentUseCase[];
  };
  /** Primo batch chunked: logical_steps + {@link USE_CASE_BUNDLE_CHUNK_SIZE} use case. */
  chunkInitial?: boolean;
  /** Extend in chunked pipeline (coverage_complete + batch size fissi). */
  chunkedExtend?: boolean;
  callMeta?: AiCallMeta;
}

export interface GenerateAIAgentUseCasesResult {
  logicalSteps: AIAgentLogicalStep[];
  useCases: AIAgentUseCase[];
  /** Nota dal pass di riordino narrativo (ordinamento indicativo, non rigido). */
  useCaseOrderingNote?: string;
  /** Extend chunked: il modello segnala che non restano scenari significativi da aggiungere. */
  coverageComplete?: boolean;
}

export interface ReorderAIAgentUseCasesParams {
  useCases: readonly AIAgentUseCase[];
  logicalSteps: readonly AIAgentLogicalStep[];
  provider: string;
  model: string;
  outputLanguage?: string;
  callMeta?: AiCallMeta;
}

/**
 * Design-time: generate logical_steps + use_cases bundle (POST /design/ai-agent-generate, action generate_use_cases).
 */
export async function generateAIAgentUseCases(
  params: GenerateAIAgentUseCasesParams
): Promise<GenerateAIAgentUseCasesResult> {
  const {
    userDesc,
    provider,
    model,
    runtimeContext,
    outputLanguage,
    globalStyleContract,
    globalStyleId,
    extendFrom,
    chunkInitial,
    chunkedExtend,
  } = params;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GENERATE_USE_CASES_TIMEOUT_MS);
  try {
    const extend =
      extendFrom &&
      Array.isArray(extendFrom.useCases) &&
      extendFrom.useCases.length > 0 &&
      Array.isArray(extendFrom.logicalSteps);

    const bodyPayload: Record<string, unknown> = {
      action: 'generate_use_cases',
      userDesc,
      provider: provider.toLowerCase(),
      model,
    };
    if (chunkInitial === true) {
      bodyPayload.chunkInitial = true;
    }
    if (extend) {
      bodyPayload.extendExisting = true;
      bodyPayload.existingUseCases = extendFrom!.useCases;
      bodyPayload.existingLogicalSteps = extendFrom!.logicalSteps;
      if (chunkedExtend === true) {
        bodyPayload.chunkedExtend = true;
      }
    }
    if (typeof runtimeContext === 'string' && runtimeContext.trim().length > 0) {
      bodyPayload.runtimeContext = runtimeContext.trim();
    }
    if (typeof outputLanguage === 'string' && outputLanguage.trim().length > 0) {
      bodyPayload.outputLanguage = outputLanguage.trim();
    }
    if (typeof globalStyleContract === 'string' && globalStyleContract.trim().length > 0) {
      bodyPayload.globalStyleContract = globalStyleContract.trim();
    }
    if (typeof globalStyleId === 'string' && globalStyleId.trim().length > 0) {
      bodyPayload.globalStyleId = globalStyleId.trim();
    }
    const res = await fetchAiAgentDesignAgentGenerate({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(applyCallMetaToBody(bodyPayload, params.callMeta)),
      signal: controller.signal,
    });
    const body = (await parseDesignApiJsonResponse(res)) as
      | {
          success: true;
          logical_steps?: unknown;
          use_cases: unknown;
          extend_mode?: boolean;
          coverage_complete?: boolean;
          use_case_ordering_note?: string;
        }
      | AIAgentDesignApiError;
    if (!res.ok || !body || typeof body !== 'object' || !('success' in body) || !body.success) {
      emitDesignAiLlmBurstFromErrorResponse(res, body);
      const err = body as AIAgentDesignApiError;
      const msg = err.error || `HTTP ${res.status}`;
      const extra = err.rawSnippet ? ` — snippet: ${err.rawSnippet.slice(0, 200)}` : '';
      throw new Error(msg + extra);
    }

    const useCases = parseAgentUseCasesFromApi(body.use_cases);
    const coverageComplete = body.coverage_complete === true;

    if (useCases.length === 0) {
      if (body.extend_mode === true && extendFrom && coverageComplete) {
        return {
          logicalSteps: [...extendFrom.logicalSteps],
          useCases: [],
          coverageComplete: true,
        };
      }
      throw new Error('Risposta use case non valida: use_cases vuoti dopo la normalizzazione.');
    }

    if (body.extend_mode === true && extendFrom) {
      return {
        logicalSteps: [...extendFrom.logicalSteps],
        useCases,
        coverageComplete,
      };
    }

    const logicalSteps = parseAgentLogicalStepsFromApi(body.logical_steps);
    if (logicalSteps.length === 0) {
      throw new Error('Risposta use case non valida: logical_steps vuoti dopo la normalizzazione.');
    }
    const useCaseOrderingNote =
      typeof body.use_case_ordering_note === 'string' && body.use_case_ordering_note.trim()
        ? body.use_case_ordering_note.trim()
        : undefined;
    return { logicalSteps, useCases, useCaseOrderingNote };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Narrative reorder pass after all chunks are merged (POST action reorder_use_cases_narratively).
 */
export async function reorderAIAgentUseCasesNarratively(
  params: ReorderAIAgentUseCasesParams
): Promise<Pick<GenerateAIAgentUseCasesResult, 'useCases' | 'useCaseOrderingNote'>> {
  const { useCases, logicalSteps, provider, model, outputLanguage } = params;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GENERATE_USE_CASES_TIMEOUT_MS);
  try {
    const bodyPayload: Record<string, unknown> = {
      action: 'reorder_use_cases_narratively',
      useCases,
      logicalSteps,
      provider: provider.toLowerCase(),
      model,
    };
    if (typeof outputLanguage === 'string' && outputLanguage.trim().length > 0) {
      bodyPayload.outputLanguage = outputLanguage.trim();
    }
    const res = await fetchAiAgentDesignAgentGenerate({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(applyCallMetaToBody(bodyPayload, params.callMeta)),
      signal: controller.signal,
    });
    const body = (await parseDesignApiJsonResponse(res)) as
      | {
          success: true;
          use_cases: unknown;
          use_case_ordering_note?: string;
        }
      | AIAgentDesignApiError;
    if (!res.ok || !body || typeof body !== 'object' || !('success' in body) || !body.success) {
      emitDesignAiLlmBurstFromErrorResponse(res, body);
      const err = body as AIAgentDesignApiError;
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const parsed = parseAgentUseCasesFromApi(body.use_cases);
    if (parsed.length === 0) {
      throw new Error('Risposta riordino non valida: use_cases vuoti.');
    }
    const useCaseOrderingNote =
      typeof body.use_case_ordering_note === 'string' && body.use_case_ordering_note.trim()
        ? body.use_case_ordering_note.trim()
        : undefined;
    return { useCases: parsed, useCaseOrderingNote };
  } finally {
    clearTimeout(timeout);
  }
}

export interface CategorizeAIAgentUseCasesParams {
  useCases: AIAgentUseCase[];
  logicalSteps: AIAgentLogicalStep[];
  provider: string;
  model: string;
  outputLanguage?: string;
  callMeta?: AiCallMeta;
}

export interface CategorizeAIAgentUseCasesResult {
  useCases: AIAgentUseCase[];
  categories: AIAgentUseCaseCategory[];
  useCaseCategorizationNote?: string;
}

/**
 * Assegna categorie tematiche e ordine logico dentro ogni categoria (POST categorize_use_cases).
 */
export async function categorizeAIAgentUseCases(
  params: CategorizeAIAgentUseCasesParams
): Promise<CategorizeAIAgentUseCasesResult> {
  const { useCases, logicalSteps, provider, model, outputLanguage } = params;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GENERATE_USE_CASES_TIMEOUT_MS);
  try {
    const bodyPayload: Record<string, unknown> = {
      action: 'categorize_use_cases',
      useCases,
      logicalSteps,
      provider: provider.toLowerCase(),
      model,
    };
    if (typeof outputLanguage === 'string' && outputLanguage.trim().length > 0) {
      bodyPayload.outputLanguage = outputLanguage.trim();
    }
    const res = await fetchAiAgentDesignAgentGenerate({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(applyCallMetaToBody(bodyPayload, params.callMeta)),
      signal: controller.signal,
    });
    const body = (await parseDesignApiJsonResponse(res)) as
      | {
          success: true;
          use_cases: unknown;
          categories: unknown;
          use_case_categorization_note?: string;
        }
      | AIAgentDesignApiError;
    if (!res.ok || !body || typeof body !== 'object' || !('success' in body) || !body.success) {
      emitDesignAiLlmBurstFromErrorResponse(res, body);
      const err = body as AIAgentDesignApiError;
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const parsed = parseAgentUseCasesFromApi(body.use_cases);
    if (parsed.length === 0) {
      throw new Error('Risposta categorizzazione non valida: use_cases vuoti.');
    }
    const categories = parseUseCaseCategoriesFromBundle(body.categories);
    const useCaseCategorizationNote =
      typeof body.use_case_categorization_note === 'string' &&
      body.use_case_categorization_note.trim()
        ? body.use_case_categorization_note.trim()
        : undefined;
    return { useCases: parsed, categories, useCaseCategorizationNote };
  } finally {
    clearTimeout(timeout);
  }
}

export interface GenerateUseCaseTestQuestionsParams {
  useCase: AIAgentUseCase;
  existingTestQuestions?: readonly UseCaseTestQuestion[];
  provider: string;
  model: string;
  outputLanguage?: string;
  callMeta?: AiCallMeta;
}

export type GeneratedUseCaseTestQuestionRow = {
  text: string;
  expectedAnswer: string;
  kind?: UseCaseTestQuestion['kind'];
};

/** Genera domande di test semantiche per un use case (append-only lato UI). */
export async function generateUseCaseTestQuestionsApi(
  params: GenerateUseCaseTestQuestionsParams
): Promise<{ test_questions: GeneratedUseCaseTestQuestionRow[] }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GENERATE_USE_CASES_TIMEOUT_MS);
  try {
    const bodyPayload: Record<string, unknown> = {
      action: 'generate_use_case_test_questions',
      useCase: params.useCase,
      existingTestQuestions: params.existingTestQuestions ?? [],
      provider: params.provider.toLowerCase(),
      model: params.model,
    };
    if (typeof params.outputLanguage === 'string' && params.outputLanguage.trim()) {
      bodyPayload.outputLanguage = params.outputLanguage.trim();
    }
    const res = await fetchAiAgentDesignAgentGenerate({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(applyCallMetaToBody(bodyPayload, params.callMeta)),
      signal: controller.signal,
    });
    const body = (await parseDesignApiJsonResponse(res)) as
      | {
          success: true;
          test_questions: unknown;
        }
      | AIAgentDesignApiError;
    if (!res.ok || !body || typeof body !== 'object' || !('success' in body) || !body.success) {
      emitDesignAiLlmBurstFromErrorResponse(res, body);
      const err = body as AIAgentDesignApiError;
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    if (!Array.isArray(body.test_questions) || body.test_questions.length === 0) {
      throw new Error('Risposta non valida: test_questions vuoto.');
    }
    const rows: GeneratedUseCaseTestQuestionRow[] = [];
    for (const row of body.test_questions) {
      if (!row || typeof row !== 'object') continue;
      const o = row as Record<string, unknown>;
      const text = typeof o.text === 'string' ? o.text.trim() : '';
      if (!text) continue;
      rows.push({
        text,
        expectedAnswer: typeof o.expectedAnswer === 'string' ? o.expectedAnswer : '',
        kind:
          o.kind === 'direct' ||
          o.kind === 'colloquial' ||
          o.kind === 'abbreviated' ||
          o.kind === 'ambiguous'
            ? o.kind
            : undefined,
      });
    }
    if (rows.length === 0) throw new Error('Risposta non valida: test_questions vuoto.');
    return { test_questions: rows };
  } finally {
    clearTimeout(timeout);
  }
}

export interface AnalyzeUseCaseOverlapApiParams {
  candidateUseCase: AIAgentUseCase;
  catalogUseCases: readonly AIAgentUseCase[];
  catalogNumberById: Record<string, number>;
  threshold: number;
  provider: string;
  model: string;
  callMeta?: AiCallMeta;
}

/** Analisi sovrapposizione singolo use case vs catalogo (design-time). */
export async function analyzeUseCaseOverlapApi(
  params: AnalyzeUseCaseOverlapApiParams
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const bodyPayload: Record<string, unknown> = {
      action: 'analyze_use_case_overlap',
      candidateUseCase: params.candidateUseCase,
      catalogUseCases: params.catalogUseCases,
      catalogNumberById: params.catalogNumberById,
      threshold: params.threshold,
      provider: params.provider.toLowerCase(),
      model: params.model,
    };
    const res = await fetchAiAgentDesignAgentGenerate({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        applyCallMetaToBody(
          { ...bodyPayload, purpose: AI_CALL_PURPOSE.USE_CASE_ANALYZE_OVERLAP },
          params.callMeta
        )
      ),
      signal: controller.signal,
    });
    const body = (await parseDesignApiJsonResponse(res)) as
      | ({ success: true } & Record<string, unknown>)
      | AIAgentDesignApiError;
    if (!res.ok || !body || typeof body !== 'object' || !('success' in body) || !body.success) {
      emitDesignAiLlmBurstFromErrorResponse(res, body);
      const err = body as AIAgentDesignApiError;
      throw new Error(err.error || `analyze_use_case_overlap failed (${res.status})`);
    }
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

export interface CheckUseCaseOverlapsApiParams {
  useCases: readonly AIAgentUseCase[];
  threshold: number;
  provider: string;
  model: string;
  callMeta?: AiCallMeta;
}

/** Verifica sovrapposizioni su tutto il catalogo use case (design-time). */
export async function checkUseCaseOverlapsApi(
  params: CheckUseCaseOverlapsApiParams
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const bodyPayload: Record<string, unknown> = {
      action: 'check_use_case_overlaps',
      useCases: params.useCases,
      threshold: params.threshold,
      provider: params.provider.toLowerCase(),
      model: params.model,
    };
    const res = await fetchAiAgentDesignAgentGenerate({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        applyCallMetaToBody(
          { ...bodyPayload, purpose: AI_CALL_PURPOSE.USE_CASE_CHECK_OVERLAPS },
          params.callMeta
        )
      ),
      signal: controller.signal,
    });
    const body = (await parseDesignApiJsonResponse(res)) as
      | ({ success: true } & Record<string, unknown>)
      | AIAgentDesignApiError;
    if (!res.ok || !body || typeof body !== 'object' || !('success' in body) || !body.success) {
      emitDesignAiLlmBurstFromErrorResponse(res, body);
      const err = body as AIAgentDesignApiError;
      throw new Error(err.error || `check_use_case_overlaps failed (${res.status})`);
    }
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

export interface BackendToolCompileContextWire {
  backendTaskId: string;
  toolName: string;
  receivePaths: string[];
  receivePathTree?: Record<string, unknown>;
  sendPaths: string[];
}

export interface ProposeCompileSlotMappingsApiParams {
  surfaces: readonly string[];
  phraseTokens?: readonly string[];
  receivePaths: readonly string[];
  receiveParamLeaves?: ReadonlyArray<{
    path: string;
    type?: string;
    format?: string;
    description?: string;
    suggestedSlotId?: string;
  }>;
  backendTaskId: string;
  backendToolContexts?: readonly BackendToolCompileContextWire[];
  sendParamLeaves?: ReadonlyArray<{
    path: string;
    type?: string;
    format?: string;
    description?: string;
    semanticRole?: string;
  }>;
  outputLanguage?: string;
  provider: string;
  model: string;
  callMeta?: AiCallMeta;
}

/** IA compile: surface letterali → slot_id + binding RECEIVE. */
export async function proposeCompileSlotMappingsApi(
  params: ProposeCompileSlotMappingsApiParams
): Promise<{
  lexicon_mappings: Array<{ surface: string; slot_id: string }>;
  backend_bindings: Array<{
    apiPath: string;
    slotId: string;
    tokenInPhrase: string;
    format?: string;
  }>;
  token_bindings: Array<{
    token: string;
    apiPath: string;
    slotId: string;
    format?: string;
  }>;
  slot_contracts: Array<{
    slotId: string;
    toolName: string;
    receive: string;
    send?: string[];
    format?: string;
    backendTaskId?: string;
  }>;
  send_hints?: Array<{
    surface: string;
    slotId: string;
    role: 'value' | 'constraint';
    sendPath: string;
    valueKind?: string;
    toolName?: string;
  }>;
}> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetchAiAgentDesignAgentGenerate({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        applyCallMetaToBody(
          {
            action: 'propose_compile_slot_mappings',
            surfaces: params.surfaces,
            phraseTokens: params.phraseTokens ?? [],
            receivePaths: params.receivePaths,
            receiveParamLeaves: params.receiveParamLeaves ?? [],
            backendTaskId: params.backendTaskId,
            backendToolContexts: params.backendToolContexts ?? [],
            sendParamLeaves: params.sendParamLeaves ?? [],
            outputLanguage: params.outputLanguage,
            provider: params.provider.toLowerCase(),
            model: params.model,
            purpose: AI_CALL_PURPOSE.USE_CASE_COMPILE_SLOT_MAPPING,
          },
          params.callMeta
        )
      ),
      signal: controller.signal,
    });
    const body = (await parseDesignApiJsonResponse(res)) as
      | ({
          success: true;
          lexicon_mappings?: unknown;
          backend_bindings?: unknown;
        } & Record<string, unknown>)
      | AIAgentDesignApiError;
    if (!res.ok || !body || typeof body !== 'object' || !('success' in body) || !body.success) {
      emitDesignAiLlmBurstFromErrorResponse(res, body);
      const err = body as AIAgentDesignApiError;
      throw new Error(err.error || `propose_compile_slot_mappings failed (${res.status})`);
    }
    return {
      lexicon_mappings: Array.isArray(body.lexicon_mappings)
        ? (body.lexicon_mappings as Array<{ surface: string; slot_id: string }>)
        : [],
      backend_bindings: Array.isArray(body.backend_bindings)
        ? (body.backend_bindings as Array<{
            apiPath: string;
            slotId: string;
            tokenInPhrase: string;
            format?: string;
          }>)
        : [],
      slot_contracts: Array.isArray(body.slot_contracts)
        ? (body.slot_contracts as Array<{
            slotId: string;
            toolName: string;
            receive: string;
            send?: string[];
            format?: string;
            backendTaskId?: string;
          }>)
        : [],
      token_bindings: Array.isArray(body.token_bindings)
        ? (body.token_bindings as Array<{
            token: string;
            apiPath: string;
            slotId: string;
            format?: string;
          }>)
        : [],
      send_hints: Array.isArray(body.send_hints)
        ? (body.send_hints as Array<{
            surface: string;
            slotId: string;
            role: 'value' | 'constraint';
            sendPath: string;
            valueKind?: string;
            toolName?: string;
          }>)
        : [],
    };
  } finally {
    clearTimeout(timeout);
  }
}

export interface RegenerateAIAgentUseCaseParams {
  useCase: AIAgentUseCase;
  allUseCases: AIAgentUseCase[];
  logicalSteps: AIAgentLogicalStep[];
  provider: string;
  model: string;
  outputLanguage?: string;
  globalStyleContract?: string;
  globalStyleId?: string;
  callMeta?: AiCallMeta;
}

/**
 * Regenerate one use case in place (same id expected).
 */
export async function regenerateAIAgentUseCaseApi(
  params: RegenerateAIAgentUseCaseParams
): Promise<AIAgentUseCase> {
  const {
    useCase,
    allUseCases,
    logicalSteps,
    provider,
    model,
    outputLanguage,
    globalStyleContract,
    globalStyleId,
  } = params;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const bodyPayload: Record<string, unknown> = {
      action: 'regenerate_use_case',
      useCase,
      allUseCases,
      logicalSteps,
      provider: provider.toLowerCase(),
      model,
    };
    if (typeof outputLanguage === 'string' && outputLanguage.trim().length > 0) {
      bodyPayload.outputLanguage = outputLanguage.trim();
    }
    if (typeof globalStyleContract === 'string' && globalStyleContract.trim().length > 0) {
      bodyPayload.globalStyleContract = globalStyleContract.trim();
    }
    if (typeof globalStyleId === 'string' && globalStyleId.trim().length > 0) {
      bodyPayload.globalStyleId = globalStyleId.trim();
    }
    const res = await fetchAiAgentDesignAgentGenerate({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(applyCallMetaToBody(bodyPayload, params.callMeta)),
      signal: controller.signal,
    });
    const body = (await parseDesignApiJsonResponse(res)) as { success: true; use_case: unknown } | AIAgentDesignApiError;
    if (!res.ok || !body || typeof body !== 'object' || !('success' in body) || !body.success) {
      emitDesignAiLlmBurstFromErrorResponse(res, body);
      const err = body as AIAgentDesignApiError;
      const msg = err.error || `HTTP ${res.status}`;
      const extra = err.rawSnippet ? ` — snippet: ${err.rawSnippet.slice(0, 200)}` : '';
      throw new Error(msg + extra);
    }
    const next = parseOneUseCaseFromApi(body.use_case);
    if (!next) {
      throw new Error('Risposta non valida: use_case mancante o non normalizzabile.');
    }
    return next;
  } finally {
    clearTimeout(timeout);
  }
}

export interface GeneralizeAIAgentUseCaseMetaParams {
  label: string;
  payoff: string;
  provider: string;
  model: string;
  outputLanguage?: string;
  globalStyleContract?: string;
  globalStyleId?: string;
  callMeta?: AiCallMeta;
}

export interface GeneralizeAIAgentUseCaseMetaResult {
  label: string;
  payoff: string;
}

/**
 * Generalizza titolo e scenario (payoff) con IA, senza modificare dialogue o altri campi.
 */
export async function generalizeAIAgentUseCaseMetaApi(
  params: GeneralizeAIAgentUseCaseMetaParams
): Promise<GeneralizeAIAgentUseCaseMetaResult> {
  const {
    label,
    payoff,
    provider,
    model,
    outputLanguage,
    globalStyleContract,
    globalStyleId,
  } = params;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const bodyPayload: Record<string, unknown> = {
      action: 'generalize_use_case_meta',
      label: String(label ?? ''),
      payoff: String(payoff ?? ''),
      provider: provider.toLowerCase(),
      model,
    };
    if (typeof outputLanguage === 'string' && outputLanguage.trim().length > 0) {
      bodyPayload.outputLanguage = outputLanguage.trim();
    }
    if (typeof globalStyleContract === 'string' && globalStyleContract.trim().length > 0) {
      bodyPayload.globalStyleContract = globalStyleContract.trim();
    }
    if (typeof globalStyleId === 'string' && globalStyleId.trim().length > 0) {
      bodyPayload.globalStyleId = globalStyleId.trim();
    }
    const res = await fetchAiAgentDesignAgentGenerate({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(applyCallMetaToBody(bodyPayload, params.callMeta)),
      signal: controller.signal,
    });
    const body = (await parseDesignApiJsonResponse(res)) as
      | { success: true; label: string; payoff: string }
      | AIAgentDesignApiError;
    if (!res.ok || !body || typeof body !== 'object' || !('success' in body) || !body.success) {
      emitDesignAiLlmBurstFromErrorResponse(res, body);
      const err = body as AIAgentDesignApiError;
      const msg = err.error || `HTTP ${res.status}`;
      const extra = err.rawSnippet ? ` — snippet: ${err.rawSnippet.slice(0, 200)}` : '';
      throw new Error(msg + extra);
    }
    const gl = typeof body.label === 'string' ? body.label.trim() : '';
    const gp = typeof body.payoff === 'string' ? body.payoff.trim() : '';
    if (!gl || !gp) {
      throw new Error('Risposta non valida: label o payoff mancanti.');
    }
    return { label: gl, payoff: gp };
  } finally {
    clearTimeout(timeout);
  }
}

export interface PolishUseCaseScenarioParams {
  scenarioText: string;
  provider: string;
  model: string;
  outputLanguage?: string;
  callMeta?: AiCallMeta;
}

/**
 * Rifinisce il testo scenario (forma/chiarezza) preservando il significato.
 */
export async function polishUseCaseScenarioApi(
  params: PolishUseCaseScenarioParams
): Promise<{ scenario_llm: string }> {
  const { scenarioText, provider, model, outputLanguage } = params;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const bodyPayload: Record<string, unknown> = {
      action: 'polish_use_case_scenario',
      scenarioText: String(scenarioText ?? ''),
      provider: provider.toLowerCase(),
      model,
    };
    if (typeof outputLanguage === 'string' && outputLanguage.trim().length > 0) {
      bodyPayload.outputLanguage = outputLanguage.trim();
    }
    const res = await fetchAiAgentDesignAgentGenerate({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(applyCallMetaToBody(bodyPayload, params.callMeta)),
      signal: controller.signal,
    });
    const body = (await parseDesignApiJsonResponse(res)) as
      | { success: true; scenario_llm: string; payoff?: string }
      | AIAgentDesignApiError;
    if (!res.ok || !body || typeof body !== 'object' || !('success' in body) || !body.success) {
      emitDesignAiLlmBurstFromErrorResponse(res, body);
      const err = body as AIAgentDesignApiError;
      const msg = err.error || `HTTP ${res.status}`;
      const extra = err.rawSnippet ? ` — snippet: ${err.rawSnippet.slice(0, 200)}` : '';
      throw new Error(msg + extra);
    }
    const text =
      typeof body.scenario_llm === 'string'
        ? body.scenario_llm.trim()
        : typeof body.payoff === 'string'
          ? body.payoff.trim()
          : '';
    if (!text) {
      throw new Error('Risposta non valida: scenario_llm mancante.');
    }
    return { scenario_llm: text };
  } finally {
    clearTimeout(timeout);
  }
}

export interface PolishDesignDescriptionParams {
  descriptionText: string;
  provider: string;
  model: string;
  outputLanguage?: string;
  callMeta?: AiCallMeta;
}

/**
 * Riformatta la descrizione task (paragrafi/elenco) preservando il significato.
 */
export async function polishDesignDescriptionApi(
  params: PolishDesignDescriptionParams
): Promise<{ design_description: string }> {
  const { descriptionText, provider, model, outputLanguage } = params;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const bodyPayload: Record<string, unknown> = {
      action: 'polish_design_description',
      descriptionText: String(descriptionText ?? ''),
      provider: provider.toLowerCase(),
      model,
    };
    if (typeof outputLanguage === 'string' && outputLanguage.trim().length > 0) {
      bodyPayload.outputLanguage = outputLanguage.trim();
    }
    const res = await fetchAiAgentDesignAgentGenerate({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(applyCallMetaToBody(bodyPayload, params.callMeta)),
      signal: controller.signal,
    });
    const body = (await parseDesignApiJsonResponse(res)) as
      | { success: true; design_description: string }
      | AIAgentDesignApiError;
    if (!res.ok || !body || typeof body !== 'object' || !('success' in body) || !body.success) {
      emitDesignAiLlmBurstFromErrorResponse(res, body);
      const err = body as AIAgentDesignApiError;
      const msg = err.error || `HTTP ${res.status}`;
      const extra = err.rawSnippet ? ` — snippet: ${err.rawSnippet.slice(0, 200)}` : '';
      throw new Error(msg + extra);
    }
    const text =
      typeof body.design_description === 'string' ? body.design_description.trim() : '';
    if (!text) {
      throw new Error('Risposta non valida: design_description mancante.');
    }
    return { design_description: text };
  } finally {
    clearTimeout(timeout);
  }
}

export interface CreateAIAgentUseCaseParams {
  useCase: AIAgentUseCase;
  allUseCases: AIAgentUseCase[];
  logicalSteps: AIAgentLogicalStep[];
  provider: string;
  model: string;
  outputLanguage?: string;
  globalStyleContract?: string;
  globalStyleId?: string;
  callMeta?: AiCallMeta;
}

/**
 * Create one new use case and auto-generate dialogue from context.
 */
export interface SplitRootUseCaseDraftParams {
  draftText: string;
  allUseCases: readonly AIAgentUseCase[];
  provider: string;
  model: string;
  outputLanguage?: string;
  callMeta?: AiCallMeta;
}

/**
 * LLM decides 1..N root use case draft labels from free text (semantic split, not punctuation).
 */
export async function splitRootUseCaseDraftApi(
  params: SplitRootUseCaseDraftParams
): Promise<{ labels: string[]; startLabelIndex: number | null }> {
  const { draftText, allUseCases, provider, model, outputLanguage } = params;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const bodyPayload: Record<string, unknown> = {
      action: 'split_root_use_case_draft',
      draftText,
      allUseCases,
      provider: provider.toLowerCase(),
      model,
    };
    if (typeof outputLanguage === 'string' && outputLanguage.trim().length > 0) {
      bodyPayload.outputLanguage = outputLanguage.trim();
    }
    const res = await fetchAiAgentDesignAgentGenerate({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(applyCallMetaToBody(bodyPayload, params.callMeta)),
      signal: controller.signal,
    });
    const body = (await parseDesignApiJsonResponse(res)) as
      | { success: true; labels: unknown; startLabelIndex?: unknown }
      | AIAgentDesignApiError;
    if (!res.ok || !body || typeof body !== 'object' || !('success' in body) || !body.success) {
      emitDesignAiLlmBurstFromErrorResponse(res, body);
      const err = body as AIAgentDesignApiError;
      const msg = err.error || `HTTP ${res.status}`;
      const extra = err.rawSnippet ? ` — snippet: ${err.rawSnippet.slice(0, 200)}` : '';
      throw new Error(msg + extra);
    }
    const raw = body.labels;
    if (!Array.isArray(raw)) {
      throw new Error('Risposta non valida: labels mancante.');
    }
    const labels = raw
      .map((x) => (typeof x === 'string' ? x.trim() : ''))
      .filter((x) => x.length > 0);
    if (labels.length === 0) {
      throw new Error('Risposta non valida: labels vuoto.');
    }
    let startLabelIndex: number | null = null;
    if (body.startLabelIndex === null) {
      startLabelIndex = null;
    } else if (
      typeof body.startLabelIndex === 'number' &&
      Number.isInteger(body.startLabelIndex)
    ) {
      startLabelIndex = body.startLabelIndex;
    }
    if (
      startLabelIndex !== null &&
      (startLabelIndex < 0 || startLabelIndex >= labels.length)
    ) {
      startLabelIndex = null;
    }
    return { labels, startLabelIndex };
  } finally {
    clearTimeout(timeout);
  }
}

export async function createAIAgentUseCaseApi(
  params: CreateAIAgentUseCaseParams
): Promise<AIAgentUseCase> {
  const {
    useCase,
    allUseCases,
    logicalSteps,
    provider,
    model,
    outputLanguage,
    globalStyleContract,
    globalStyleId,
  } = params;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const bodyPayload: Record<string, unknown> = {
      action: 'create_use_case',
      useCase,
      allUseCases,
      logicalSteps,
      provider: provider.toLowerCase(),
      model,
    };
    if (typeof outputLanguage === 'string' && outputLanguage.trim().length > 0) {
      bodyPayload.outputLanguage = outputLanguage.trim();
    }
    if (typeof globalStyleContract === 'string' && globalStyleContract.trim().length > 0) {
      bodyPayload.globalStyleContract = globalStyleContract.trim();
    }
    if (typeof globalStyleId === 'string' && globalStyleId.trim().length > 0) {
      bodyPayload.globalStyleId = globalStyleId.trim();
    }
    const res = await fetchAiAgentDesignAgentGenerate({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(applyCallMetaToBody(bodyPayload, params.callMeta)),
      signal: controller.signal,
    });
    const body = (await parseDesignApiJsonResponse(res)) as { success: true; use_case: unknown } | AIAgentDesignApiError;
    if (!res.ok || !body || typeof body !== 'object' || !('success' in body) || !body.success) {
      emitDesignAiLlmBurstFromErrorResponse(res, body);
      const err = body as AIAgentDesignApiError;
      const msg = err.error || `HTTP ${res.status}`;
      const extra = err.rawSnippet ? ` — snippet: ${err.rawSnippet.slice(0, 200)}` : '';
      throw new Error(msg + extra);
    }
    const next = parseOneUseCaseFromApi(body.use_case);
    if (!next) {
      throw new Error('Risposta non valida: use_case mancante o non normalizzabile.');
    }
    return next;
  } finally {
    clearTimeout(timeout);
  }
}

const PROPAGATE_EXAMPLE_PHRASE_STYLE_TIMEOUT_MS = 300000;

export interface PropagateExamplePhraseStyleParams {
  allUseCases: readonly AIAgentUseCase[];
  logicalSteps: readonly AIAgentLogicalStep[];
  styleExampleUseCaseIds: string[];
  targetUseCaseIds: string[];
  provider: string;
  model: string;
  outputLanguage?: string;
  globalStyleContract?: string;
  globalStyleId?: string;
  callMeta?: AiCallMeta;
}

export interface PropagateExamplePhraseStyleResult {
  updates: { use_case_id: string; assistant_content: string }[];
}

/**
 * Passo 2 wizard: riscrivi le frasi esempio ancora alla baseline imitando quelle modificate dall’utente.
 */
export async function propagateExamplePhraseStyleApi(
  params: PropagateExamplePhraseStyleParams
): Promise<PropagateExamplePhraseStyleResult> {
  const {
    allUseCases,
    logicalSteps,
    styleExampleUseCaseIds,
    targetUseCaseIds,
    provider,
    model,
    outputLanguage,
    globalStyleContract,
    globalStyleId,
  } = params;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROPAGATE_EXAMPLE_PHRASE_STYLE_TIMEOUT_MS);
  try {
    const bodyPayload: Record<string, unknown> = {
      action: 'propagate_example_phrase_style',
      allUseCases: [...allUseCases],
      logicalSteps: [...logicalSteps],
      styleExampleUseCaseIds,
      targetUseCaseIds,
      provider: provider.toLowerCase(),
      model,
    };
    if (typeof outputLanguage === 'string' && outputLanguage.trim().length > 0) {
      bodyPayload.outputLanguage = outputLanguage.trim();
    }
    if (typeof globalStyleContract === 'string' && globalStyleContract.trim().length > 0) {
      bodyPayload.globalStyleContract = globalStyleContract.trim();
    }
    if (typeof globalStyleId === 'string' && globalStyleId.trim().length > 0) {
      bodyPayload.globalStyleId = globalStyleId.trim();
    }
    const res = await fetchAiAgentDesignAgentGenerate({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(applyCallMetaToBody(bodyPayload, params.callMeta)),
      signal: controller.signal,
    });
    const body = (await parseDesignApiJsonResponse(res)) as
      | { success: true; updates: unknown }
      | AIAgentDesignApiError;
    if (!res.ok || !body || typeof body !== 'object' || !('success' in body) || !body.success) {
      emitDesignAiLlmBurstFromErrorResponse(res, body);
      const err = body as AIAgentDesignApiError;
      const msg = err.error || `HTTP ${res.status}`;
      const extra = err.rawSnippet ? ` — snippet: ${err.rawSnippet.slice(0, 200)}` : '';
      throw new Error(msg + extra);
    }
    const rawUpdates = (body as { updates?: unknown }).updates;
    if (!Array.isArray(rawUpdates)) {
      throw new Error('Risposta non valida: updates mancante.');
    }
    const updates: PropagateExamplePhraseStyleResult['updates'] = [];
    for (const row of rawUpdates) {
      if (!row || typeof row !== 'object') continue;
      const o = row as Record<string, unknown>;
      const id =
        typeof o.use_case_id === 'string'
          ? o.use_case_id.trim()
          : typeof o.useCaseId === 'string'
            ? o.useCaseId.trim()
            : '';
      const assistant_content =
        typeof o.assistant_content === 'string'
          ? o.assistant_content.trim()
          : typeof o.assistantContent === 'string'
            ? o.assistantContent.trim()
            : '';
      if (id && assistant_content) updates.push({ use_case_id: id, assistant_content });
    }
    if (updates.length === 0) {
      throw new Error('Risposta non valida: nessun aggiornamento.');
    }
    return { updates };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * `Completa correzione` (toolbar wizard): propagazione directional dello stile.
 *
 * Differenze chiave rispetto a {@link propagateExamplePhraseStyleApi} (legacy callout
 * `ExamplePhraseStyleCallout`, in via di rimozione):
 *  - input = coppie esplicite `original → modified` per gli esempi (la "direzione del
 *    cambiamento" è esplicita per il modello, non implicita nel solo `modified`);
 *  - target = `original` testo dell'attuale baseline IA (il modello riscrive QUEL
 *    testo applicando la stessa trasformazione, non genera ex-novo da scenario);
 *  - output = `{ useCaseId, newAssistantContent, isNew }` — `isNew=true` permette al
 *    client di applicare il marker visivo `[NEW]` finché l'utente non vota / consolida.
 */
const PROPAGATE_CORRECTION_STYLE_TIMEOUT_MS = 300000;

export interface PropagateCorrectionStyleParams {
  /** Coppie ORIGINAL→MODIFIED dagli use case sostanzialmente modificati dall'utente. */
  directionalExamples: ReadonlyArray<{
    useCaseId: string;
    useCaseLabel: string;
    original: string;
    modified: string;
  }>;
  /** Use case ancora alla baseline IA: il modello riscriverà `original` applicando la stessa trasformazione. */
  directionalTargets: ReadonlyArray<{
    useCaseId: string;
    useCaseLabel: string;
    original: string;
  }>;
  provider: string;
  model: string;
  outputLanguage?: string;
  globalStyleContract?: string;
  callMeta?: AiCallMeta;
}

export interface PropagateCorrectionStyleResult {
  updates: ReadonlyArray<{ useCaseId: string; newAssistantContent: string; isNew: true }>;
  /** Sintesi stile opzionale restituita dal modello (merge lato backend). */
  styleSynthesis?: string;
}

function parseStyleSynthesisFromPropagateBody(body: Record<string, unknown>): string | undefined {
  const raw = body.styleSynthesis ?? body.style_synthesis;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : undefined;
}

function parsePropagateCorrectionStyleUpdates(
  rawUpdates: unknown
): Array<{ useCaseId: string; newAssistantContent: string; isNew: true }> {
  if (!Array.isArray(rawUpdates)) return [];
  const updates: Array<{ useCaseId: string; newAssistantContent: string; isNew: true }> = [];
  for (const row of rawUpdates) {
    if (!row || typeof row !== 'object') continue;
    const o = row as Record<string, unknown>;
    const useCaseId =
      typeof o.useCaseId === 'string'
        ? o.useCaseId.trim()
        : typeof o.use_case_id === 'string'
          ? o.use_case_id.trim()
          : '';
    const newAssistantContent =
      typeof o.newAssistantContent === 'string'
        ? o.newAssistantContent.trim()
        : typeof o.new_assistant_content === 'string'
          ? o.new_assistant_content.trim()
          : '';
    if (useCaseId && newAssistantContent) {
      updates.push({ useCaseId, newAssistantContent, isNew: true });
    }
  }
  return updates;
}

export async function propagateCorrectionStyleApi(
  params: PropagateCorrectionStyleParams
): Promise<PropagateCorrectionStyleResult> {
  const {
    directionalExamples,
    directionalTargets,
    provider,
    model,
    outputLanguage,
    globalStyleContract,
  } = params;
  if (directionalExamples.length === 0) {
    throw new Error('Servono esempi directional (original→modified) non vuoti.');
  }
  if (directionalTargets.length === 0) {
    throw new Error('Servono target da rigenerare.');
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROPAGATE_CORRECTION_STYLE_TIMEOUT_MS);
  try {
    const bodyPayload: Record<string, unknown> = {
      action: 'propagate_correction_style',
      directionalExamples: [...directionalExamples],
      directionalTargets: [...directionalTargets],
      provider: provider.toLowerCase(),
      model,
    };
    if (typeof outputLanguage === 'string' && outputLanguage.trim().length > 0) {
      bodyPayload.outputLanguage = outputLanguage.trim();
    }
    if (typeof globalStyleContract === 'string' && globalStyleContract.trim().length > 0) {
      bodyPayload.globalStyleContract = globalStyleContract.trim();
    }
    const res = await fetchAiAgentDesignAgentGenerate({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(applyCallMetaToBody(bodyPayload, params.callMeta)),
      signal: controller.signal,
    });
    const body = (await parseDesignApiJsonResponse(res)) as
      | { success: true; updates: unknown }
      | AIAgentDesignApiError;
    if (!res.ok || !body || typeof body !== 'object' || !('success' in body) || !body.success) {
      emitDesignAiLlmBurstFromErrorResponse(res, body);
      const err = body as AIAgentDesignApiError;
      const msg = err.error || `HTTP ${res.status}`;
      const extra = err.rawSnippet ? ` — snippet: ${err.rawSnippet.slice(0, 200)}` : '';
      throw new Error(msg + extra);
    }
    const okBody = body as { success: true; updates?: unknown } & Record<string, unknown>;
    const rawUpdates = okBody.updates;
    if (!Array.isArray(rawUpdates)) {
      throw new Error('Risposta non valida: updates mancante.');
    }
    const updates = parsePropagateCorrectionStyleUpdates(rawUpdates);
    if (updates.length === 0) {
      throw new Error('Risposta non valida: nessun aggiornamento utile.');
    }
    const styleSynthesis = parseStyleSynthesisFromPropagateBody(okBody);
    return { updates, ...(styleSynthesis !== undefined ? { styleSynthesis } : {}) };
  } finally {
    clearTimeout(timeout);
  }
}

export type PropagateCorrectionStylePreviewParams = PropagateCorrectionStyleParams & {
  maxPreviewTargets?: number;
  signal?: AbortSignal;
};

export type PropagateCorrectionStylePreviewResult = PropagateCorrectionStyleResult;

function mergeAbortSignals(signals: readonly AbortSignal[]): AbortSignal {
  const merged = new AbortController();
  for (const s of signals) {
    if (s.aborted) {
      merged.abort();
      return merged.signal;
    }
    s.addEventListener('abort', () => merged.abort(), { once: true });
  }
  return merged.signal;
}

/**
 * Anteprima «Completa correzione»: stessa semantica di {@link propagateCorrectionStyleApi} ma
 * action `propagate_correction_style_preview` (target limitati lato server, costo ridotto).
 */
export async function propagateCorrectionStylePreviewApi(
  params: PropagateCorrectionStylePreviewParams
): Promise<PropagateCorrectionStylePreviewResult> {
  const {
    directionalExamples,
    directionalTargets,
    provider,
    model,
    outputLanguage,
    globalStyleContract,
    maxPreviewTargets = 3,
    signal: externalSignal,
  } = params;
  if (directionalExamples.length === 0) {
    throw new Error('Servono esempi directional (original→modified) non vuoti.');
  }
  if (directionalTargets.length === 0) {
    throw new Error('Servono target da rigenerare.');
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROPAGATE_CORRECTION_STYLE_TIMEOUT_MS);
  const combinedSignal = mergeAbortSignals(
    externalSignal !== undefined ? [controller.signal, externalSignal] : [controller.signal]
  );
  try {
    const bodyPayload: Record<string, unknown> = {
      action: 'propagate_correction_style_preview',
      directionalExamples: [...directionalExamples],
      directionalTargets: [...directionalTargets],
      provider: provider.toLowerCase(),
      model,
      maxPreviewTargets,
    };
    if (typeof outputLanguage === 'string' && outputLanguage.trim().length > 0) {
      bodyPayload.outputLanguage = outputLanguage.trim();
    }
    if (typeof globalStyleContract === 'string' && globalStyleContract.trim().length > 0) {
      bodyPayload.globalStyleContract = globalStyleContract.trim();
    }
    const res = await fetchAiAgentDesignAgentGenerate({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(applyCallMetaToBody(bodyPayload, params.callMeta)),
      signal: combinedSignal,
    });
    const body = (await parseDesignApiJsonResponse(res)) as
      | ({ success: true } & Record<string, unknown>)
      | AIAgentDesignApiError;
    if (!res.ok || !body || typeof body !== 'object' || !('success' in body) || !body.success) {
      emitDesignAiLlmBurstFromErrorResponse(res, body);
      const err = body as AIAgentDesignApiError;
      const msg = err.error || `HTTP ${res.status}`;
      const extra = err.rawSnippet ? ` — snippet: ${err.rawSnippet.slice(0, 200)}` : '';
      throw new Error(msg + extra);
    }
    const okBody = body as { success: true; updates?: unknown } & Record<string, unknown>;
    const updates = parsePropagateCorrectionStyleUpdates(okBody.updates);
    const styleSynthesis = parseStyleSynthesisFromPropagateBody(okBody);
    return { updates, ...(styleSynthesis !== undefined ? { styleSynthesis } : {}) };
  } finally {
    clearTimeout(timeout);
  }
}

export interface RegenerateAIAgentUseCaseTurnParams {
  useCase: AIAgentUseCase;
  turnId: string;
  provider: string;
  model: string;
  outputLanguage?: string;
  callMeta?: AiCallMeta;
}

export async function regenerateAIAgentUseCaseTurnApi(
  params: RegenerateAIAgentUseCaseTurnParams
): Promise<AIAgentUseCaseTurn> {
  const { useCase, turnId, provider, model, outputLanguage } = params;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const bodyPayload: Record<string, unknown> = {
      action: 'regenerate_turn',
      useCase,
      turnId,
      provider: provider.toLowerCase(),
      model,
    };
    if (typeof outputLanguage === 'string' && outputLanguage.trim().length > 0) {
      bodyPayload.outputLanguage = outputLanguage.trim();
    }
    const res = await fetchAiAgentDesignAgentGenerate({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(applyCallMetaToBody(bodyPayload, params.callMeta)),
      signal: controller.signal,
    });
    const body = (await parseDesignApiJsonResponse(res)) as { success: true; turn: unknown } | AIAgentDesignApiError;
    if (!res.ok || !body || typeof body !== 'object' || !('success' in body) || !body.success) {
      emitDesignAiLlmBurstFromErrorResponse(res, body);
      const err = body as AIAgentDesignApiError;
      const msg = err.error || `HTTP ${res.status}`;
      const extra = err.rawSnippet ? ` — snippet: ${err.rawSnippet.slice(0, 200)}` : '';
      throw new Error(msg + extra);
    }
    const turn = parseAgentUseCaseTurnFromApi(body.turn);
    if (!turn) {
      throw new Error('Risposta non valida: turn mancante o non normalizzabile.');
    }
    return turn;
  } finally {
    clearTimeout(timeout);
  }
}

export interface AnnotateAIAgentAssistantMessageForJsonParams {
  useCase: AIAgentUseCase;
  turnId: string;
  provider: string;
  model: string;
  outputLanguage?: string;
  globalStyleContract?: string;
  /**
   * Testo corrente dell’editor (obbligatorio se incollato/… non ancora nello `useCase` serializzato).
   * Il backend allinea prompt e `use case` JSON così il modello non segue un dialogo obsoleto.
   */
  assistantMessageText?: string;
  callMeta?: AiCallMeta;
}

export interface AnnotateAIAgentAssistantMessageForJsonResult {
  content: string;
  motor: AgentMessageMotorPayload;
}

/**
 * LLM annotates assistant text with [slot] tokens and returns structured motor JSON (groups, segments).
 */
export async function annotateAIAgentAssistantMessageForJsonApi(
  params: AnnotateAIAgentAssistantMessageForJsonParams
): Promise<AnnotateAIAgentAssistantMessageForJsonResult> {
  const { useCase, turnId, provider, model, outputLanguage, globalStyleContract, assistantMessageText } = params;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const bodyPayload: Record<string, unknown> = {
      action: 'annotate_assistant_message_for_json',
      useCase,
      turnId,
      provider: provider.toLowerCase(),
      model,
    };
    if (typeof outputLanguage === 'string' && outputLanguage.trim().length > 0) {
      bodyPayload.outputLanguage = outputLanguage.trim();
    }
    if (typeof globalStyleContract === 'string' && globalStyleContract.trim().length > 0) {
      bodyPayload.globalStyleContract = globalStyleContract.trim();
    }
    if (typeof assistantMessageText === 'string') {
      bodyPayload.assistantMessageText = assistantMessageText;
    }
    const res = await fetchAiAgentDesignAgentGenerate({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(applyCallMetaToBody(bodyPayload, params.callMeta)),
      signal: controller.signal,
    });
    const body = (await parseDesignApiJsonResponse(res)) as
      | { success: true; content: string; motor: AgentMessageMotorPayload }
      | AIAgentDesignApiError;
    if (!res.ok || !body || typeof body !== 'object' || !('success' in body) || !body.success) {
      emitDesignAiLlmBurstFromErrorResponse(res, body);
      const err = body as AIAgentDesignApiError;
      const msg = err.error || `HTTP ${res.status}`;
      const extra = err.rawSnippet ? ` — snippet: ${err.rawSnippet.slice(0, 200)}` : '';
      throw new Error(msg + extra);
    }
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    if (!content) {
      throw new Error('Risposta non valida: content vuoto.');
    }
    if (!body.motor || typeof body.motor !== 'object') {
      throw new Error('Risposta non valida: motor mancante.');
    }
    return { content, motor: body.motor };
  } finally {
    clearTimeout(timeout);
  }
}

const STYLE_PHRASE_GENERATE_TIMEOUT_MS = 120000;

export interface GenerateStylePhrasePolishParams {
  template: string;
  styleTokens: readonly { styleTokenId: string; defaultSurface: string; variants: string[] }[];
  candidatePhrases: readonly string[];
  provider: string;
  model: string;
  outputLanguage?: string;
  callMeta?: AiCallMeta;
}

export async function generateStylePhrasePolishApi(
  params: GenerateStylePhrasePolishParams
): Promise<string[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), STYLE_PHRASE_GENERATE_TIMEOUT_MS);
  try {
    const res = await fetchAiAgentDesignAgentGenerate({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        applyCallMetaToBody(
          {
            action: 'generate_style_phrase_polish',
            template: params.template,
            styleTokens: params.styleTokens,
            candidatePhrases: params.candidatePhrases,
            provider: params.provider.toLowerCase(),
            model: params.model,
            ...(params.outputLanguage?.trim() ? { outputLanguage: params.outputLanguage.trim() } : {}),
          },
          params.callMeta
        )
      ),
      signal: controller.signal,
    });
    const body = (await parseDesignApiJsonResponse(res)) as
      | { success: true; phrases: string[] }
      | AIAgentDesignApiError;
    if (!res.ok || !body || typeof body !== 'object' || !('success' in body) || !body.success) {
      emitDesignAiLlmBurstFromErrorResponse(res, body);
      const err = body as AIAgentDesignApiError;
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return Array.isArray(body.phrases) ? body.phrases.map((p) => String(p).trim()).filter(Boolean) : [];
  } finally {
    clearTimeout(timeout);
  }
}

export interface GenerateStylePhraseCreativeParams {
  template: string;
  styleTokens: readonly { styleTokenId: string; defaultSurface: string; variants: string[] }[];
  existingPlainPhrases: readonly string[];
  maxPhrases?: number;
  provider: string;
  model: string;
  outputLanguage?: string;
  callMeta?: AiCallMeta;
}

export async function generateStylePhraseCreativeApi(
  params: GenerateStylePhraseCreativeParams
): Promise<string[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), STYLE_PHRASE_GENERATE_TIMEOUT_MS);
  try {
    const res = await fetchAiAgentDesignAgentGenerate({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        applyCallMetaToBody(
          {
            action: 'generate_style_phrase_creative',
            template: params.template,
            styleTokens: params.styleTokens,
            existingPlainPhrases: params.existingPlainPhrases,
            maxPhrases: params.maxPhrases ?? 10,
            provider: params.provider.toLowerCase(),
            model: params.model,
            ...(params.outputLanguage?.trim() ? { outputLanguage: params.outputLanguage.trim() } : {}),
          },
          params.callMeta
        )
      ),
      signal: controller.signal,
    });
    const body = (await parseDesignApiJsonResponse(res)) as
      | { success: true; phrases: string[] }
      | AIAgentDesignApiError;
    if (!res.ok || !body || typeof body !== 'object' || !('success' in body) || !body.success) {
      emitDesignAiLlmBurstFromErrorResponse(res, body);
      const err = body as AIAgentDesignApiError;
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return Array.isArray(body.phrases) ? body.phrases.map((p) => String(p).trim()).filter(Boolean) : [];
  } finally {
    clearTimeout(timeout);
  }
}

const ASSEMBLE_CONVERSATION_TIMEOUT_MS = 300000;
const PROOFREAD_CONVERSATION_TIMEOUT_MS = 240000;
const TOKENIZE_USE_CASES_TIMEOUT_MS = 240000;

export interface AssembleAIAgentConversationParams {
  useCases: readonly AIAgentUseCase[];
  runtimeContext?: string;
  outputLanguage?: string;
  globalStyleContract?: string;
  /** Conteggio conversazioni già montate: aiuta l'AI a variare il mix (passato come hint). */
  previousConversationsCount?: number;
  /** Outcome richiesto dal designer dalla toolbar (radio Positiva/Negativa). */
  outcome: UseCaseGeneratorWizardConversationOutcome;
  /** Checkbox toolbar: permette al modello di proporre AL MASSIMO 1 use case emergente (`suggested:xxx`). */
  allowSuggestedUseCases?: boolean;
  provider: string;
  model: string;
  callMeta?: AiCallMeta;
  /**
   * **DEPRECATED**: usato dalla v1 del gate (singolo esempio testuale). Mantenuto per
   * backward-compat; le call v2 usano `stylePayload`.
   */
  stylePromptHint?: string;
  /**
   * **v2 multi-stile**: payload completo dello stile target di QUESTA chiamata.
   *
   * Una conversazione = uno styleId. Per generare N conversazioni in N stili diversi
   * il chiamante invoca `assembleAIAgentConversationApi` N volte (o in `Promise.all`),
   * variando solo `stylePayload`. Il backend restituirà la conversazione con `style_id`
   * coerente al payload (così il client può taggarla senza ulteriore round-trip).
   *
   * Semantica:
   * - `id` → identifica lo stile (es. `cortese`); diventa `conversation.styleId`.
   * - `description` → registro/tono; sempre incluso nel prompt.
   * - `example` → esempi di dialogo nello stile; incluso solo se non vuoto E `auto=false`.
   * - `auto` → quando true il prompt istruisce l'AI a inventare frasi nello stile descritto
   *   (esempi opzionali / ignorati).
   */
  stylePayload?: {
    readonly id: string;
    readonly description: string;
    readonly example: string;
    readonly auto: boolean;
  };
}

function newClientConversationId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? `conv-${crypto.randomUUID()}`
    : `conv-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function newClientTurnId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? `ct-${crypto.randomUUID()}`
    : `ct-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function parseSuggestionFromApi(raw: unknown): UseCaseGeneratorWizardTurnSuggestion | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const status =
    o.status === 'pending' || o.status === 'promoted' || o.status === 'rejected' ? o.status : null;
  if (!status) return null;
  const proposedLabel = typeof o.proposedLabel === 'string' ? o.proposedLabel : '';
  return { status, proposedLabel };
}

function parseConversationTurnFromApi(raw: unknown): UseCaseGeneratorWizardTurn | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const role = o.role === 'agent' ? 'agent' : o.role === 'user' ? 'user' : null;
  if (!role) return null;
  /**
   * `turnId` rigenerato lato client per evitare collisioni se il modello LLM riusa sempre gli stessi id
   * (`t1`, `t2`, …) tra chiamate diverse: con più conversazioni montate, la chiave baseline
   * `${conversationId}::${turnId}` deve essere globalmente univoca.
   */
  const turnId = newClientTurnId();
  const text = typeof o.text === 'string' ? o.text : '';
  if (role === 'user') {
    const u: UseCaseGeneratorWizardTurnUser = { turnId, role: 'user', text };
    return u;
  }
  const useCaseId = typeof o.useCaseId === 'string' ? o.useCaseId : '';
  const useCaseLabel = typeof o.useCaseLabel === 'string' ? o.useCaseLabel : '';
  if (!useCaseId) return null;
  const suggestionParsed = parseSuggestionFromApi(o.suggestion);
  /**
   * Coerenza: se l'id è `suggested:*` ma manca il campo `suggestion`, sintetizziamo lo stato
   * `pending`. Se invece l'id è reale ma il backend ha incluso un campo `suggestion`, lo ignoriamo
   * (state inconsistente — la pillola lampadina vale solo per use case emergenti).
   */
  const suggestion =
    suggestionParsed ??
    (isSuggestedUseCaseId(useCaseId)
      ? { status: 'pending' as const, proposedLabel: useCaseLabel }
      : undefined);
  const a: UseCaseGeneratorWizardTurnAgent = {
    turnId,
    role: 'agent',
    useCaseId,
    useCaseLabel,
    text,
    ...(suggestion ? { suggestion } : {}),
  };
  return a;
}

function parseConversationFromApi(
  raw: unknown,
  context: {
    outcome: UseCaseGeneratorWizardConversationOutcome;
    allowsSuggestedUseCases: boolean;
  }
): UseCaseGeneratorWizardConversation | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  /**
   * `conversationId` SEMPRE rigenerato lato client. Il modello LLM tende a restituire id deterministici
   * (es. `conv_1`) tra chiamate diverse — usarlo come identità causerebbe collisioni che il check di
   * `appendConversation` farebbe rilevare come "già presente". L'id del modello è quindi puramente
   * decorativo e qui ignorato.
   */
  const conversationId = newClientConversationId();
  const turnsIn = Array.isArray(o.turns) ? o.turns : [];
  const turns: UseCaseGeneratorWizardTurn[] = [];
  for (const t of turnsIn) {
    const parsed = parseConversationTurnFromApi(t);
    if (parsed) turns.push(parsed);
  }
  if (turns.length < 2) return null;
  /**
   * Scenario summary opzionale: 1–2 frasi prodotte dall'LLM per orientare il designer.
   * Tolleranti su tipi non-string (fallback omesso). Slice di sicurezza a 400 char
   * (il backend già taglia, qui è una difesa in profondità).
   */
  const rawSummary = typeof o.scenarioSummary === 'string' ? o.scenarioSummary.trim() : '';
  const scenarioSummary = rawSummary ? rawSummary.slice(0, 400) : undefined;
  return {
    conversationId,
    turns,
    outcome: context.outcome,
    allowsSuggestedUseCases: context.allowsSuggestedUseCases,
    ...(scenarioSummary ? { scenarioSummary } : {}),
  };
}

/**
 * Passo 2 wizard: monta una conversazione simulata mescolando più use case con outcome esplicito
 * e ammissione opzionale di use case emergenti (`suggested:*`).
 */
export async function assembleAIAgentConversationApi(
  params: AssembleAIAgentConversationParams
): Promise<UseCaseGeneratorWizardConversation> {
  const {
    useCases,
    runtimeContext,
    outputLanguage,
    globalStyleContract,
    previousConversationsCount,
    outcome,
    allowSuggestedUseCases,
    provider,
    model,
  } = params;
  if (useCases.length < 2) {
    throw new Error('Servono almeno 2 use case per montare una conversazione.');
  }
  if (outcome !== 'positive' && outcome !== 'negative') {
    throw new Error('Outcome richiesto: positive | negative.');
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ASSEMBLE_CONVERSATION_TIMEOUT_MS);
  try {
    const bodyPayload: Record<string, unknown> = {
      action: 'assemble_conversation',
      useCases: [...useCases],
      outcome,
      allowSuggestedUseCases: Boolean(allowSuggestedUseCases),
      provider: provider.toLowerCase(),
      model,
    };
    if (typeof runtimeContext === 'string' && runtimeContext.trim().length > 0) {
      bodyPayload.runtimeContext = runtimeContext.trim();
    }
    if (typeof outputLanguage === 'string' && outputLanguage.trim().length > 0) {
      bodyPayload.outputLanguage = outputLanguage.trim();
    }
    if (typeof globalStyleContract === 'string' && globalStyleContract.trim().length > 0) {
      bodyPayload.globalStyleContract = globalStyleContract.trim();
    }
    if (typeof previousConversationsCount === 'number' && previousConversationsCount > 0) {
      bodyPayload.previousConversationsCount = previousConversationsCount;
    }
    /**
     * Style hint testuale fornito dal designer nel passo «Conversazione». Viene aggiunto al
     * prompt server-side con un'istruzione esplicita ("crea le conversazioni nello stile
     * di questo esempio"). Trim difensivo: stringhe whitespace-only sono considerate
     * "non fornite" e omesse dal payload (gate "auto" del designer).
     */
    if (typeof params.stylePromptHint === 'string' && params.stylePromptHint.trim().length > 0) {
      bodyPayload.stylePromptHint = params.stylePromptHint.trim();
    }
    /**
     * v2 multi-stile: payload completo dello stile target. Trim+slice difensivi per
     * evitare prompt giganteschi (cap 4000 char per `description` e `example`). `id`
     * passa as-is (deve coincidere con un id di registry o essere accettato dal backend).
     */
    if (params.stylePayload && params.stylePayload.id) {
      const sp = params.stylePayload;
      bodyPayload.stylePayload = {
        id: sp.id,
        description: typeof sp.description === 'string' ? sp.description.trim().slice(0, 4000) : '',
        example: typeof sp.example === 'string' ? sp.example.trim().slice(0, 4000) : '',
        auto: sp.auto === true,
      };
    }
    const res = await fetchAiAgentDesignAgentGenerate({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(applyCallMetaToBody(bodyPayload, params.callMeta)),
      signal: controller.signal,
    });
    const body = (await parseDesignApiJsonResponse(res)) as
      | { success: true; conversation: unknown }
      | AIAgentDesignApiError;
    if (!res.ok || !body || typeof body !== 'object' || !('success' in body) || !body.success) {
      emitDesignAiLlmBurstFromErrorResponse(res, body);
      const err = body as AIAgentDesignApiError;
      const msg = err.error || `HTTP ${res.status}`;
      const extra = err.rawSnippet ? ` — snippet: ${err.rawSnippet.slice(0, 200)}` : '';
      throw new Error(msg + extra);
    }
    /**
     * Backend usa snake_case (conversation_id, use_case_id). Adattiamo a camelCase per il modello del wizard
     * tramite un primo passaggio chiave-per-chiave.
     */
    const rawConv = body.conversation;
    const normalizedRaw =
      rawConv && typeof rawConv === 'object'
        ? normalizeConversationSnakeToCamel(rawConv as Record<string, unknown>)
        : null;
    const conversation = parseConversationFromApi(normalizedRaw, {
      outcome,
      allowsSuggestedUseCases: Boolean(allowSuggestedUseCases),
    });
    if (!conversation) {
      throw new Error('Risposta non valida: conversation incompleta.');
    }
    return conversation;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeConversationSnakeToCamel(raw: Record<string, unknown>): Record<string, unknown> {
  const conversationId =
    typeof raw.conversationId === 'string' && raw.conversationId.trim()
      ? raw.conversationId
      : typeof raw.conversation_id === 'string'
        ? raw.conversation_id
        : '';
  /** Backend usa snake_case (`scenario_summary`); il backend post-refactor lo emette già camelCase. Accettiamo entrambi. */
  const scenarioSummary =
    typeof raw.scenarioSummary === 'string'
      ? raw.scenarioSummary
      : typeof raw.scenario_summary === 'string'
        ? raw.scenario_summary
        : undefined;
  const turnsIn = Array.isArray(raw.turns) ? raw.turns : [];
  const turns = turnsIn.map((t) => {
    if (!t || typeof t !== 'object') return t;
    const obj = t as Record<string, unknown>;
    return {
      turnId:
        typeof obj.turnId === 'string'
          ? obj.turnId
          : typeof obj.turn_id === 'string'
            ? obj.turn_id
            : '',
      role: obj.role,
      text: typeof obj.text === 'string' ? obj.text : '',
      useCaseId:
        typeof obj.useCaseId === 'string'
          ? obj.useCaseId
          : typeof obj.use_case_id === 'string'
            ? obj.use_case_id
            : undefined,
      useCaseLabel:
        typeof obj.useCaseLabel === 'string'
          ? obj.useCaseLabel
          : typeof obj.use_case_label === 'string'
            ? obj.use_case_label
            : undefined,
      suggestion: obj.suggestion,
    };
  });
  return {
    conversationId,
    turns,
    ...(scenarioSummary !== undefined ? { scenarioSummary } : {}),
  };
}

export interface ProofreadConversationAgentTurnsParams {
  conversation: UseCaseGeneratorWizardConversation;
  modifiedAgentTurns: Array<{
    turnId: string;
    useCaseId: string;
    currentText: string;
    baselineText: string;
  }>;
  provider: string;
  model: string;
  outputLanguage?: string;
  callMeta?: AiCallMeta;
}

export interface ProofreadConversationAgentTurnsResult {
  updates: Array<{ turnId: string; text: string }>;
}

/**
 * Passo 2 wizard: corregge SOLO ortografia/punteggiatura/capitalizzazione/spazi nelle bubble
 * agente modificate dal designer. Non riformula, non cambia tono, non sostituisce sinonimi.
 *
 * Sostituisce la vecchia `homogenize*` (che riscriveva il testo). Il backend accetta entrambi
 * gli action name per compatibilità ed esegue sempre il prompt proofread (temperatura 0.1).
 */
export async function proofreadAIAgentConversationAgentTurnsApi(
  params: ProofreadConversationAgentTurnsParams
): Promise<ProofreadConversationAgentTurnsResult> {
  const { conversation, modifiedAgentTurns, provider, model, outputLanguage } = params;
  if (modifiedAgentTurns.length === 0) {
    throw new Error('Nessuna bubble agente modificata da correggere.');
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROOFREAD_CONVERSATION_TIMEOUT_MS);
  try {
    const bodyPayload: Record<string, unknown> = {
      action: 'proofread_conversation_agent_turns',
      conversation,
      modifiedAgentTurns,
      provider: provider.toLowerCase(),
      model,
    };
    if (typeof outputLanguage === 'string' && outputLanguage.trim().length > 0) {
      bodyPayload.outputLanguage = outputLanguage.trim();
    }
    const res = await fetchAiAgentDesignAgentGenerate({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(applyCallMetaToBody(bodyPayload, params.callMeta)),
      signal: controller.signal,
    });
    const body = (await parseDesignApiJsonResponse(res)) as
      | { success: true; updates: unknown }
      | AIAgentDesignApiError;
    if (!res.ok || !body || typeof body !== 'object' || !('success' in body) || !body.success) {
      emitDesignAiLlmBurstFromErrorResponse(res, body);
      const err = body as AIAgentDesignApiError;
      const msg = err.error || `HTTP ${res.status}`;
      const extra = err.rawSnippet ? ` — snippet: ${err.rawSnippet.slice(0, 200)}` : '';
      throw new Error(msg + extra);
    }
    const rawUpdates = (body as { updates?: unknown }).updates;
    if (!Array.isArray(rawUpdates)) {
      throw new Error('Risposta non valida: updates mancante.');
    }
    const updates: ProofreadConversationAgentTurnsResult['updates'] = [];
    for (const row of rawUpdates) {
      if (!row || typeof row !== 'object') continue;
      const o = row as Record<string, unknown>;
      const turnId =
        typeof o.turnId === 'string'
          ? o.turnId.trim()
          : typeof o.turn_id === 'string'
            ? o.turn_id.trim()
            : '';
      const text = typeof o.text === 'string' ? o.text.trim() : '';
      if (turnId && text) updates.push({ turnId, text });
    }
    if (updates.length === 0) {
      throw new Error('Risposta non valida: nessun aggiornamento.');
    }
    return { updates };
  } finally {
    clearTimeout(timeout);
  }
}

export interface TokenizeAIAgentUseCasesParams {
  useCases: readonly AIAgentUseCase[];
  outputLanguage?: string;
  provider: string;
  model: string;
  callMeta?: AiCallMeta;
}

export interface TokenizeAIAgentUseCasesResult {
  /** Una entry per ogni use case ammesso dal backend (id presente nel catalogo + frase non vuota). */
  updates: Array<{ useCaseId: string; tokenizedText: string }>;
}

/**
 * Passo 3 wizard: chiede all'AI di produrre la versione tokenizzata della frase canonica
 * assistente di ciascuno use case (placeholder tra parentesi quadre, es. `[data]`, `[ora1]`).
 * Frasi senza parti variabili vengono restituite invariate.
 */
export async function tokenizeAIAgentUseCasesApi(
  params: TokenizeAIAgentUseCasesParams
): Promise<TokenizeAIAgentUseCasesResult> {
  const { useCases, outputLanguage, provider, model } = params;
  if (!useCases || useCases.length === 0) {
    throw new Error('Serve almeno 1 use case per la tokenizzazione.');
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TOKENIZE_USE_CASES_TIMEOUT_MS);
  try {
    const bodyPayload: Record<string, unknown> = {
      action: 'tokenize_use_cases',
      useCases: [...useCases],
      provider: provider.toLowerCase(),
      model,
    };
    if (typeof outputLanguage === 'string' && outputLanguage.trim().length > 0) {
      bodyPayload.outputLanguage = outputLanguage.trim();
    }
    const res = await fetchAiAgentDesignAgentGenerate({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(applyCallMetaToBody(bodyPayload, params.callMeta)),
      signal: controller.signal,
    });
    const body = (await parseDesignApiJsonResponse(res)) as
      | { success: true; updates: unknown }
      | AIAgentDesignApiError;
    if (!res.ok || !body || typeof body !== 'object' || !('success' in body) || !body.success) {
      emitDesignAiLlmBurstFromErrorResponse(res, body);
      const err = body as AIAgentDesignApiError;
      const msg = err.error || `HTTP ${res.status}`;
      const extra = err.rawSnippet ? ` — snippet: ${err.rawSnippet.slice(0, 200)}` : '';
      throw new Error(msg + extra);
    }
    const rawUpdates = (body as { updates?: unknown }).updates;
    if (!Array.isArray(rawUpdates)) {
      throw new Error('Risposta non valida: updates mancante.');
    }
    const updates: TokenizeAIAgentUseCasesResult['updates'] = [];
    for (const row of rawUpdates) {
      if (!row || typeof row !== 'object') continue;
      const o = row as Record<string, unknown>;
      const useCaseId =
        typeof o.useCaseId === 'string'
          ? o.useCaseId.trim()
          : typeof o.use_case_id === 'string'
            ? o.use_case_id.trim()
            : '';
      const tokenizedText =
        typeof o.tokenizedText === 'string'
          ? o.tokenizedText
          : typeof o.tokenized_text === 'string'
            ? o.tokenized_text
            : '';
      if (useCaseId && tokenizedText) {
        updates.push({ useCaseId, tokenizedText });
      }
    }
    if (updates.length === 0) {
      throw new Error('Risposta non valida: nessuna tokenizzazione utile.');
    }
    return { updates };
  } finally {
    clearTimeout(timeout);
  }
}

/* eslint-disable @typescript-eslint/no-unused-vars -- placeholder: la feature «LLM manual handoff» è stata rimossa. */
/**
 * @internal
 * Le funzioni `buildAIAgentPromptPreviewApi`, `parseExternalGenerateUseCasesJson`,
 * `parseExternalAssembleConversationJson` e i tipi correlati erano supporto della feature
 * «LLM manual handoff» (handoff verso motore esterno per copia/incolla). Sono state rimosse
 * insieme al modale e all'azione backend `build_prompt_preview` su richiesta esplicita
 * dell'utente. Niente di tutto questo deve essere reintrodotto: il prompt esportato per uso
 * con motori esterni è ora prodotto in modalità deterministica dal builder
 * {@link buildConversationalPrompt} e mostrato nel dialog «Crea prompt conversazionale»
 * (`ConversationalPromptDialog`).
 */
/* eslint-enable @typescript-eslint/no-unused-vars */
