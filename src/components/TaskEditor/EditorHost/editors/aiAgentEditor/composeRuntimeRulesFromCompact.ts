/**
 * Parses persisted `agentRuntimeCompactJson`, builds rules strings for compile/runtime preview,
 * and resolves `llmEndpoint` for VB compile (explicit task URL or default runtime step URL).
 */

import type { AIAgentRuntimeCompact } from '@types/aiAgentDesign';

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
}

/**
 * Builds the `rules` string for VB from `runtime_compact` (deterministic join of four fields only).
 * Falls back to `agentPrompt` only when compact JSON is missing or invalid (legacy tasks).
 */
export function rulesStringForCompilerFromTaskFields(task: AiAgentTaskFieldsForCompiler): string {
  const compactJson = task.agentRuntimeCompactJson;
  if (typeof compactJson === 'string' && compactJson.trim().length > 0) {
    const compact = parseAgentRuntimeCompactJson(compactJson);
    if (compact) {
      return composeRulesTextFromRuntimeCompact(compact);
    }
  }
  return String(task.agentPrompt ?? '').trim();
}

function formatRichRulesExamplesAppendix(rc: AIAgentRuntimeCompact | null): string {
  if (!rc?.examples_compact?.length) return '';
  const lines = rc.examples_compact.map((t) => `${t.role}: ${t.content}`).join('\n');
  return `\n\n---\n\nStyle examples (from runtime_compact.examples_compact):\n${lines}`;
}

/**
 * Rich `rules`: composed Markdown (`agentPrompt`) + optional few-shot lines from compact examples.
 */
export function buildRichRulesString(
  composedRuntimeMarkdown: string,
  compact: AIAgentRuntimeCompact | null
): string {
  return composedRuntimeMarkdown.trim() + formatRichRulesExamplesAppendix(compact);
}

/**
 * Distilled `rules`: compact join when valid; else Markdown fallback (same as {@link rulesStringForCompilerFromTaskFields}).
 */
export function buildDistilledRulesString(
  agentRuntimeCompactJson: string,
  composedRuntimeMarkdownFallback: string
): string {
  return rulesStringForCompilerFromTaskFields({
    agentRuntimeCompactJson,
    agentPrompt: composedRuntimeMarkdownFallback,
  });
}

export type AiAgentRulesVariant = 'distilled' | 'rich';

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

/**
 * `rules` string for compile: compact join vs rich Markdown (+ examples appendix).
 */
export function rulesStringForAiAgentCompile(
  task: AiAgentTaskFieldsForCompiler,
  variant: AiAgentRulesVariant
): string {
  if (variant === 'rich') {
    const compact = parseAgentRuntimeCompactJson(task.agentRuntimeCompactJson ?? '');
    return buildRichRulesString(String(task.agentPrompt ?? '').trim(), compact);
  }
  return rulesStringForCompilerFromTaskFields(task);
}

/** Fields required to build the minimal compile DTO for VB (AI Agent). */
export interface MinimalAiAgentCompileTaskInput extends AiAgentTaskFieldsForCompiler {
  id: string;
  type: number;
  templateId?: string | null;
  llmEndpoint?: string;
}

export interface BuildMinimalAiAgentCompileTaskOptions {
  /** Default distilled (compact). Rich uses `agentPrompt` + examples from compact. */
  rulesVariant?: AiAgentRulesVariant;
}

/**
 * Minimal task JSON for POST /api/runtime/compile (AI Agent): id, type, templateId, rules, llmEndpoint.
 * Omits editor/Mongo-only fields (agentPrompt, agentStructuredSectionsJson, previews, use cases, etc.).
 */
export function buildMinimalAiAgentCompileTask(
  task: MinimalAiAgentCompileTaskInput,
  options?: BuildMinimalAiAgentCompileTaskOptions
): {
  id: string;
  type: number;
  templateId: string | null;
  rules: string;
  llmEndpoint: string;
} {
  const variant = options?.rulesVariant ?? 'distilled';
  const rules = rulesStringForAiAgentCompile(task, variant);
  return {
    id: task.id,
    type: task.type,
    templateId: task.templateId ?? null,
    rules,
    llmEndpoint: resolveAiAgentLlmEndpointForCompile(task),
  };
}
