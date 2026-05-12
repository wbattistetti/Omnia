// Please write clean, production-grade JavaScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

const BaseProvider = require('./BaseProvider');

/**
 * OpenAI Provider.
 *
 * Translates the application-level call options ({ model, temperature, maxTokens, ... }) into the
 * concrete `/v1/chat/completions` payload, taking into account the OpenAI model family of the
 * chosen `model`:
 *
 *   - chat models (gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo, ...):
 *       accept temperature, top_p, penalties, and `response_format: { type: 'json_object' }`;
 *       use `max_completion_tokens` as the output budget (the legacy `max_tokens` still works but
 *       is deprecated in favor of `max_completion_tokens`, so we always emit the new name).
 *
 *   - reasoning models (o-series, gpt-5*, gpt-4.1*):
 *       require `max_completion_tokens` and reject `max_tokens`. They also reject
 *       `temperature != 1`, `top_p`, frequency/presence penalties and `response_format:
 *       'json_object'`. The JSON contract is therefore enforced via the prompt only.
 *
 *       `max_completion_tokens` is the *combined* budget for invisible reasoning tokens AND the
 *       visible message content. With small budgets (e.g. 4096) the reasoning step exhausts the
 *       budget and the model returns `message.content === ''` ("Empty model response" upstream).
 *       We mitigate this with two safety nets, both overridable by the caller:
 *         a) `reasoning_effort: 'low'` — small but non-zero so the model produces the textual
 *            content the caller asked for (`'minimal'` was observed to skip narrative fields like
 *            `dialogue[].content` for design-time use case generation, leaving empty bubbles).
 *            Override via `options.reasoningEffort` when a task truly needs deeper reasoning.
 *         b) a floor on `max_completion_tokens` (`REASONING_OUTPUT_FLOOR`) so the content always
 *            has room to be emitted even if the caller passed a chat-tuned budget.
 *         c) one automatic retry with a larger budget if OpenAI returns HTTP 200 but no visible
 *            message content (most commonly `finish_reason: "length"`).
 *
 * Application services do NOT need to know about this distinction — they keep calling
 * `aiProviderService.callAI(provider, messages, { model, temperature, maxTokens, ... })`.
 */

/**
 * Minimum output budget we send for reasoning models when the caller didn't ask for more.
 * Must be large enough to fit reasoning + JSON content. gpt-5 supports up to 128k, and unused
 * budget is not charged as generated tokens.
 */
const REASONING_OUTPUT_FLOOR = 32768;
const REASONING_RETRY_OUTPUT_BUDGET = 65536;

function normalizeMessageContent(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((part) => {
      if (!part || typeof part !== 'object') return '';
      if (typeof part.text === 'string') return part.text;
      if (part.type === 'text' && typeof part.content === 'string') return part.content;
      return '';
    })
    .join('');
}

function getVisibleAssistantContent(response) {
  return normalizeMessageContent(response?.choices?.[0]?.message?.content).trim();
}

/**
 * Coerce `choices[0].message.content` into a plain string when the SDK returns it as a content
 * parts array (reasoning models occasionally do). Downstream callers parse JSON from that field
 * and would otherwise see "Empty model response" even though the text is right there.
 */
function coerceResponseContentToString(response) {
  const choice = response?.choices?.[0];
  if (!choice || !choice.message) return response;
  const visible = normalizeMessageContent(choice.message.content);
  if (visible) {
    choice.message.content = visible;
  }
  return response;
}

function describeEmptyResponse(response, payload) {
  const choice = response?.choices?.[0] || {};
  const usage = response?.usage || {};
  return [
    `model=${payload.model}`,
    `finish_reason=${choice.finish_reason ?? 'n/a'}`,
    `max_completion_tokens=${payload.max_completion_tokens ?? 'n/a'}`,
    `reasoning_effort=${payload.reasoning_effort ?? 'n/a'}`,
    `prompt_tokens=${usage.prompt_tokens ?? 'n/a'}`,
    `completion_tokens=${usage.completion_tokens ?? 'n/a'}`,
    `reasoning_tokens=${usage.completion_tokens_details?.reasoning_tokens ?? 'n/a'}`,
    `total_tokens=${usage.total_tokens ?? 'n/a'}`,
  ].join(', ');
}

/**
 * Best-effort one-line description of `choices[0].message`. Useful when the API replies HTTP 200
 * but the upstream parser sees nothing: we want to know whether the field was missing, an empty
 * string, an array of N parts, or some unexpected shape.
 */
