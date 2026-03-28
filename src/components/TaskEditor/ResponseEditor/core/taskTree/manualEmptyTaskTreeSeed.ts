/**
 * Builds a minimal TaskTree for manual mode when the user has no structure yet.
 * First field label is derived from the task / row title (display text).
 */

import type { TaskTree } from '@types/taskTypes';
import { createManualTaskTreeNodeWithDefaultBehaviour } from './manualDefaultBehaviourSteps';
import { ensureTaskTreeNodeIds } from './taskTreeUtils';

/** True when there is nothing to show in the sidebar / Behaviour. */
export function isTaskTreeStructurallyEmpty(tree: TaskTree | null | undefined): boolean {
  if (!tree) return true;
  const noNodes = !tree.nodes || tree.nodes.length === 0;
  const steps = tree.steps;
  const noSteps =
    !steps ||
    (typeof steps === 'object' &&
      !Array.isArray(steps) &&
      Object.keys(steps as Record<string, unknown>).length === 0);
  return noNodes && noSteps;
}

/**
 * Normalizes a title into a stable labelKey segment (lowercase snake_case, ASCII).
 */
export function slugifyManualDataKeySegment(input: string): string {
  const s = input
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return s || 'data';
}

export type GeneralizeLabelLang = 'IT' | 'EN' | 'PT' | 'ES' | 'FR' | 'DE';

/** Maps a two-letter locale string (e.g. from `project.lang`) to `generalizeLabel` language. */
export function mapLocaleToGeneralizeLabelLang(raw: string | null | undefined): GeneralizeLabelLang {
  const code = String(raw ?? 'it').trim().slice(0, 2).toUpperCase();
  const map: Record<string, GeneralizeLabelLang> = {
    IT: 'IT',
    EN: 'EN',
    PT: 'PT',
    ES: 'ES',
    FR: 'FR',
    DE: 'DE',
  };
  return map[code] ?? 'IT';
}

/**
 * Maps `project.lang` (localStorage) to the language code expected by `generalizeLabel`.
 */
export function resolveGeneralizeLabelLanguage(): GeneralizeLabelLang {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('project.lang') : null;
    return mapLocaleToGeneralizeLabelLang(raw || 'it');
  } catch {
    return 'IT';
  }
}

/**
 * One root data node; `displayTitle` should already be generalized (e.g. via generalizeLabel); labelKey is manual.<slug>.
 */
export function buildInitialManualTaskTree(displayTitle: string): TaskTree {
  const trimmed = displayTitle.trim() || 'Data';
  const slug = slugifyManualDataKeySegment(trimmed);
  const { node, treePatch } = createManualTaskTreeNodeWithDefaultBehaviour(trimmed, { required: true });
  const tree: TaskTree = {
    labelKey: `manual.${slug}`,
    nodes: [node],
    steps: {},
  };
  return ensureTaskTreeNodeIds(treePatch(tree));
}
