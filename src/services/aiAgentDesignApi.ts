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

export interface GenerateAIAgentUseCasesParams {
  userDesc: string;
  provider: string;
  model: string;
  /** Runtime prompt / structured sections markdown for context. */
  runtimeContext?: string;
  outputLanguage?: string;
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
  const { userDesc, provider, model, runtimeContext, outputLanguage } = params;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GENERATE_USE_CASES_TIMEOUT_MS);
  try {
    const bodyPayload: Record<string, unknown> = {
      action: 'generate_use_cases',
      userDesc,
      provider: provider.toLowerCase(),
      model,
    };
    if (typeof runtimeContext === 'string' && runtimeContext.trim().length > 0) {
      bodyPayload.runtimeContext = runtimeContext.trim();
    }
    if (typeof outputLanguage === 'string' && outputLanguage.trim().length > 0) {
      bodyPayload.outputLanguage = outputLanguage.trim();
    }
    const res = await fetch('/design/ai-agent-generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload),
      signal: controller.signal,
    });
    const body = (await res.json()) as
      | { success: true; logical_steps: unknown; use_cases: unknown }
      | AIAgentDesignApiError;
    if (!res.ok || !body || typeof body !== 'object' || !('success' in body) || !body.success) {
      const err = body as AIAgentDesignApiError;
      const msg = err.error || `HTTP ${res.status}`;
      const extra = err.rawSnippet ? ` — snippet: ${err.rawSnippet.slice(0, 200)}` : '';
      throw new Error(msg + extra);
    }
    const logicalSteps = parseAgentLogicalStepsFromApi(body.logical_steps);
    const useCases = parseAgentUseCasesFromApi(body.use_cases);
    if (logicalSteps.length === 0 || useCases.length === 0) {
      throw new Error('Risposta use case non valida: logical_steps o use_cases vuoti dopo la normalizzazione.');
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
}

/**
 * Regenerate one use case in place (same id expected).
 */
export async function regenerateAIAgentUseCaseApi(
  params: RegenerateAIAgentUseCaseParams
): Promise<AIAgentUseCase> {
  const { useCase, allUseCases, logicalSteps, provider, model, outputLanguage } = params;
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
