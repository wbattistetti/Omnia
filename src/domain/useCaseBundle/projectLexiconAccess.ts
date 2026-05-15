/**
 * Accesso al lessico slot del progetto corrente (in-memory + localStorage fallback).
 */

import {
  emptyProjectSlotLexicon,
  parseProjectSlotLexiconJson,
  serializeProjectSlotLexicon,
  type ProjectSlotLexicon,
} from './projectSlotLexicon';

const STORAGE_PREFIX = 'omnia:agentSlotLexicon:';

function projectStorageKey(projectId: string): string {
  return `${STORAGE_PREFIX}${projectId}`;
}

export function loadProjectSlotLexicon(projectId: string | null | undefined): ProjectSlotLexicon {
  if (!projectId) return emptyProjectSlotLexicon();
  try {
    const raw = localStorage.getItem(projectStorageKey(projectId));
    if (raw) return parseProjectSlotLexiconJson(raw);
  } catch {
    /* ignore */
  }
  return emptyProjectSlotLexicon();
}

export function saveProjectSlotLexicon(
  projectId: string | null | undefined,
  lexicon: ProjectSlotLexicon
): void {
  if (!projectId) return;
  try {
    localStorage.setItem(projectStorageKey(projectId), serializeProjectSlotLexicon(lexicon));
  } catch {
    /* quota */
  }
}
