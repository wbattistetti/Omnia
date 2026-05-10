/**
 * Design-time use case composer: logical steps + hierarchical scenarios with payoff and agent output.
 */

import type { AgentMessageMotorPayload } from '../domain/aiAgentUseCase/splitAgentMessageTemplate';

/** Last IA-synced motor JSON for an assistant turn; compare source_content to detect stale edits. */
export interface AIAgentAssistantMotorSnapshot {
  source_content: string;
  payload: AgentMessageMotorPayload;
}

export interface AIAgentLogicalStep {
  id: string;
  description: string;
}

export interface AIAgentUseCaseTurn {
  turn_id: string;
  role: 'user' | 'assistant';
  content: string;
  /** Product rule: assistant true, user false; set by system, not the LLM. */
  editable?: boolean;
  userEdited?: boolean;
  locked?: boolean;
  /** Populated when designer runs Crea/Aggiorna JSON; invalidated when IA replaces message without re-annotate. */
  motor_snapshot?: AIAgentAssistantMotorSnapshot;
}

export interface AIAgentUseCase {
  id: string;
  label: string;
  parent_id: string | null;
  sort_order: number;
  refinement_prompt: string;
  /** Global style id (cortese / ironico / formale) for this use case contract. */
  style_id?: string;
  /**
   * Narrativa sintetica del contesto di negoziazione / dialogo per questo scenario (chi fa cosa).
   */
  payoff?: string;
  dialogue: AIAgentUseCaseTurn[];
  notes: {
    behavior: string;
    tone: string;
  };
  bubble_notes: Record<string, string>;
}

/** Stable id for a dialogue turn (exported for UI bridge). */
export function newAgentUseCaseTurnId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `t-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function newTurnId(): string {
  return newAgentUseCaseTurnId();
}

function newUseCaseId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `uc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Empty bundle for new tasks. */
export function emptyUseCaseBundle(): {
  logical_steps: AIAgentLogicalStep[];
  use_cases: AIAgentUseCase[];
} {
  return { logical_steps: [], use_cases: [] };
}

/** One root use case with minimal dialogue for manual start. */
export function createDefaultRootUseCase(): AIAgentUseCase {
  const id = newUseCaseId();
  const t1 = newTurnId();
  return {
    id,
    label: 'Scenario principale',
    parent_id: null,
    sort_order: 0,
    refinement_prompt: '',
    payoff: '',
    dialogue: [{ turn_id: t1, role: 'assistant', content: '', editable: true }],
    notes: { behavior: '', tone: '' },
    bubble_notes: {},
  };
}

/**
 * Parse persisted JSON strings from Task; fails closed to empty on invalid input.
 */
export function parseAgentLogicalStepsJson(raw: string | undefined): AIAgentLogicalStep[] {
  if (!raw || typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    const out: AIAgentLogicalStep[] = [];
    for (const e of v) {
      if (!e || typeof e !== 'object') continue;
      const o = e as Record<string, unknown>;
      const id = typeof o.id === 'string' ? o.id.trim() : '';
      const description = typeof o.description === 'string' ? o.description : '';
      if (id) out.push({ id, description });
    }
    return out;
  } catch {
    return [];
  }
}

