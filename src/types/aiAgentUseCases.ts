/**
 * Design-time use case composer: logical steps + hierarchical scenarios with dialogue and notes.
 */

export interface AIAgentLogicalStep {
  id: string;
  description: string;
}

export interface AIAgentUseCaseTurn {
  turn_id: string;
  role: 'user' | 'assistant';
  content: string;
  userEdited?: boolean;
  locked?: boolean;
}

export interface AIAgentUseCase {
  id: string;
  label: string;
  parent_id: string | null;
  sort_order: number;
  refinement_prompt: string;
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
  const t2 = newTurnId();
  return {
    id,
    label: 'Scenario principale',
    parent_id: null,
    sort_order: 0,
    refinement_prompt: '',
    dialogue: [
      { turn_id: t1, role: 'assistant', content: '' },
      { turn_id: t2, role: 'user', content: '' },
    ],
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
          dialogue.push({
            turn_id,
            role,
            content,
            userEdited: tr.userEdited === true,
            locked: tr.locked === true,
          });
        }
      }
      out.push({
        id,
        label,
        parent_id,
        sort_order,
        refinement_prompt,
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
  return {
    turn_id,
    role,
    content,
    userEdited: tr.userEdited === true,
    locked: tr.locked === true,
  };
}
