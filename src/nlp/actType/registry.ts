import { Lang, RuleSet } from './types';
import { getPatternCache, loadPatternsFromDatabase } from './patternLoader';

/**
 * Inizializza il registry caricando pattern dal database
 * IMPORTANTE: I pattern hardcoded sono stati disabilitati (rinominati in .disabled)
 * Il sistema ora usa SOLO i pattern dal database
 */
export async function initializeRegistry() {
  await loadPatternsFromDatabase();
}

/**
 * Ottiene il RuleSet per una lingua
 * Legge SOLO dalla cache database (pattern hardcoded disabilitati)
 */
export function getRuleSet(lang: Lang): RuleSet | undefined {
  // Legge solo dalla cache database
  return getPatternCache().get(lang);
}

export function getLanguageOrder(order?: Lang[]): Lang[] {
  const base: Lang[] = order && order.length ? (order as Lang[]) : ['IT', 'EN', 'PT'];
  const available = new Set([...getPatternCache().keys()]);
  return base.filter(l => available.has(l));
}


