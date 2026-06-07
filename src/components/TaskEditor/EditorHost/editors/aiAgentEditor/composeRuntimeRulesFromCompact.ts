/**
 * Parses persisted `agentRuntimeCompactJson` (examples / legacy), resolves `llmEndpoint` for VB compile.
 * Compile/ConvAI `rules` / prompts use {@link resolveAiAgentPlatformRulesString} (full sections → platform).
 */

import type { AIAgentRuntimeCompact } from '@types/aiAgentDesign';
import type { ProjectBackendCatalogBlob } from '@domain/backendCatalog/catalogTypes';
import { resolveAiAgentPlatformRulesString, type TaskLikeForPlatformRules } from './resolveAiAgentPlatformRulesString';
import type { IAAgentConfig } from 'types/iaAgentRuntimeSetup';
import { normalizeIAAgentConfig } from '@utils/iaAgentRuntime/iaAgentConfigNormalize';
import { loadGlobalIaAgentConfig } from '@utils/iaAgentRuntime/globalIaAgentPersistence';
import {
  iaConvaiTraceCompileLlmBranchWarning,
  iaConvaiTraceCompilePayload,
  iaConvaiTraceElevenLabsFieldResolution,
} from '@utils/debug/iaConvaiFlowTrace';
import { getConvaiSessionBinding } from '@utils/iaAgentRuntime/convaiSessionAgentStore';
import { parseAgentUseCasesJson } from '@types/aiAgentUseCases';
import { resolveAgentOpeningMessage } from '@domain/convai/resolveAgentOpeningMessage';
import { parseAgentElevenLabsConvaiLinkJson } from '@domain/convai/agentElevenLabsConvaiLink';
import {
  isKbDeterministicDeployMode,
  normalizeAgentConvaiDeployMode,
} from '@domain/convai/agentConvaiDeployMode';

/**
 * ElevenLabs ConvAI agent.language expects ISO 639-1; Omnia may persist BCP-47 (e.g. it-IT).
 */
export function normalizeLanguage(lang: string | undefined | null): string | undefined | null {
  if (!lang) return lang;
  return lang.toLowerCase().split('-')[0];
}

/**
 * Parses task-persisted JSON; returns null if missing or invalid.
 */
export function parseAgentRuntimeCompactJson(json: string): AIAgentRuntimeCompact | null {
  const t = json.trim();
  if (!t) return null;
  let o: unknown;
  try {
    o = JSON.parse(t);
  } catch {
    return null;
  }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  const r = o as Record<string, unknown>;
  const required = [
    'behavior_compact',
    'constraints_compact',
    'sequence_compact',
    'corrections_compact',
    'examples_compact',
  ] as const;
  for (const k of required) {
    if (!(k in r)) return null;
  }
  const behavior = String(r.behavior_compact ?? '').trim();
  const constraints = String(r.constraints_compact ?? '').trim();
  const sequence = String(r.sequence_compact ?? '').trim();
  const corrections = String(r.corrections_compact ?? '').trim();
  if (!behavior || !constraints || !sequence || !corrections) return null;

  const ex = r.examples_compact;
  if (!Array.isArray(ex) || ex.length < 2) return null;
  const examples: AIAgentRuntimeCompact['examples_compact'] = [];
  for (const turn of ex) {
    if (!turn || typeof turn !== 'object' || Array.isArray(turn)) return null;
    const role = (turn as { role?: unknown }).role;
    if (role !== 'assistant' && role !== 'user') return null;
    const content = String((turn as { content?: unknown }).content ?? '').trim();
    if (!content) return null;
    examples.push({ role, content });
  }

  return {
    behavior_compact: behavior,
    constraints_compact: constraints,
    sequence_compact: sequence,
    corrections_compact: corrections,
    examples_compact: examples,
  };
}

/**
 * Single plain-text rules block for LLM/engine (no markdown).
 */
export function composeRulesTextFromRuntimeCompact(rc: AIAgentRuntimeCompact): string {
  return [rc.behavior_compact, rc.constraints_compact, rc.sequence_compact, rc.corrections_compact]
    .map((s) => s.trim())
    .join('\n\n');
}

