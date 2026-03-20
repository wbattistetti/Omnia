/**
 * Bridges Task.semanticValues (with optional embedding profile) and ProblemIntent-shaped
 * data used by the embedding editor UI and legacy call sites.
 */

import type { Task, SemanticValue } from '@types/taskTypes';
import type { ProblemIntent, ProblemPayload } from '@types/project';

export function semanticValuesToProblemIntents(
  values: SemanticValue[] | null | undefined
): ProblemIntent[] {
  if (!values?.length) return [];
  return values.map((sv) => ({
    id: sv.id,
    name: sv.label,
    threshold: sv.embedding?.threshold ?? 0.6,
    phrases: {
      matching: sv.embedding?.phrases?.matching ?? [],
      notMatching: sv.embedding?.phrases?.notMatching ?? [],
      keywords: sv.embedding?.phrases?.keywords ?? [],
    },
  }));
}

export function problemIntentsToSemanticValues(
  intents: ProblemIntent[],
  previous?: SemanticValue[] | null
): SemanticValue[] {
  const prevById = new Map((previous ?? []).map((s) => [s.id, s]));
  return intents.map((pi) => {
    const prev = prevById.get(pi.id);
    const phrases = pi.phrases ?? {
      matching: [],
      notMatching: [],
      keywords: [],
    };
    return {
      id: pi.id,
      label: pi.name,
      embedding: {
        threshold: pi.threshold,
        enabled: prev?.embedding?.enabled ?? true,
        phrases,
      },
    };
  });
}

/**
 * Moves legacy `intents` / `task.intents` into semanticValues and removes intents from the object.
 * Safe to call multiple times (no-op if no legacy intents).
 */
export function migrateLegacyIntentsOnTask(task: Task): void {
  const legacy = (task as any).intents;
  if (!Array.isArray(legacy) || legacy.length === 0) {
    delete (task as any).intents;
    return;
  }

  const existing = Array.isArray(task.semanticValues) ? [...task.semanticValues] : [];
  const byId = new Map(existing.map((s) => [s.id, s]));

  for (const raw of legacy) {
    if (!raw || typeof raw !== 'object') continue;
    const pi = raw as ProblemIntent;
    const id = pi.id;
    if (!id) continue;
    const name = (pi.name ?? '').trim();
    const phrases = pi.phrases ?? {
      matching: [],
      notMatching: [],
      keywords: [],
    };
    const cur = byId.get(id);
    if (cur) {
      byId.set(id, {
        ...cur,
        label: name || cur.label,
        embedding: {
          threshold: pi.threshold ?? cur.embedding?.threshold,
          enabled: cur.embedding?.enabled ?? true,
          phrases,
        },
      });
    } else {
      byId.set(id, {
        id,
        label: name || id,
        embedding: {
          threshold: pi.threshold ?? 0.6,
          enabled: true,
          phrases,
        },
      });
    }
  }

  task.semanticValues = Array.from(byId.values());
  delete (task as any).intents;
}

/** Normalize persisted problem blob (localStorage / task.problem) after removing intents from model. */
export function normalizeProblemPayload(raw: unknown): ProblemPayload {
  if (!raw || typeof raw !== 'object') {
    return { version: 1, semanticValues: [], editor: undefined };
  }
  const r = raw as Record<string, unknown>;
  if (r.version !== 1) {
    return { version: 1, semanticValues: [], editor: r.editor as ProblemPayload['editor'] };
  }
  if (Array.isArray(r.semanticValues)) {
    return {
      version: 1,
      semanticValues: r.semanticValues as SemanticValue[],
      editor: r.editor as ProblemPayload['editor'],
    };
  }
  if (Array.isArray(r.intents)) {
    return {
      version: 1,
      semanticValues: problemIntentsToSemanticValues(r.intents as ProblemIntent[], []),
      editor: r.editor as ProblemPayload['editor'],
    };
  }
  return { version: 1, semanticValues: [], editor: r.editor as ProblemPayload['editor'] };
}
