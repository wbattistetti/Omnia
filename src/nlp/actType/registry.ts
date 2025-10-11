import { Lang, RuleSet } from './types';
import { IT_RULES } from './rules/it';
import { EN_RULES } from './rules/en';
import { PT_RULES } from './rules/pt';

const REGISTRY = new Map<Lang, RuleSet>();

export function registerLanguage(lang: Lang, rules: RuleSet) {
  REGISTRY.set(lang, rules);
}

export function getRuleSet(lang: Lang): RuleSet | undefined {
  return REGISTRY.get(lang);
}

export function getLanguageOrder(order?: Lang[]): Lang[] {
  const base: Lang[] = order && order.length ? (order as Lang[]) : ['IT', 'EN', 'PT'];
  return base.filter(l => REGISTRY.has(l));
}

// bootstrap default languages
registerLanguage('IT', IT_RULES);
registerLanguage('EN', EN_RULES);
registerLanguage('PT', PT_RULES);