export interface AiAgentTaskFieldsForCompiler {
  agentRuntimeCompactJson?: string;
  agentPrompt?: string;
  agentStructuredSectionsJson?: string;
  agentPromptTargetPlatform?: string;
}

/**
 * Default POST URL for the Node runtime bridge (`/api/runtime/ai-agent/step`).
 * Override with `VITE_AI_AGENT_STEP_URL` when the backend is not on localhost:3100.
 */
export function defaultAiAgentLlmEndpoint(): string {
  const fromEnv = import.meta.env?.VITE_AI_AGENT_STEP_URL;
  if (typeof fromEnv === 'string' && fromEnv.trim().length > 0) {
    return fromEnv.trim();
  }
  return 'http://localhost:3100/api/runtime/ai-agent/step';
}

/**
 * Resolved URL stored on the compiled task: explicit `llmEndpoint` on the task, else {@link defaultAiAgentLlmEndpoint}.
 */
export function resolveAiAgentLlmEndpointForCompile(task: { llmEndpoint?: string }): string {
  const t = typeof task.llmEndpoint === 'string' ? task.llmEndpoint.trim() : '';
  if (t.length > 0) return t;
  return defaultAiAgentLlmEndpoint();
}

/** Fields required to build the minimal compile DTO for VB (AI Agent). */
export interface MinimalAiAgentCompileTaskInput extends AiAgentTaskFieldsForCompiler {
  id: string;
  type: number;
  templateId?: string | null;
  llmEndpoint?: string;
  /** Task-persisted IA override (platform, convai id, …) for compile. */
  agentIaRuntimeOverrideJson?: string;
  /** Designer «Avvio immediato»: compiled into VB + ConvAI first_message preview. */
  agentImmediateStart?: boolean;
  /** Use case bundle JSON — appended to compiled rules as constrained catalog appendix. */
  agentUseCasesJson?: string | null;
  /** Start Prompt JSON (`agentStartPromptJson`). */
  agentStartPromptJson?: string | null;
  /** Use case marcato Start (`agentStartUseCaseId`). */
  agentStartUseCaseId?: string | null;
  /** Link deploy ConvAI persistito sul task (`agentElevenLabsConvaiLinkJson`). */
  agentElevenLabsConvaiLinkJson?: string;
  /** Modalità deploy: in kb_deterministic il link deploy forza ramo ElevenLabs a compile. */
  agentConvaiDeployMode?: string;
}

export interface BuildMinimalAiAgentCompileTaskOptions {
  /** @deprecated Removed; compile always uses full structured sections → platform string. */
  rulesVariant?: never;
  manualCatalogBackendTaskIds?: readonly string[];
  backendCatalog?: ProjectBackendCatalogBlob;
}

/** Payload POST compile per VB: default LLM-only; estensioni opzionali per ElevenLabs. */
export type MinimalAiAgentCompilePayload = {
  id: string;
  type: number;
  templateId: string | null;
  rules: string;
  llmEndpoint: string;
  /** Mirrors ConvAI `first_message` wiring (empty when immediate start). Same string as {@link CONVAI_DEFAULT_FIRST_MESSAGE}. */
  firstMessage: string;
  immediateStart: boolean;
  /** Deploy deterministico KB: bootstrap prima domanda via omnia_dialog_step lato ApiServer. */
  kbDeterministic?: boolean;
  platform?: 'elevenlabs';
  agentId?: string;
  backendBaseUrl?: string;
};

/**
 * Minimal task JSON for POST /api/runtime/compile (AI Agent): id, type, templateId, rules, llmEndpoint.
 * Omits editor/Mongo-only fields (agentPrompt, agentStructuredSectionsJson, previews, use cases, etc.).
 */
/**
 * Resolve ElevenLabs-specific compile fields so they match editor semantics:
 * - Persisted task override wins on platform choice.
 * - Missing `convaiAgentId` / backend URL fall back to global defaults (Settings → Runtime IA Agent),
 *   same as the dock panel until the user saves an override-only-on-task slice.
 * - With no persisted override JSON, ElevenLabs + ids can still apply from globals alone.
 */
