// Design-time wizard passo 3 ("tokenization"):
// tokenizeUseCases: trasforma la frase canonica assistente di ciascuno use case in uno schema
// con placeholder tra parentesi quadre (es. `[data]`, `[ora1]`, `[nome]`).
//
// Semantica:
// - i token sono INTERNI alla gente virtuale (es. ElevenLabs). NON mappano a variabili Omnia,
//   non hanno GUID, non influenzano il flow. Il nome del token è solo un hint sul TIPO di
//   dato che il runtime dovrà iniettare.
// - se la frase non ha parti variabili, viene restituita INVARIATA.
// - gli indici numerici (`[data1]`, `[data2]`) sono usati SOLO quando lo stesso tipo ricorre
//   più volte nella stessa frase, per disambiguare.
//
// Il servizio è separato da AIAgentConversationService per SRP (file < 300 righe).

const { extractJsonString } = require('./AIAgentDesignService');

const TOKENIZE_USE_CASES_TIMEOUT_MS = 180000;

const TOKENIZE_USE_CASES_SYSTEM = `You produce token templates for OMNIA virtual-agent runtime (e.g. ElevenLabs).
For each canonical assistant phrase you receive, replace ONLY the variable parts with placeholders in square brackets.

PLACEHOLDER NAMING:
- token names are lowercase alphanumeric, no spaces (e.g. [data], [ora], [nome], [importo], [durata]);
- pick a NAME that describes the TYPE of value, not its current literal (date → [data], time → [ora],
  euro amount → [importo], person name → [nome]);
- if the SAME token type appears MORE THAN ONCE in the same phrase, disambiguate with numeric
  indices (e.g. [data1], [data2], [ora1], [ora2]). Otherwise NO index.

PRESERVE EVERYTHING ELSE:
- keep all fixed words, punctuation, capitalization and whitespace EXACTLY as in the original phrase
  except where you insert a [token];
- do NOT paraphrase, do NOT translate, do NOT shorten, do NOT add or remove sentences;
- if the phrase has NO variable parts (only fixed text), return it UNCHANGED.

OUTPUT:
Respond with a single valid JSON object only (no markdown fences, no commentary).
Every use_case_id in the JSON must be a string value (quoted), never a number.`;

function buildTokenizeUseCasesUserMessage({ useCases, outputLanguage }) {
  const lang =
    typeof outputLanguage === 'string' && outputLanguage.trim()
      ? `OUTPUT_LANGUAGE (BCP 47, hint for token names when the domain matters): ${outputLanguage.trim()}\n`
      : '';
  const compact = useCases.map((u) => ({
    use_case_id: u.id,
    label: u.label,
    assistant_example: u.assistant_example,
  }));
  const compactJson = JSON.stringify(compact).slice(0, 16000);
  return `${lang}USE_CASES_TO_TOKENIZE (canonical assistant phrases — produce ONE tokenized_text per id):
${compactJson}

Task: for each entry, produce \`tokenized_text\` by replacing only the variable parts with [token]
placeholders. Keep fixed words verbatim. If no variable parts exist, copy the assistant_example as-is.

Output a single valid JSON object with this exact shape:
{
  "tokenized": [
    { "use_case_id": "<id from input>", "tokenized_text": "<text with [token] placeholders or unchanged>" },
    ...
  ]
}

Rules:
- Emit exactly one entry per use case, in the SAME order as the input.
- \`tokenized_text\` is a non-empty string.
- Square brackets must be BALANCED; no nested brackets; no empty \`[]\`.
- Token names match the regex /^[a-z][a-z0-9]*$/ (lowercase, start with a letter, alphanumeric, no spaces).
- Numeric indices only when the same token type repeats inside the same phrase.
- Do NOT include extra keys. Valid JSON only.`;
}

