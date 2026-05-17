/**
 * Generazione esempi frase da varianti style token (polish combinatoria + creative).
 */

const { extractJsonString } = require('./AIAgentDesignService');

/** Regola stretta per polish / JSON runtime (non usare sul creativo). */
const STYLE_RULE_LLM_TEXT =
  'Puoi solo aggiustare la fluidità grammaticale e stilistica, senza cambiare né struttura né semantica. Non introdurre sinonimi, non aggiungere parole nuove, non modificare la semantica.';

/**
 * Regola creativa: stessi elementi semantici del template, libero stile call center.
 * Non confondere con {@link STYLE_RULE_LLM_TEXT} (rifinitura combinatoria).
 */
const CREATIVE_RULE_LLM_TEXT = `Contesto: assistente vocale di call center in italiano.
Vincolo unico: conserva tutti gli elementi semantici del template (i contenuti tra [ ] nel messaggio designer, in plain text senza quadre né «guillemet») e lo stesso intento del turno.
Libero di variare tutto il resto: formulazioni più sintetiche o più prolisse, tono cordiale/formale/neutro, struttura della frase, connettivi ed enfasi tipici del call center.
Quando produci più frasi, copri una panoramica di stili (es. conciso operativo, esplicativo rassicurante, passo-passo).
Ogni frase deve essere chiaramente diversa per un revisore umano: niente parafrasi banali né solo riordino di parole.
Non ripetere né imitare da vicino le frasi in EXISTING_PHRASES.`;

const POLISH_SYSTEM = `You polish Italian assistant message candidates for a voice agent designer.
Respond with a single valid JSON object only: { "phrases": string[] }.
Each phrase must be plain text (no brackets, no guillemets, no quotes around slots).
Apply STYLE_RULE to every phrase: only grammar and stylistic fluency; preserve meaning and structure.`;

const CREATIVE_SYSTEM = `You invent diverse Italian call-center assistant message variants for a voice-agent designer.
Respond with a single valid JSON object only: { "phrases": string[] }.
Each phrase must be plain text: keep every semantic element from the template (words inside [square brackets] in the designer template — output them without brackets or guillemets). Same turn intent as the template.
Freely rephrase everything else: concise vs verbose, warm vs neutral vs formal, typical contact-center wording and sentence shape.
When returning multiple phrases, spread across recognizable styles (short operational, reassuring explanatory, step-by-step, etc.).
Each phrase must be clearly distinct for a human reviewer — not mere word reordering or near-duplicates of EXISTING_PHRASES.
Follow CREATIVE_RULE in the user message.`;

const POLISH_TIMEOUT_MS = 120000;
const CREATIVE_TIMEOUT_MS = 90000;

function buildStyleTokensBlock(styleTokens) {
  if (!Array.isArray(styleTokens) || styleTokens.length === 0) return '';
  const map = {};
  for (const t of styleTokens) {
    if (!t || typeof t !== 'object') continue;
    const id = typeof t.styleTokenId === 'string' ? t.styleTokenId : '';
    const variants = Array.isArray(t.variants)
      ? t.variants.map((v) => String(v).trim()).filter(Boolean)
      : [];
    if (id && variants.length) map[id] = variants;
  }
  return `\nSTYLE_TOKENS (variants per slot):\n${JSON.stringify(map)}\n`;
}

function parsePhrasesArray(parsed, max = 30) {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid JSON object');
  }
  const raw = parsed.phrases;
  if (!Array.isArray(raw)) {
    throw new Error('Model JSON must include phrases array');
  }
  const out = [];
  const seen = new Set();
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const t = item.trim().replace(/\s+/g, ' ');
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Rifinisce con LLM le combinazioni già materializzate (plain o con token).
 */
