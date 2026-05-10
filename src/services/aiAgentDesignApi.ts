/**
 * Client for design-time AI Agent generation (Node backend /design/ai-agent-generate).
 */

import type { AIAgentDesignApiError, AIAgentDesignApiSuccess, AIAgentDesignPayload } from '@types/aiAgentDesign';
import type {
  AIAgentLogicalStep,
  AIAgentUseCase,
  AIAgentUseCaseTurn,
} from '@types/aiAgentUseCases';
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
}): Promise<unknown> {
  const { description, provider, model, outputLanguage } = params;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch('/design/extract-structure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: description.trim(),
        provider: provider.toLowerCase(),
        model,
        ...(typeof outputLanguage === 'string' && outputLanguage.trim().length > 0
          ? { outputLanguage: outputLanguage.trim() }
          : {}),
      }),
      signal: controller.signal,
    });
    const body = (await res.json()) as
      | { success: true; structured_design: unknown }
      | AIAgentDesignApiError;
    if (!res.ok || !body.success) {
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

    const res = await fetch('/design/ai-agent-generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload),
      signal: controller.signal,
    });
    const body = (await res.json()) as
      | AIAgentDesignApiSuccess
      | AIAgentDesignApiError
      | {
          success: true;
          refineMode: 'sections_only';
          platform: string;
          system_prompt: string;
        };
    if (!res.ok || !body.success) {
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
    const res = await fetch('/design/ai-agent-induce-style-rule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload),
      signal: controller.signal,
    });
    const body = (await res.json()) as { success: true; rule_text: string } | AIAgentDesignApiError;
    if (!res.ok || !body || typeof body !== 'object' || !('success' in body) || !body.success) {
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
    const res = await fetch('/design/ai-agent-analyze-debug-turn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload),
      signal: controller.signal,
    });
    const body = (await res.json()) as
      | ({ success: true } & Record<string, unknown>)
      | AIAgentDesignApiError;
    if (!res.ok || !body || typeof body !== 'object' || !('success' in body) || !body.success) {
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
}

export interface GenerateAIAgentUseCasesResult {
  logicalSteps: AIAgentLogicalStep[];
  useCases: AIAgentUseCase[];
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
    if (extend) {
      bodyPayload.extendExisting = true;
      bodyPayload.existingUseCases = extendFrom!.useCases;
      bodyPayload.existingLogicalSteps = extendFrom!.logicalSteps;
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
    const res = await fetch('/design/ai-agent-generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload),
      signal: controller.signal,
    });
    const body = (await res.json()) as
      | {
          success: true;
          logical_steps?: unknown;
          use_cases: unknown;
          extend_mode?: boolean;
        }
      | AIAgentDesignApiError;
    if (!res.ok || !body || typeof body !== 'object' || !('success' in body) || !body.success) {
      const err = body as AIAgentDesignApiError;
      const msg = err.error || `HTTP ${res.status}`;
      const extra = err.rawSnippet ? ` — snippet: ${err.rawSnippet.slice(0, 200)}` : '';
      throw new Error(msg + extra);
    }

    const useCases = parseAgentUseCasesFromApi(body.use_cases);
    if (useCases.length === 0) {
      throw new Error('Risposta use case non valida: use_cases vuoti dopo la normalizzazione.');
    }

    if (body.extend_mode === true && extendFrom) {
      return {
        logicalSteps: [...extendFrom.logicalSteps],
        useCases,
      };
    }

    const logicalSteps = parseAgentLogicalStepsFromApi(body.logical_steps);
    if (logicalSteps.length === 0) {
      throw new Error('Risposta use case non valida: logical_steps vuoti dopo la normalizzazione.');
    }
    return { logicalSteps, useCases };
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
    const res = await fetch('/design/ai-agent-generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload),
      signal: controller.signal,
    });
    const body = (await res.json()) as { success: true; use_case: unknown } | AIAgentDesignApiError;
    if (!res.ok || !body || typeof body !== 'object' || !('success' in body) || !body.success) {
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

export interface CreateAIAgentUseCaseParams {
  useCase: AIAgentUseCase;
  allUseCases: AIAgentUseCase[];
  logicalSteps: AIAgentLogicalStep[];
  provider: string;
  model: string;
  outputLanguage?: string;
  globalStyleContract?: string;
  globalStyleId?: string;
}

/**
 * Create one new use case and auto-generate dialogue from context.
 */
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
    const res = await fetch('/design/ai-agent-generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload),
      signal: controller.signal,
    });
    const body = (await res.json()) as { success: true; use_case: unknown } | AIAgentDesignApiError;
    if (!res.ok || !body || typeof body !== 'object' || !('success' in body) || !body.success) {
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
    const res = await fetch('/design/ai-agent-generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload),
      signal: controller.signal,
    });
    const body = (await res.json()) as
      | { success: true; updates: unknown }
      | AIAgentDesignApiError;
    if (!res.ok || !body || typeof body !== 'object' || !('success' in body) || !body.success) {
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

export interface RegenerateAIAgentUseCaseTurnParams {
  useCase: AIAgentUseCase;
  turnId: string;
  provider: string;
  model: string;
  outputLanguage?: string;
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
    const res = await fetch('/design/ai-agent-generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload),
      signal: controller.signal,
    });
    const body = (await res.json()) as { success: true; turn: unknown } | AIAgentDesignApiError;
    if (!res.ok || !body || typeof body !== 'object' || !('success' in body) || !body.success) {
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
    const res = await fetch('/design/ai-agent-generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload),
      signal: controller.signal,
    });
    const body = (await res.json()) as
      | { success: true; content: string; motor: AgentMessageMotorPayload }
      | AIAgentDesignApiError;
    if (!res.ok || !body || typeof body !== 'object' || !('success' in body) || !body.success) {
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
