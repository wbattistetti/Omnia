/**
 * Resolves the target natural language for AI Agent design output:
 * project language from localStorage (`project.lang`) when set, else browser `navigator.language`.
 */

const PROJECT_CODE_TO_BCP47: Record<string, string> = {
  it: 'it-IT',
  en: 'en-US',
  pt: 'pt-BR',
};

function normalizeProjectCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const c = raw.trim().toLowerCase();
  if (c === 'it' || c === 'en' || c === 'pt') return c;
  return null;
}

function browserLanguageTag(): string {
  if (typeof navigator === 'undefined') {
    return 'en-US';
  }
  const nav = navigator.language?.trim().replace('_', '-');
  if (nav && nav.length >= 2 && nav.length <= 20) {
    return nav;
  }
  return 'en-US';
}

export type AiAgentLanguageSource = 'project' | 'browser';

export interface ResolvedAiAgentOutputLanguage {
  /** BCP 47 tag (e.g. it-IT, en-US) for the LLM. */
  tag: string;
  source: AiAgentLanguageSource;
}

/**
 * Reads `localStorage` key `project.lang` (it|en|pt) when valid; otherwise uses `navigator.language`.
 */
export function resolveAiAgentOutputLanguage(): ResolvedAiAgentOutputLanguage {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('project.lang') : null;
    const code = normalizeProjectCode(raw);
    if (code) {
      return { tag: PROJECT_CODE_TO_BCP47[code], source: 'project' };
    }
  } catch {
    /* ignore */
  }
  return { tag: browserLanguageTag(), source: 'browser' };
}