/**
 * Validazione locale: brackets balanced + nomi token coerenti. Difensiva: l'LLM può sbagliare e
 * la UI ha bisogno di una stringa ben formata per evidenziare i placeholder in giallo.
 *
 * @param {string} t
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
function validateTokenizedText(t) {
  if (typeof t !== 'string') return { ok: false, error: 'not a string' };
  let depth = 0;
  let cur = '';
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (ch === '[') {
      if (depth > 0) return { ok: false, error: 'nested or unclosed bracket' };
      depth = 1;
      cur = '';
      continue;
    }
    if (ch === ']') {
      if (depth !== 1) return { ok: false, error: 'unmatched close bracket' };
      if (!/^[a-z][a-z0-9]*$/.test(cur)) {
        return { ok: false, error: `invalid token name "${cur}"` };
      }
      depth = 0;
      cur = '';
      continue;
    }
    if (depth === 1) cur += ch;
  }
  if (depth !== 0) return { ok: false, error: 'unclosed bracket' };
  return { ok: true };
}

/**
 * @param {object} params
 * @param {object[]} params.useCases — array di AIAgentUseCase (richiede `id` + `dialogue` con turn assistant).
 * @param {string} [params.outputLanguage]
 * @param {string} [params.provider]
 * @param {string} [params.model]
 * @param {import('./AIProviderService')} params.aiProviderService
 * @returns {Promise<{ updates: Array<{ useCaseId: string, tokenizedText: string }> }>}
 */
async function tokenizeUseCases({
  useCases,
  outputLanguage,
  provider = 'groq',
  model,
  purpose,
  aiProviderService,
}) {
  if (!Array.isArray(useCases) || useCases.length === 0) {
    throw new Error('tokenizeUseCases: at least 1 use case required');
  }
  const compactInput = useCases.map((u) => {
    const dialogue = Array.isArray(u?.dialogue) ? u.dialogue : [];
    const assistant = dialogue.find((t) => t && t.role === 'assistant');
    return {
      id: typeof u?.id === 'string' ? u.id : '',
      label: typeof u?.label === 'string' ? u.label : '',
      assistant_example:
        assistant && typeof assistant.content === 'string' ? assistant.content : '',
    };
  });
  const filtered = compactInput.filter((u) => u.id && u.assistant_example);
  if (filtered.length === 0) {
    throw new Error(
      'tokenizeUseCases: no use case with non-empty canonical assistant phrase'
    );
  }
  const messages = [
    { role: 'system', content: TOKENIZE_USE_CASES_SYSTEM },
    {
      role: 'user',
      content: buildTokenizeUseCasesUserMessage({
        useCases: filtered,
        outputLanguage,
      }),
    },
  ];
  const maxTokens = provider === 'openai' ? 2048 : 4096;
  const response = await aiProviderService.callAI(provider, messages, {
    model: model || undefined,
    /** Temperatura bassa: la tokenizzazione deve essere conservativa e ripetibile. */
    temperature: 0.15,
    maxTokens,
    timeout: TOKENIZE_USE_CASES_TIMEOUT_MS,
    purpose,
  });
  const content = response?.choices?.[0]?.message?.content;
  const jsonStr = extractJsonString(content);
  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    const err = new Error(`Model returned non-JSON: ${e.message}`);
    err.rawSnippet = jsonStr.slice(0, 400);
    throw err;
  }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.tokenized)) {
    throw new Error('Invalid JSON: expected { tokenized: [] }');
  }
  const wantIds = new Set(filtered.map((u) => u.id));
  const updates = [];
  const seen = new Set();
  for (const row of parsed.tokenized) {
    if (!row || typeof row !== 'object') continue;
    const useCaseId =
      typeof row.use_case_id === 'string'
        ? row.use_case_id.trim()
        : typeof row.useCaseId === 'string'
          ? row.useCaseId.trim()
          : '';
    const tokenizedTextRaw =
      typeof row.tokenized_text === 'string'
        ? row.tokenized_text
        : typeof row.tokenizedText === 'string'
          ? row.tokenizedText
          : '';
    if (!useCaseId || !wantIds.has(useCaseId) || seen.has(useCaseId)) continue;
    const tokenizedText = tokenizedTextRaw.trim();
    if (!tokenizedText) continue;
    const v = validateTokenizedText(tokenizedText);
    if (!v.ok) {
      const err = new Error(
        `Invalid tokenized_text for ${useCaseId}: ${v.error}`
      );
      err.rawSnippet = tokenizedText.slice(0, 300);
      throw err;
    }
    seen.add(useCaseId);
    updates.push({ useCaseId, tokenizedText });
  }
  if (updates.length !== filtered.length) {
    throw new Error(
      `Expected ${filtered.length} tokenizations, got ${updates.length} (ids: ${[...wantIds].join(', ')})`
    );
  }
  return { updates };
}

module.exports = {
  tokenizeUseCases,
  validateTokenizedText,
  /** Esportati per i test unitari del prompt. */
  TOKENIZE_USE_CASES_SYSTEM,
};
