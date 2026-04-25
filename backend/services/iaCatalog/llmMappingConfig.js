/**
 * Persistenza `config/llmMapping.json`: modelli LLM ConvAI ammessi per lingue non inglesi (solo ElevenLabs).
 */

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '../../../config/llmMapping.json');

const DEFAULT_ELEVENLABS = {
  /** Array vuoto = nessun filtro globale; i modelli ConvAI (`model_id` da GET /convai/llm/list) sono selezionabili liberamente. */
  nonEnglishAllowedModels: [],
  perLanguage: {},
};

function deepClone(o) {
  return JSON.parse(JSON.stringify(o));
}

/** Dedup + trim, come il frontend `normalizeModelIdList`. */
function normalizeModelIdList(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((x) => String(x).trim()).filter(Boolean))];
}

function readLlmMapping() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    const j = JSON.parse(raw);
    const eleven = j && typeof j.elevenlabs === 'object' && j.elevenlabs ? j.elevenlabs : {};
    const nonEnglish = Array.isArray(eleven.nonEnglishAllowedModels)
      ? eleven.nonEnglishAllowedModels.map((x) => String(x).trim()).filter(Boolean)
      : [];
    const perLanguage =
      eleven.perLanguage && typeof eleven.perLanguage === 'object' && !Array.isArray(eleven.perLanguage)
        ? eleven.perLanguage
        : {};
    return {
      ok: true,
      path: CONFIG_PATH,
      mapping: {
        elevenlabs: {
          nonEnglishAllowedModels: nonEnglish,
          perLanguage,
        },
      },
    };
  } catch (e) {
    return {
      ok: false,
      path: CONFIG_PATH,
      error: String(e.message || e),
      mapping: { elevenlabs: deepClone(DEFAULT_ELEVENLABS) },
    };
  }
}

/**
 * Lista id ammessi per lingua agente (BCP-47 o ISO).
 * - `null` = nessun filtro (manca lingua o inglese).
 * - Se `perLanguage[locale]` esiste ed è un array, si usa quello anche se vuoto (nessun modello ammesso).
 * - Allineato a `effectiveAllowedForLocale` nel frontend: nessun `||` che ignori `[]`.
 */
function allowedElevenLabsModelIdsForLanguage(agentLanguage) {
  if (!agentLanguage || !String(agentLanguage).trim()) return null;
  const full = String(agentLanguage).trim();
  const primary = full.toLowerCase().split('-')[0];
  if (primary === 'en') return null;

  const { mapping } = readLlmMapping();
  const el = mapping.elevenlabs;
  const perLanguage =
    el.perLanguage && typeof el.perLanguage === 'object' && !Array.isArray(el.perLanguage)
      ? el.perLanguage
      : {};
  const nonEnglish = Array.isArray(el.nonEnglishAllowedModels) ? el.nonEnglishAllowedModels : [];

  if (Object.prototype.hasOwnProperty.call(perLanguage, full)) {
    const v = perLanguage[full];
    if (Array.isArray(v)) return normalizeModelIdList(v);
  }
  if (Object.prototype.hasOwnProperty.call(perLanguage, primary)) {
    const v = perLanguage[primary];
    if (Array.isArray(v)) return normalizeModelIdList(v);
  }
  const samePrimary = Object.keys(perLanguage).filter((k) => {
    const pk = String(k)
      .trim()
      .toLowerCase()
      .split('-')[0];
    return pk === primary;
  });
  if (samePrimary.length > 0) {
    samePrimary.sort((a, b) => {
      const ra = a.split('-').filter(Boolean).length;
      const rb = b.split('-').filter(Boolean).length;
      if (rb !== ra) return rb - ra;
      return b.length - a.length;
    });
    const v = perLanguage[samePrimary[0]];
    if (Array.isArray(v)) return normalizeModelIdList(v);
  }
  const globalList = normalizeModelIdList(nonEnglish);
  return globalList.length > 0 ? globalList : null;
}

function validateElevenlabsMapping(body, catalogModelIds) {
  const ids = (catalogModelIds || []).map((x) => String(x).trim()).filter(Boolean);
  const allowed = new Set(ids);
  const el = body && typeof body.elevenlabs === 'object' ? body.elevenlabs : {};
  const ne = Array.isArray(el.nonEnglishAllowedModels)
    ? el.nonEnglishAllowedModels.map((x) => String(x).trim()).filter(Boolean)
    : [];
  const per = el.perLanguage && typeof el.perLanguage === 'object' && !Array.isArray(el.perLanguage) ? el.perLanguage : {};
  for (const id of ne) {
    if (!allowed.has(id)) {
      return { ok: false, message: `Modello non nel catalogo sync: ${id}` };
    }
  }
  for (const loc of Object.keys(per)) {
    const arr = Array.isArray(per[loc]) ? per[loc].map((x) => String(x).trim()).filter(Boolean) : [];
    for (const id of arr) {
      if (!allowed.has(id)) {
        return { ok: false, message: `perLanguage[${loc}]: modello non nel catalogo: ${id}` };
      }
    }
  }
  return { ok: true };
}

function writeLlmMapping(body) {
  const out = {
    elevenlabs: {
      nonEnglishAllowedModels: Array.isArray(body?.elevenlabs?.nonEnglishAllowedModels)
        ? body.elevenlabs.nonEnglishAllowedModels.map((x) => String(x).trim()).filter(Boolean)
        : DEFAULT_ELEVENLABS.nonEnglishAllowedModels,
      perLanguage:
        body?.elevenlabs?.perLanguage && typeof body.elevenlabs.perLanguage === 'object'
          ? body.elevenlabs.perLanguage
          : {},
    },
  };
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
  return out;
}

module.exports = {
  readLlmMapping,
  writeLlmMapping,
  allowedElevenLabsModelIdsForLanguage,
  validateElevenlabsMapping,
  CONFIG_PATH,
};