function describeMessageShape(response) {
  const message = response?.choices?.[0]?.message;
  if (!message || typeof message !== 'object') {
    return `message=missing(${typeof message})`;
  }
  const content = message.content;
  if (typeof content === 'string') {
    return `content=string(len=${content.length})`;
  }
  if (Array.isArray(content)) {
    const types = content.map((p) => (p && typeof p === 'object' ? p.type || 'unknown' : typeof p));
    const totalTextLen = content.reduce((n, p) => {
      if (!p || typeof p !== 'object') return n;
      if (typeof p.text === 'string') return n + p.text.length;
      if (typeof p.content === 'string') return n + p.content.length;
      return n;
    }, 0);
    return `content=array(parts=${content.length}, types=[${types.join(',')}], textLen=${totalTextLen})`;
  }
  if (content === null || content === undefined) {
    const refusal = typeof message.refusal === 'string' ? `, refusal=${message.refusal.slice(0, 120)}` : '';
    return `content=${content}${refusal}`;
  }
  return `content=other(${typeof content})`;
}
class OpenAIProvider extends BaseProvider {
  constructor(apiKey) {
    if (!apiKey) {
      throw new Error('Missing OpenAI API key.');
    }
    super(apiKey, 'https://api.openai.com/v1');
  }

  /**
   * Build the chat-completions payload for the given model + options. Pure helper exposed so we
   * can unit-test the per-profile translation without doing any HTTP.
   *
   * @param {Array<object>} messages
   * @param {object} options
   * @returns {object} payload ready to JSON.stringify
   */
  buildChatCompletionsPayload(messages, options = {}) {
    if (!options.model) {
      throw new Error(
        'OpenAIProvider: missing `model`. Set one in Settings > Omnia Tutor (no implicit default).'
      );
    }

    const profile = OpenAIProvider.getModelProfile(options.model);
    const payload = { model: options.model, messages };

    const requestedBudget =
      typeof options.maxTokens === 'number' && Number.isFinite(options.maxTokens)
        ? options.maxTokens
        : null;
    if (profile.isReasoning) {
      payload.max_completion_tokens = Math.max(requestedBudget ?? 0, REASONING_OUTPUT_FLOOR);
      payload.reasoning_effort = options.reasoningEffort || 'low';
    } else if (requestedBudget !== null) {
      payload.max_completion_tokens = requestedBudget;
    }

    if (profile.supportsTemperature && typeof options.temperature === 'number') {
      payload.temperature = options.temperature;
    }

    if (profile.supportsJsonObjectResponseFormat) {
      payload.response_format = { type: 'json_object' };
    }

    if (profile.supportsTopP && typeof options.top_p === 'number') {
      payload.top_p = options.top_p;
    }

    if (profile.supportsPenalties && typeof options.frequency_penalty === 'number') {
      payload.frequency_penalty = options.frequency_penalty;
    }

    if (profile.supportsPenalties && typeof options.presence_penalty === 'number') {
      payload.presence_penalty = options.presence_penalty;
    }

    return payload;
  }

  /**
   * Classify an OpenAI model id into a capability profile. Pattern-based on the documented
   * naming conventions (o-series, gpt-5*, gpt-4.1*). Adding a new model that follows the same
   * naming requires no code change. New families (e.g. unexpected suffixes) should be added here
   * with an explicit test.
   *
   * @param {string} model
   */
  static getModelProfile(model) {
    const id = String(model || '').trim().toLowerCase();
    const isReasoning =
      /^o\d/.test(id) || id.startsWith('gpt-5') || id.startsWith('gpt-4.1');
    return {
      isReasoning,
      supportsTemperature: !isReasoning,
      supportsTopP: !isReasoning,
      supportsPenalties: !isReasoning,
      supportsJsonObjectResponseFormat: !isReasoning,
    };
  }

  async call(messages, options = {}) {
    const payload = this.buildChatCompletionsPayload(messages, options);
    const profile = OpenAIProvider.getModelProfile(payload.model);
    const rawFirst = await this.makeRequest('/chat/completions', payload, options);
    const first = coerceResponseContentToString(rawFirst);

    if (getVisibleAssistantContent(first)) {
      return first;
    }

    if (!profile.isReasoning) {
      console.warn(
        `[OpenAIProvider] Chat model returned no visible content (${describeMessageShape(first)}; ${describeEmptyResponse(first, payload)})`
      );
      return first;
    }

    const retryPayload = {
      ...payload,
      max_completion_tokens: Math.max(
        payload.max_completion_tokens || 0,
        options.reasoningRetryMaxTokens || REASONING_RETRY_OUTPUT_BUDGET
      ),
    };
    console.warn(
      `[OpenAIProvider] Empty reasoning response; retrying with larger budget (${describeMessageShape(first)}; ${describeEmptyResponse(first, payload)})`
    );
    const rawSecond = await this.makeRequest('/chat/completions', retryPayload, {
      ...options,
      retryOfEmptyReasoningResponse: true,
    });
    const second = coerceResponseContentToString(rawSecond);

    if (!getVisibleAssistantContent(second)) {
      const diag = `${describeMessageShape(second)}; ${describeEmptyResponse(second, retryPayload)}`;
      console.error(`[OpenAIProvider] Reasoning retry still empty (${diag})`);
      throw new Error(`OpenAIProvider empty reasoning response after retry (${diag})`);
    }

    return second;
  }

  validateApiKey() {
    return super.validateApiKey() && this.apiKey.startsWith('sk-');
  }

  getProviderInfo() {
    return {
      name: 'OpenAI',
      version: '2.0.0',
      baseUrl: this.baseUrl,
    };
  }
}

module.exports = OpenAIProvider;