/**
 * Reads persisted override JSON **before** normalize to report whether `convaiAgentId` exists and non-empty.
 * Helps distinguish «key missing» vs «empty string stripped by normalize» vs «invalid JSON».
 */
function peekConvaiAgentIdInRawOverride(raw: string): {
  convaiAgentIdKeyInJson: boolean;
  convaiAgentIdRawTrimmedChars: number;
} {
  const t = raw.trim();
  if (!t.length) {
    return { convaiAgentIdKeyInJson: false, convaiAgentIdRawTrimmedChars: 0 };
  }
  try {
    const o = JSON.parse(t) as Record<string, unknown>;
    const hasKey = Object.prototype.hasOwnProperty.call(o, 'convaiAgentId');
    const v = o.convaiAgentId;
    const chars = typeof v === 'string' ? v.trim().length : 0;
    return { convaiAgentIdKeyInJson: hasKey, convaiAgentIdRawTrimmedChars: chars };
  } catch {
    return {
      convaiAgentIdKeyInJson: t.includes('"convaiAgentId"'),
      convaiAgentIdRawTrimmedChars: 0,
    };
  }
}

function resolveElevenLabsMinimalCompileExtension(
  taskId: string,
  agentIaRuntimeOverrideJson: string | undefined,
  globalIa: IAAgentConfig,
  agentElevenLabsConvaiLinkJson?: string,
  agentConvaiDeployMode?: string
): Pick<MinimalAiAgentCompilePayload, 'platform' | 'agentId' | 'backendBaseUrl'> | null {
  const deployMode = normalizeAgentConvaiDeployMode(agentConvaiDeployMode);
  const link = parseAgentElevenLabsConvaiLinkJson(agentElevenLabsConvaiLinkJson);
  const linkAgentId = link?.agentId?.trim() ?? '';
  const sessionId = getConvaiSessionBinding(taskId)?.agentId?.trim() ?? '';
  const kbDeterministic = isKbDeterministicDeployMode(deployMode);
  const raw =
    typeof agentIaRuntimeOverrideJson === 'string' ? agentIaRuntimeOverrideJson.trim() : '';
  console.log('[IA·ConvAI] DIAG compile override raw', {
    taskId,
    rawOverride: raw,
    rawOverrideChars: raw?.length ?? 0,
  });
  const peek = peekConvaiAgentIdInRawOverride(raw);
  let ia: IAAgentConfig | null = null;
  let parseOk = false;
  if (raw.length > 0) {
    try {
      ia = normalizeIAAgentConfig(JSON.parse(raw) as unknown);
      parseOk = true;
    } catch {
      /** Keep ia null — do not silently mix globals when persisted JSON is invalid */
    }
  }

  let useElevenLabs = false;
  let agentIdTask = '';
  let backendTask = '';

  if (parseOk && ia) {
    if (ia.platform === 'elevenlabs') {
      useElevenLabs = true;
      agentIdTask = ia.convaiAgentId?.trim() ?? '';
      backendTask = ia.elevenLabsBackendBaseUrl?.trim() ?? '';
    }
  } else if (!raw && globalIa.platform === 'elevenlabs') {
    useElevenLabs = true;
    agentIdTask = '';
    backendTask = '';
  }

  if (!useElevenLabs && kbDeterministic && (linkAgentId || sessionId)) {
    useElevenLabs = true;
  }

  if (!useElevenLabs) return null;

  const agentIdGlobal = globalIa.platform === 'elevenlabs' ? globalIa.convaiAgentId?.trim() ?? '' : '';
  const backendGlobal =
    globalIa.platform === 'elevenlabs' ? globalIa.elevenLabsBackendBaseUrl?.trim() ?? '' : '';

  const agentId = sessionId || linkAgentId || agentIdTask || agentIdGlobal;
  const backendBaseUrl = backendTask || backendGlobal;

  const agentIdSource: 'session' | 'link' | 'task' | 'global' | 'none' =
    sessionId.length > 0
      ? 'session'
      : linkAgentId.length > 0
        ? 'link'
        : agentIdTask.length > 0
          ? 'task'
          : agentIdGlobal.length > 0
            ? 'global'
            : 'none';

  iaConvaiTraceElevenLabsFieldResolution(taskId, {
    rawOverrideChars: raw.length,
    parseOk,
    parseFailedWithNonEmptyRaw: !parseOk && raw.length > 0,
    iaPlatformAfterNormalize: ia?.platform,
    convaiPresentOnTask: agentIdTask.length > 0,
    convaiAgentIdKeyInJson: peek.convaiAgentIdKeyInJson,
    convaiAgentIdRawTrimmedChars: peek.convaiAgentIdRawTrimmedChars,
    globalPlatform: globalIa.platform,
    convaiPresentInGlobalDefaults: agentIdGlobal.length > 0,
    resolvedAgentIdChars: agentId.length,
    agentIdSource,
    deployLinkAgentIdChars: linkAgentId.length,
    kbDeterministic,
  });

  return {
    platform: 'elevenlabs',
    agentId,
    backendBaseUrl,
  };
}

