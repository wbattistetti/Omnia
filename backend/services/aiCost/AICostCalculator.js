/**
 * Pure cost calculator: maps an LLM response `usage` block + `(provider, model)` to a normalized
 * cost record (USD always, EUR opportunistic via the cached FX rate).
 *
 * Token accounting is provider-shaped, so we normalize first:
 *  - OpenAI / Groq:  `{ prompt_tokens, completion_tokens, ... }`
 *  - Anthropic:      `{ input_tokens, output_tokens, ... }`
 *  - Google Gemini:  `{ promptTokenCount, candidatesTokenCount, ... }`
 *
 * No I/O here (FX is read from the in-memory cache snapshot exposed by `exchangeRateSync`).
 * Free / unknown models -> `costUsd = 0` per product policy (no exception, no warning).
 */

const { lookupPricing } = require('./pricingSync');
const { getCachedUsdToEur } = require('./exchangeRateSync');

const ZERO_TOKENS = Object.freeze({ inputTokens: 0, outputTokens: 0, totalTokens: 0 });

function normalizeUsage(providerId, rawUsage) {
  if (!rawUsage || typeof rawUsage !== 'object') return { ...ZERO_TOKENS };
  if (providerId === 'anthropic') {
    const i = Number(rawUsage.input_tokens) || 0;
    const o = Number(rawUsage.output_tokens) || 0;
    return { inputTokens: i, outputTokens: o, totalTokens: i + o };
  }
  if (providerId === 'google') {
    const i = Number(rawUsage.promptTokenCount) || 0;
    const o = Number(rawUsage.candidatesTokenCount) || 0;
    const t = Number(rawUsage.totalTokenCount);
    return {
      inputTokens: i,
      outputTokens: o,
      totalTokens: Number.isFinite(t) ? t : i + o,
    };
  }
  const i = Number(rawUsage.prompt_tokens) || 0;
  const o = Number(rawUsage.completion_tokens) || 0;
  const t = Number(rawUsage.total_tokens);
  return {
    inputTokens: i,
    outputTokens: o,
    totalTokens: Number.isFinite(t) ? t : i + o,
  };
}

function extractUsageFromResponse(providerId, response) {
  if (!response || typeof response !== 'object') return null;
  if (providerId === 'google') {
    return response.usageMetadata || null;
  }
  return response.usage || null;
}

/**
 * Pure cost calculation given an explicit pricing entry and FX rate. No I/O — testable in
 * isolation. The wrapper {@link computeCallCost} resolves the pricing/FX from disk-backed caches
 * and forwards here.
 *
 * @param {object} args
 * @param {string} args.providerId
 * @param {string} args.modelId
 * @param {object} args.response
 * @param {object|null} args.pricingEntry  result of `lookupPricing(...)`, or null when missing
 * @param {number|null} args.usdToEur       cached FX rate, or null when not yet fetched
 */
function computeCostWithDeps({ providerId, modelId, response, pricingEntry, usdToEur }) {
  void modelId;
  const usage = extractUsageFromResponse(providerId, response);
  const tokens = normalizeUsage(providerId, usage);

  if (!pricingEntry) {
    return {
      ...tokens,
      costUsd: 0,
      costEur: usdToEur !== null ? 0 : null,
      pricingFound: false,
      inputUsdPer1M: null,
      outputUsdPer1M: null,
      usdToEur,
    };
  }

  const costUsd =
    (tokens.inputTokens * pricingEntry.inputUsdPer1M +
      tokens.outputTokens * pricingEntry.outputUsdPer1M) /
    1_000_000;
  const costEur = usdToEur !== null ? costUsd * usdToEur : null;

  return {
    ...tokens,
    costUsd,
    costEur,
    pricingFound: true,
    inputUsdPer1M: pricingEntry.inputUsdPer1M,
    outputUsdPer1M: pricingEntry.outputUsdPer1M,
    usdToEur,
  };
}

/**
 * Compute USD/EUR cost for a single LLM call. Reads pricing and FX from the on-disk caches
 * (`pricingSync` and `exchangeRateSync`) — for testability prefer {@link computeCostWithDeps}.
 *
 * @param {object} args
 * @param {string} args.providerId       'openai' | 'groq' | 'anthropic' | 'google'
 * @param {string} args.modelId          model id passed to the provider (e.g. 'gpt-5')
 * @param {object} args.response         raw provider response object
 */
function computeCallCost({ providerId, modelId, response }) {
  return computeCostWithDeps({
    providerId,
    modelId,
    response,
    pricingEntry: lookupPricing(providerId, modelId),
    usdToEur: getCachedUsdToEur(),
  });
}

module.exports = {
  computeCallCost,
  computeCostWithDeps,
  normalizeUsage,
  extractUsageFromResponse,
};
