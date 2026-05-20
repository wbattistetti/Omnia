/**
 * Scenario design-time: unico testo canonico sintetico (`scenario.llm`, mirror su payoff/descrittivo).
 */

import type { AIAgentUseCase, AIAgentUseCaseScenario } from '@types/aiAgentUseCases';

/** Testo scenario canonico (preferisce llm, migra da descrittivo/payoff legacy). */
export function getScenarioText(uc: AIAgentUseCase): string {
  const llm = uc.scenario?.llm?.trim();
  if (llm) return llm;
  const d = uc.scenario?.descrittivo?.trim();
  if (d) return d;
  return typeof uc.payoff === 'string' ? uc.payoff.trim() : '';
}

/** @deprecated Alias di {@link getScenarioText}. */
export const getScenarioLlmText = getScenarioText;

/** @deprecated Alias di {@link getScenarioText}. */
export const getScenarioDescrittivoText = getScenarioText;

/** @deprecated Ignora il toggle: un solo formato scenario. */
export function getScenarioDisplayText(uc: AIAgentUseCase, _useLlmFormat?: boolean): string {
  return getScenarioText(uc);
}

/** Applica modifica designer: allinea llm, descrittivo e payoff. */
export function withScenarioText(uc: AIAgentUseCase, text: string): AIAgentUseCase {
  const t = text.trim();
  const scenario: AIAgentUseCaseScenario = { descrittivo: t, llm: t };
  return { ...uc, scenario, payoff: t };
}

/** @deprecated Usare {@link withScenarioText}. */
export const withScenarioDescrittivo = withScenarioText;

/** Normalizza scenario da payload grezzo: un solo testo su tutti i campi. */
export function normalizeScenarioOnUseCase(uc: AIAgentUseCase): AIAgentUseCase {
  const text = getScenarioText(uc);
  if (!text) {
    const { scenario: _s, ...rest } = uc;
    return rest.payoff !== undefined ? { ...uc, payoff: '' } : uc;
  }
  return {
    ...uc,
    scenario: { descrittivo: text, llm: text },
    payoff: text,
  };
}