export function buildMinimalAiAgentCompileTask(
  task: MinimalAiAgentCompileTaskInput,
  options?: BuildMinimalAiAgentCompileTaskOptions
): MinimalAiAgentCompilePayload {
  const rules = resolveAiAgentPlatformRulesString(
    { ...task, id: task.id } as TaskLikeForPlatformRules,
    {
      manualCatalogBackendTaskIds: options?.manualCatalogBackendTaskIds,
      backendCatalog: options?.backendCatalog,
    }
  );
  const immediateStart = task.agentImmediateStart === true;
  const useCases = parseAgentUseCasesJson(String(task.agentUseCasesJson ?? ''));
  const deployMode = normalizeAgentConvaiDeployMode(task.agentConvaiDeployMode);
  const kbDeterministic = isKbDeterministicDeployMode(deployMode);
  const base: MinimalAiAgentCompilePayload = {
    id: task.id,
    type: task.type,
    templateId: task.templateId ?? null,
    rules,
    llmEndpoint: resolveAiAgentLlmEndpointForCompile(task),
    immediateStart,
    firstMessage: resolveAgentOpeningMessage({
      agentImmediateStart: immediateStart,
      startUseCaseId: task.agentStartUseCaseId,
      agentStartPromptJson: task.agentStartPromptJson,
      useCases,
      agentConvaiDeployMode: task.agentConvaiDeployMode,
      allowDefaultFallback: true,
    }),
    ...(kbDeterministic ? { kbDeterministic: true } : {}),
  };

  const globalIa = loadGlobalIaAgentConfig();
  const elFields = resolveElevenLabsMinimalCompileExtension(
    task.id,
    task.agentIaRuntimeOverrideJson,
    globalIa,
    task.agentElevenLabsConvaiLinkJson,
    task.agentConvaiDeployMode
  );
  if (elFields) {
    const el = { ...base, ...elFields };
    iaConvaiTraceCompilePayload(task.id, el);
    return el;
  }

  if (isKbDeterministicDeployMode(deployMode)) {
    const link = parseAgentElevenLabsConvaiLinkJson(task.agentElevenLabsConvaiLinkJson);
    let overridePlatform: string | undefined;
    const rawOv = String(task.agentIaRuntimeOverrideJson ?? '').trim();
    if (rawOv) {
      try {
        const parsed = JSON.parse(rawOv) as { platform?: string };
        overridePlatform = typeof parsed.platform === 'string' ? parsed.platform : undefined;
      } catch {
        overridePlatform = '(invalid json)';
      }
    }
    iaConvaiTraceCompileLlmBranchWarning(task.id, {
      deployMode,
      hasDeployLink: Boolean(link?.agentId?.trim()),
      hasSessionAgent: Boolean(getConvaiSessionBinding(task.id)?.agentId?.trim()),
      overridePlatform,
      globalPlatform: globalIa.platform,
    });
  }

  return base;
}
