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
}

const DEFAULT_TIMEOUT_MS = 120000;

/** Use case bundle generation can exceed the default design timeout. */
const GENERATE_USE_CASES_TIMEOUT_MS = 300000;

export async function generateAIAgentDesign(
  params: GenerateAIAgentDesignParams
): Promise<AIAgentDesignPayload> {
  const { userDesc, provider, model, refinementPatch, baseText, sectionRefinements, outputLanguage } =
    params;
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

    const res = await fetch('/design/ai-agent-generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload),
      signal: controller.signal,
    });
    const body = (await res.json()) as AIAgentDesignApiSuccess | AIAgentDesignApiError;
    if (!res.ok || !body.success) {
      const err = body as AIAgentDesignApiError;
      const msg = err.error || `HTTP ${res.status}`;
      const extra = err.rawSnippet ? ` — snippet: ${err.rawSnippet.slice(0, 200)}` : '';
      throw new Error(msg + extra);
    }
    return body.design;
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
