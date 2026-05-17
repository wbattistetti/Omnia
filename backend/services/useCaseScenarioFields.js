/**
 * Normalizza `scenario` { descrittivo, llm } e `payoff` (alias descrittivo) su use case design-time.
 */

const MAX_DESCRITTIVO = 8000;
const MAX_LLM = 2000;

/**
 * @param {unknown} raw
 * @returns {{ descrittivo: string, llm: string }}
 */
function parseScenarioObject(raw) {
  let descrittivo = '';
  let llm = '';
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw;
    if (typeof o.descrittivo === 'string' && o.descrittivo.trim()) {
      descrittivo = o.descrittivo.trim().slice(0, MAX_DESCRITTIVO);
    }
    if (typeof o.llm === 'string' && o.llm.trim()) {
      llm = o.llm.trim().slice(0, MAX_LLM);
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
  let descrittivo = fromScenario.descrittivo;
  let llm = fromScenario.llm;
  if (!descrittivo && typeof uc.payoff === 'string' && uc.payoff.trim()) {
    descrittivo = uc.payoff.trim().slice(0, MAX_DESCRITTIVO);
  }
  if (!descrittivo && typeof uc.description === 'string' && uc.description.trim()) {
    descrittivo = uc.description.trim().slice(0, MAX_DESCRITTIVO);
  }
  if (!llm && descrittivo) {
    llm = descrittivo.slice(0, Math.min(400, MAX_LLM));
  }
  const scenario = { descrittivo, llm };
  const payoff = descrittivo;
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