async function generateStylePhrasePolish({
  template,
  styleTokens = [],
  candidatePhrases = [],
  outputLanguage,
  provider = 'groq',
  model,
  purpose,
  taskId = null,
  taskLabel = null,
  aiProviderService,
}) {
  const tmpl = typeof template === 'string' ? template.trim() : '';
  if (!tmpl) throw new Error('template is required');
  const candidates = Array.isArray(candidatePhrases)
    ? candidatePhrases.map((p) => String(p).trim()).filter(Boolean)
    : [];
  if (candidates.length === 0) {
    throw new Error('candidatePhrases must be a non-empty array');
  }

  const lang =
    typeof outputLanguage === 'string' && outputLanguage.trim()
      ? `OUTPUT_LANGUAGE: ${outputLanguage.trim()}\n`
      : '';

  const numbered = candidates.map((p, i) => `${i + 1}. ${p}`).join('\n');
  const user = `${lang}STYLE_RULE:\n${STYLE_RULE_LLM_TEXT}\n
TEMPLATE (designer message with semantic [slots] and style «slots»):\n"""\n${tmpl}\n"""${buildStyleTokensBlock(styleTokens)}
CANDIDATE_PHRASES (one polished plain phrase per line, same count and order):\n${numbered}

Return JSON { "phrases": [ ... ] } with exactly ${candidates.length} strings.`;

  const response = await aiProviderService.callAI(
    provider,
    [
      { role: 'system', content: POLISH_SYSTEM },
      { role: 'user', content: user },
    ],
    {
      model: model || undefined,
      temperature: 0.2,
      maxTokens: provider === 'openai' ? 4096 : 8192,
      timeout: POLISH_TIMEOUT_MS,
      purpose,
      taskId,
      taskLabel,
    }
  );

  const jsonStr = extractJsonString(response?.choices?.[0]?.message?.content);
  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    const err = new Error(`Model returned non-JSON: ${e.message}`);
    err.rawSnippet = jsonStr.slice(0, 400);
    throw err;
  }
  return parsePhrasesArray(parsed, candidates.length);
}

/**
 * Suggerisce nuove formulazioni oltre la combinatoria.
 */
async function generateStylePhraseCreative({
  template,
  styleTokens = [],
  existingPlainPhrases = [],
  maxPhrases = 10,
  outputLanguage,
  provider = 'groq',
  model,
  purpose,
  taskId = null,
  taskLabel = null,
  aiProviderService,
}) {
  const tmpl = typeof template === 'string' ? template.trim() : '';
  if (!tmpl) throw new Error('template is required');

  const lang =
    typeof outputLanguage === 'string' && outputLanguage.trim()
      ? `OUTPUT_LANGUAGE: ${outputLanguage.trim()}\n`
      : '';
  const existing = Array.isArray(existingPlainPhrases)
    ? existingPlainPhrases.map((p) => String(p).trim()).filter(Boolean)
    : [];
  const cap = Math.min(Math.max(1, Number(maxPhrases) || 10), 15);

  const user = `${lang}CREATIVE_RULE:\n${CREATIVE_RULE_LLM_TEXT}\n
TEMPLATE (messaggio designer; [slot semantici] e frammenti «stile»):\n"""\n${tmpl}\n"""${buildStyleTokensBlock(styleTokens)}
EXISTING_PHRASES (non ripetere né parafrasare da vicino):\n${existing.length ? existing.map((p, i) => `${i + 1}. ${p}`).join('\n') : '(nessuna)'}

Return JSON { "phrases": [ ... ] } with up to ${cap} NEW plain phrases, each with a noticeably different call-center formulation.`;

  const response = await aiProviderService.callAI(
    provider,
    [
      { role: 'system', content: CREATIVE_SYSTEM },
      { role: 'user', content: user },
    ],
    {
      model: model || undefined,
      temperature: 0.68,
      maxTokens: provider === 'openai' ? 3072 : 4096,
      timeout: CREATIVE_TIMEOUT_MS,
      purpose,
      taskId,
      taskLabel,
    }
  );

  const jsonStr = extractJsonString(response?.choices?.[0]?.message?.content);
  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    const err = new Error(`Model returned non-JSON: ${e.message}`);
    err.rawSnippet = jsonStr.slice(0, 400);
    throw err;
  }
  return parsePhrasesArray(parsed, cap);
}

module.exports = {
  STYLE_RULE_LLM_TEXT,
  CREATIVE_RULE_LLM_TEXT,
  generateStylePhrasePolish,
  generateStylePhraseCreative,
};
