/**
 * Normalizza `scenario` su use case design-time: testo canonico sintetico (`llm`), mirror su descrittivo/payoff.
 */

const MAX_SCENARIO = 2000;

/**
 * @param {unknown} raw
 * @returns {{ descrittivo: string, llm: string }}
 */
function parseScenarioObject(raw) {
  let descrittivo = '';
  let llm = '';
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw;
    if (typeof o.llm === 'string' && o.llm.trim()) {
      llm = o.llm.trim().slice(0, MAX_SCENARIO);
    }
    if (typeof o.descrittivo === 'string' && o.descrittivo.trim()) {
      descrittivo = o.descrittivo.trim().slice(0, MAX_SCENARIO);
    }
  }
  return { descrittivo, llm };
}

/**
 * @param {object} uc
 * @returns {object}
 */
function normalizeUseCaseScenarioFields(uc) {
  if (!uc || typeof uc !== 'object') return uc;
  const fromScenario = parseScenarioObject(uc.scenario);
  let text = fromScenario.llm || fromScenario.descrittivo;
  if (!text && typeof uc.payoff === 'string' && uc.payoff.trim()) {
    text = uc.payoff.trim().slice(0, MAX_SCENARIO);
  }
  if (!text && typeof uc.description === 'string' && uc.description.trim()) {
    text = uc.description.trim().slice(0, MAX_SCENARIO);
  }
  const scenario = { descrittivo: text, llm: text };
  const payoff = text;
  return { ...uc, scenario, payoff };
}

/**
 * Testo scenario per prompt LLM (catalogo, riordino, conversazioni).
 * @param {object} uc
 */
function scenarioTextForLlm(uc) {
  if (!uc || typeof uc !== 'object') return '';
  const sc = parseScenarioObject(uc.scenario);
  if (sc.llm) return sc.llm;
  if (sc.descrittivo) return sc.descrittivo;
  if (typeof uc.payoff === 'string') return uc.payoff.trim();
  return '';
}

module.exports = {
  normalizeUseCaseScenarioFields,
  scenarioTextForLlm,
  parseScenarioObject,
};
