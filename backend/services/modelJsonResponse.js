/**
 * Parse JSON objects from LLM chat completion responses (fence strip + truncation hints).
 */

const { extractJsonString } = require('./AIAgentDesignService');

/**
 * @param {unknown} response OpenAI-style chat completion
 * @returns {string|null}
 */
function getAssistantFinishReason(response) {
  const reason = response?.choices?.[0]?.finish_reason;
  return typeof reason === 'string' ? reason : null;
}

/**
 * Heuristic: incomplete JSON (unclosed string/brackets) — typical of max_tokens truncation.
 * @param {string} jsonStr
 */
function isLikelyTruncatedJson(jsonStr) {
  if (typeof jsonStr !== 'string' || !jsonStr.trim()) return false;
  const t = jsonStr.trimEnd();
  if (t.endsWith('}')) {
    try {
      JSON.parse(t);
      return false;
    } catch {
      /* fall through */
    }
  }
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (inString) {
      if (escape) escape = false;
      else if (c === '\\') escape = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === '{' || c === '[') depth += 1;
    else if (c === '}' || c === ']') depth -= 1;
  }
  if (inString) return true;
  if (depth !== 0) return true;
  return !t.endsWith('}');
}

/**
 * @param {unknown} response
 * @param {{ errorLabel?: string }} [opts]
 * @returns {{
 *   ok: true,
 *   parsed: unknown,
 *   jsonStr: string,
 *   finishReason: string|null,
 * } | {
 *   ok: false,
 *   stage: 'extract' | 'parse',
 *   error: Error,
 *   jsonStr?: string,
 *   finishReason: string|null,
 *   truncated: boolean,
 * }}
 */
function extractAndParseModelJson(response, opts = {}) {
  const errorLabel = opts.errorLabel || 'Model';
  const finishReason = getAssistantFinishReason(response);
  const content = response?.choices?.[0]?.message?.content;
  let jsonStr;
  try {
    jsonStr = extractJsonString(content);
  } catch (e) {
    return {
      ok: false,
      stage: 'extract',
      error: e instanceof Error ? e : new Error(String(e)),
      finishReason,
      truncated: finishReason === 'length',
    };
  }
  const truncatedHint = finishReason === 'length' || isLikelyTruncatedJson(jsonStr);
  try {
    const parsed = JSON.parse(jsonStr);
    return { ok: true, parsed, jsonStr, finishReason };
  } catch (e) {
    const parseErr = e instanceof Error ? e : new Error(String(e));
    return {
      ok: false,
      stage: 'parse',
      error: new Error(`${errorLabel} returned non-JSON: ${parseErr.message}`),
      jsonStr,
      finishReason,
      truncated: truncatedHint,
    };
  }
}

/**
 * Build a user-message suffix for a second attempt after truncation.
 * @param {number} lo
 * @param {number} hi
 */
function buildCompactJsonRetryDirective(lo, hi) {
  return `\nOUTPUT_RETRY (mandatory): Your previous answer was cut off before the JSON object ended. Return ONE complete valid JSON object only. Target **${lo}–${hi}** use_cases (do not exceed ${hi}). Keep each "scenario.descrittivo" to at most 3 short sentences; "scenario.llm" at most 2 telegraphic lines; assistant "dialogue"[0]."content" exactly one short sentence. Use 6–8 "logical_steps" with brief descriptions. Close every array and the root object — no commentary after the closing brace.\n`;
}

/** Second/third attempt after invalid JSON (syntax, unescaped quotes, trailing commas). */
function buildStrictJsonRetryDirective() {
  return `\nOUTPUT_RETRY (mandatory): Your previous response was NOT valid JSON. Return exactly ONE JSON object, nothing else — no markdown fences, no commentary before or after. Escape every double-quote character inside string values with a backslash. No trailing commas. Every property name must be double-quoted. Verify the output parses with JSON.parse before you finish.\n`;
}

/**
 * @param {number} maxAttempts
 * @param {boolean} chunkedPipeline
 */
function shouldRetryModelJsonParse(attemptIndex, maxAttempts, chunkedPipeline) {
  return attemptIndex < maxAttempts - 1 && chunkedPipeline;
}

/**
 * @param {{ error: Error, stage?: string, jsonStr?: string, truncated?: boolean }} lastFail
 */
function throwModelJsonParseFailure(lastFail) {
  const err = lastFail.error instanceof Error ? lastFail.error : new Error(String(lastFail.error));
  if (lastFail.stage === 'parse' && lastFail.jsonStr) {
    err.rawSnippet = lastFail.jsonStr.slice(0, 500);
  }
  if (lastFail.truncated) {
    err.code = 'AI_JSON_TRUNCATED';
  } else if (lastFail.stage === 'parse') {
    err.code = 'AI_JSON_PARSE_FAILED';
  }
  const hint = lastFail.truncated
    ? ' La risposta del modello è stata probabilmente troncata (limite token in uscita).'
    : ' Il modello ha restituito JSON non valido (virgolette, testo troncato o sintassi errata).';
  err.message = `${err.message}${hint} Riprova la generazione; se hai già scenari in lista, salva e usa «Crea altri use case».`;
  throw err;
}

module.exports = {
  getAssistantFinishReason,
  isLikelyTruncatedJson,
  extractAndParseModelJson,
  buildCompactJsonRetryDirective,
  buildStrictJsonRetryDirective,
  shouldRetryModelJsonParse,
  throwModelJsonParseFailure,
};