export function parseAgentUseCasesJson(raw: string | undefined): AIAgentUseCase[] {
  if (!raw || typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    const out: AIAgentUseCase[] = [];
    for (const e of v) {
      if (!e || typeof e !== 'object') continue;
      const o = e as Record<string, unknown>;
      const id = typeof o.id === 'string' ? o.id.trim() : '';
      if (!id) continue;
      const label = typeof o.label === 'string' ? o.label : 'Use case';
      const parent_id =
        o.parent_id === null || o.parent_id === undefined
          ? null
          : typeof o.parent_id === 'string'
            ? o.parent_id
            : null;
      const sort_order = typeof o.sort_order === 'number' && Number.isFinite(o.sort_order) ? o.sort_order : 0;
      const refinement_prompt =
        typeof o.refinement_prompt === 'string' ? o.refinement_prompt : '';
      const style_id =
        typeof o.style_id === 'string' && o.style_id.trim()
          ? o.style_id.trim()
          : typeof (o as Record<string, unknown>).style === 'string' &&
              String((o as Record<string, unknown>).style).trim()
            ? String((o as Record<string, unknown>).style).trim()
            : undefined;
      let payoff = '';
      if (typeof o.payoff === 'string' && o.payoff.trim()) payoff = o.payoff.trim();
      else if (typeof o.description === 'string' && o.description.trim()) payoff = o.description.trim();
      const notesRaw = o.notes && typeof o.notes === 'object' ? (o.notes as Record<string, unknown>) : {};
      const behavior = typeof notesRaw.behavior === 'string' ? notesRaw.behavior : '';
      const tone = typeof notesRaw.tone === 'string' ? notesRaw.tone : '';
      const bubble_notes: Record<string, string> = {};
      if (o.bubble_notes && typeof o.bubble_notes === 'object' && !Array.isArray(o.bubble_notes)) {
        for (const [k, val] of Object.entries(o.bubble_notes as Record<string, unknown>)) {
          if (typeof val === 'string') bubble_notes[k] = val;
        }
      }
      const dialogue: AIAgentUseCaseTurn[] = [];
      if (Array.isArray(o.dialogue)) {
        for (const t of o.dialogue) {
          if (!t || typeof t !== 'object') continue;
          const tr = t as Record<string, unknown>;
          const turn_id =
            typeof tr.turn_id === 'string' && tr.turn_id.trim()
              ? tr.turn_id.trim()
              : newTurnId();
          const role = tr.role === 'user' ? 'user' : 'assistant';
          const content = typeof tr.content === 'string' ? tr.content : '';
          const editable =
            typeof tr.editable === 'boolean'
              ? tr.editable
              : role === 'assistant'
                ? true
                : false;
          const turnBase = {
            turn_id,
            role,
            content,
            ...(role === 'assistant' ? { editable } : { editable: false }),
            userEdited: tr.userEdited === true,
            locked: tr.locked === true,
          };
          const ms = tr.motor_snapshot;
          if (
            role === 'assistant' &&
            ms &&
            typeof ms === 'object' &&
            typeof (ms as Record<string, unknown>).source_content === 'string' &&
            (ms as Record<string, unknown>).payload &&
            typeof (ms as Record<string, unknown>).payload === 'object'
          ) {
            dialogue.push({
              ...turnBase,
              motor_snapshot: ms as AIAgentAssistantMotorSnapshot,
            });
          } else {
            dialogue.push(turnBase);
          }
        }
      }
      out.push({
        id,
        label,
        parent_id,
        sort_order,
        refinement_prompt,
        ...(style_id ? { style_id } : {}),
        ...(payoff ? { payoff } : {}),
        dialogue,
        notes: { behavior, tone },
        bubble_notes,
      });
    }
    return out;
  } catch {
    return [];
  }
}

export function serializeLogicalSteps(steps: readonly AIAgentLogicalStep[]): string {
  return JSON.stringify([...steps]);
}

export function serializeUseCases(cases: readonly AIAgentUseCase[]): string {
  return JSON.stringify([...cases]);
}

/** Normalize LLM/API arrays into typed logical steps. */
export function parseAgentLogicalStepsFromApi(value: unknown): AIAgentLogicalStep[] {
  if (!Array.isArray(value)) return [];
  return parseAgentLogicalStepsJson(JSON.stringify(value));
}

/** Normalize LLM/API arrays into typed use cases. */
export function parseAgentUseCasesFromApi(value: unknown): AIAgentUseCase[] {
  if (!Array.isArray(value)) return [];
  return parseAgentUseCasesJson(JSON.stringify(value));
}

/**
 * Single use_case object from regenerate endpoint.
 * @returns null if payload cannot be normalized.
 */
export function parseOneUseCaseFromApi(value: unknown): AIAgentUseCase | null {
  if (!value || typeof value !== 'object') return null;
  const list = parseAgentUseCasesFromApi([value]);
  return list[0] ?? null;
}

/**
 * Single dialogue turn from regenerate_turn endpoint.
 * @returns null if payload cannot be normalized.
 */
export function parseAgentUseCaseTurnFromApi(value: unknown): AIAgentUseCaseTurn | null {
  if (!value || typeof value !== 'object') return null;
  const tr = value as Record<string, unknown>;
  const turn_id =
    typeof tr.turn_id === 'string' && tr.turn_id.trim() ? tr.turn_id.trim() : newTurnId();
  const role = tr.role === 'user' ? 'user' : 'assistant';
  const content = typeof tr.content === 'string' ? tr.content : '';
  const editable =
    typeof tr.editable === 'boolean' ? tr.editable : role === 'assistant' ? true : false;
  const base = {
    turn_id,
    role,
    content,
    ...(role === 'assistant' ? { editable } : { editable: false }),
    userEdited: tr.userEdited === true,
    locked: tr.locked === true,
  };
  const ms = tr.motor_snapshot;
  if (
    role === 'assistant' &&
    ms &&
    typeof ms === 'object' &&
    typeof (ms as Record<string, unknown>).source_content === 'string' &&
    (ms as Record<string, unknown>).payload &&
    typeof (ms as Record<string, unknown>).payload === 'object'
  ) {
    return { ...base, motor_snapshot: ms as AIAgentAssistantMotorSnapshot };
  }
  return base;
}
