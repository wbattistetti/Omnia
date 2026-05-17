/**
 * Scenario design-time: versione narrativa umana (`descrittivo`) vs sintetica LLM (`llm`).
 */

import type { AIAgentUseCase, AIAgentUseCaseScenario } from '@types/aiAgentUseCases';

/** Testo scenario per catalogo / motori LLM (sintetico se presente). */
export function getScenarioLlmText(uc: AIAgentUseCase): string {
  const llm = uc.scenario?.llm?.trim();
  if (llm) return llm;
  return getScenarioDescrittivoText(uc);
}

/** Testo scenario per designer (narrativa umana). */
export function getScenarioDescrittivoText(uc: AIAgentUseCase): string {
  const d = uc.scenario?.descrittivo?.trim();
  if (d) return d;
  return typeof uc.payoff === 'string' ? uc.payoff.trim() : '';
}

/** Testo da mostrare in UI in base al toggle toolbar. */
export function getScenarioDisplayText(uc: AIAgentUseCase, useLlmFormat: boolean): string {
  return useLlmFormat ? getScenarioLlmText(uc) : getScenarioDescrittivoText(uc);
}

/** Applica modifica umana al descrittivo; mantiene `scenario.llm` invariato. */
export function withScenarioDescrittivo(uc: AIAgentUseCase, descrittivo: string): AIAgentUseCase {
  const d = descrittivo.trim();
  const prev = uc.scenario;
  const scenario: AIAgentUseCaseScenario = {
    descrittivo: d,
    llm: prev?.llm?.trim() ?? (d ? d.slice(0, Math.min(400, d.length)) : ''),
  };
  return { ...uc, scenario, payoff: d };
}

/** Normalizza scenario da payload grezzo (parse API / legacy payoff). */
export function normalizeScenarioOnUseCase(uc: AIAgentUseCase): AIAgentUseCase {
  const descrittivo = getScenarioDescrittivoText(uc);
  const llm = uc.scenario?.llm?.trim() ?? (descrittivo ? descrittivo.slice(0, Math.min(400, descrittivo.length)) : '');
  if (!descrittivo && !llm) {
    const { scenario: _s, ...rest } = uc;
    return rest.payoff ? uc : { ...uc, payoff: '' };
  }
  return {
    ...uc,
    scenario: { descrittivo, llm },
    payoff: descrittivo,
  };
}
