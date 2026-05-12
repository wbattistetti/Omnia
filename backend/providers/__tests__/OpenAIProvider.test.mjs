// Please write clean, production-grade JavaScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Unit tests for OpenAIProvider's payload translation. Targets the pure helper
 * `buildChatCompletionsPayload` and the static `getModelProfile`, so we don't need to mock the
 * network: no `fetch` is touched.
 *
 * Run: `npx vitest run backend/providers/__tests__/OpenAIProvider.test.mjs`.
 */

import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const OpenAIProvider = require('../OpenAIProvider.js');

function newProvider() {
  return new OpenAIProvider('sk-test');
}

const MESSAGES = [
  { role: 'system', content: 'sys' },
  { role: 'user', content: 'hi' },
];

describe('OpenAIProvider.getModelProfile', () => {
  it('classifies reasoning families (o-series, gpt-5, gpt-4.1)', () => {
    const reasoningIds = ['o1-mini', 'o3-mini', 'o4-mini', 'gpt-5', 'gpt-5-mini', 'gpt-4.1'];
    for (const id of reasoningIds) {
      const profile = OpenAIProvider.getModelProfile(id);
      expect(profile.isReasoning, id).toBe(true);
      expect(profile.supportsTemperature, id).toBe(false);
      expect(profile.supportsTopP, id).toBe(false);
      expect(profile.supportsPenalties, id).toBe(false);
      expect(profile.supportsJsonObjectResponseFormat, id).toBe(false);
    }
  });

  it('classifies legacy chat families (gpt-4o, gpt-4-turbo, gpt-3.5)', () => {
    const chatIds = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'];
    for (const id of chatIds) {
      const profile = OpenAIProvider.getModelProfile(id);
      expect(profile.isReasoning, id).toBe(false);
      expect(profile.supportsTemperature, id).toBe(true);
      expect(profile.supportsJsonObjectResponseFormat, id).toBe(true);
    }
  });
});

describe('OpenAIProvider.buildChatCompletionsPayload', () => {
  it('throws fail-loud when model is missing (no implicit hardcoded default)', () => {
    const provider = newProvider();
    expect(() => provider.buildChatCompletionsPayload(MESSAGES, {})).toThrow(/missing `model`/);
  });

  it('emits max_completion_tokens (never max_tokens) for reasoning models, plus reasoning_effort', () => {
    const provider = newProvider();
    const payload = provider.buildChatCompletionsPayload(MESSAGES, {
      model: 'gpt-5',
      maxTokens: 40000,
      temperature: 0.5,
      top_p: 0.9,
      frequency_penalty: 0.2,
      presence_penalty: 0.1,
    });
    expect(payload.model).toBe('gpt-5');
    expect(payload.max_completion_tokens).toBe(40000);
    expect(payload.reasoning_effort).toBe('low');
    expect(payload).not.toHaveProperty('max_tokens');
    expect(payload).not.toHaveProperty('temperature');
    expect(payload).not.toHaveProperty('response_format');
    expect(payload).not.toHaveProperty('top_p');
    expect(payload).not.toHaveProperty('frequency_penalty');
    expect(payload).not.toHaveProperty('presence_penalty');
  });

  it('floors the output budget for reasoning models so content is not starved by reasoning tokens', () => {
    const provider = newProvider();
    const payload = provider.buildChatCompletionsPayload(MESSAGES, {
      model: 'gpt-5-mini',
      maxTokens: 2048,
    });
    expect(payload.max_completion_tokens).toBeGreaterThanOrEqual(32768);
    expect(payload.reasoning_effort).toBe('low');
  });

  it('still applies the reasoning floor when maxTokens is omitted entirely', () => {
    const provider = newProvider();
    const payload = provider.buildChatCompletionsPayload(MESSAGES, { model: 'o3-mini' });
    expect(payload.max_completion_tokens).toBeGreaterThanOrEqual(32768);
  });

  it('lets the caller override reasoning_effort when they really need deeper reasoning', () => {
    const provider = newProvider();
    const payload = provider.buildChatCompletionsPayload(MESSAGES, {
      model: 'gpt-5',
      maxTokens: 40000,
      reasoningEffort: 'high',
    });
    expect(payload.reasoning_effort).toBe('high');
  });

  it('emits max_completion_tokens + temperature + json_object response_format for chat models', () => {
    const provider = newProvider();
    const payload = provider.buildChatCompletionsPayload(MESSAGES, {
      model: 'gpt-4o',
      maxTokens: 2048,
      temperature: 0.3,
    });
    expect(payload.model).toBe('gpt-4o');
    expect(payload.max_completion_tokens).toBe(2048);
    expect(payload).not.toHaveProperty('max_tokens');
    expect(payload.temperature).toBe(0.3);
    expect(payload.response_format).toEqual({ type: 'json_object' });
  });

  it('forwards optional top_p and penalties only on chat models', () => {
    const provider = newProvider();
    const chat = provider.buildChatCompletionsPayload(MESSAGES, {
      model: 'gpt-4o-mini',
      maxTokens: 1024,
      top_p: 0.7,
      frequency_penalty: 0.1,
      presence_penalty: 0.2,
    });
    expect(chat.top_p).toBe(0.7);
    expect(chat.frequency_penalty).toBe(0.1);
    expect(chat.presence_penalty).toBe(0.2);

    const reasoning = provider.buildChatCompletionsPayload(MESSAGES, {
      model: 'o3-mini',
      maxTokens: 1024,
      top_p: 0.7,
      frequency_penalty: 0.1,
      presence_penalty: 0.2,
    });
    expect(reasoning).not.toHaveProperty('top_p');
    expect(reasoning).not.toHaveProperty('frequency_penalty');
    expect(reasoning).not.toHaveProperty('presence_penalty');
  });

  it('omits the token budget for chat models when callers do not pass maxTokens', () => {
    const provider = newProvider();
    const payload = provider.buildChatCompletionsPayload(MESSAGES, { model: 'gpt-4o' });
    expect(payload).not.toHaveProperty('max_completion_tokens');
    expect(payload).not.toHaveProperty('max_tokens');
  });

  it('preserves the messages array verbatim (no mutation, no rewrite)', () => {
    const provider = newProvider();
    const payload = provider.buildChatCompletionsPayload(MESSAGES, {
      model: 'gpt-4o',
      maxTokens: 256,
    });
    expect(payload.messages).toBe(MESSAGES);
  });
});

describe('OpenAIProvider.call', () => {
  it('delegates to makeRequest with the built payload when reasoning response has content', async () => {
    const provider = newProvider();
    let captured;
    provider.makeRequest = async (endpoint, payload, options) => {
      captured = { endpoint, payload, options };
      return { choices: [{ message: { content: '{"ok":true}' }, finish_reason: 'stop' }] };
    };
    await provider.call(MESSAGES, { model: 'gpt-5', maxTokens: 40000 });
    expect(captured.endpoint).toBe('/chat/completions');
    expect(captured.payload.model).toBe('gpt-5');
    expect(captured.payload.max_completion_tokens).toBe(40000);
    expect(captured.payload.reasoning_effort).toBe('low');
    expect(captured.payload).not.toHaveProperty('max_tokens');
  });

  it('lets the caller still ask for minimal reasoning when they explicitly want speed', () => {
    const provider = newProvider();
    const payload = provider.buildChatCompletionsPayload(MESSAGES, {
      model: 'gpt-5',
      maxTokens: 40000,
      reasoningEffort: 'minimal',
    });
    expect(payload.reasoning_effort).toBe('minimal');
  });

  it('retries once with a larger output budget when a reasoning model returns empty content', async () => {
    const provider = newProvider();
    const calls = [];
    provider.makeRequest = async (endpoint, payload, options) => {
      calls.push({ endpoint, payload, options });
      if (calls.length === 1) {
        return {
          choices: [{ message: { content: '' }, finish_reason: 'length' }],
          usage: { prompt_tokens: 100, completion_tokens: payload.max_completion_tokens },
        };
      }
      return { choices: [{ message: { content: '{"ok":true}' }, finish_reason: 'stop' }] };
    };
    const result = await provider.call(MESSAGES, { model: 'gpt-5-mini', maxTokens: 2048 });
    expect(result.choices[0].message.content).toBe('{"ok":true}');
    expect(calls).toHaveLength(2);
    expect(calls[0].payload.max_completion_tokens).toBeGreaterThanOrEqual(32768);
    expect(calls[1].payload.max_completion_tokens).toBeGreaterThanOrEqual(65536);
    expect(calls[1].options.retryOfEmptyReasoningResponse).toBe(true);
  });

  it('does not retry empty content for chat models (caller validation should surface it)', async () => {
    const provider = newProvider();
    const calls = [];
    provider.makeRequest = async (endpoint, payload, options) => {
      calls.push({ endpoint, payload, options });
      return { choices: [{ message: { content: '' }, finish_reason: 'stop' }] };
    };
    await provider.call(MESSAGES, { model: 'gpt-4o', maxTokens: 2048 });
    expect(calls).toHaveLength(1);
  });

  it('throws a diagnostic error if a reasoning retry is still empty', async () => {
    const provider = newProvider();
    provider.makeRequest = async (_endpoint, payload) => ({
      choices: [{ message: { content: '' }, finish_reason: 'length' }],
      usage: { prompt_tokens: 100, completion_tokens: payload.max_completion_tokens, total_tokens: 101 },
    });
    await expect(provider.call(MESSAGES, { model: 'gpt-5-mini', maxTokens: 2048 })).rejects.toThrow(
      /empty reasoning response after retry.*content=string.*finish_reason=length/
    );
  });

  it('embeds the message-shape diagnostic for content-array empty retries', async () => {
    const provider = newProvider();
    provider.makeRequest = async () => ({
      choices: [
        {
          message: { content: [{ type: 'text', text: '' }] },
          finish_reason: 'length',
        },
      ],
      usage: {
        prompt_tokens: 100,
        completion_tokens: 4096,
        completion_tokens_details: { reasoning_tokens: 4096 },
      },
    });
    await expect(provider.call(MESSAGES, { model: 'gpt-5', maxTokens: 4096 })).rejects.toThrow(
      /content=array\(parts=1, types=\[text\], textLen=0\).*reasoning_tokens=4096/
    );
  });

  it('throws fail-loud when call is invoked without model (catches misconfigured callers)', async () => {
    const provider = newProvider();
    await expect(provider.call(MESSAGES, {})).rejects.toThrow(/missing `model`/);
  });

  it('coerces array-shaped content-parts into a plain string before returning the response', async () => {
    const provider = newProvider();
    provider.makeRequest = async () => ({
      choices: [
        {
          message: {
            content: [
              { type: 'text', text: '{"ok":' },
              { type: 'text', text: 'true}' },
            ],
          },
          finish_reason: 'stop',
        },
      ],
    });
    const result = await provider.call(MESSAGES, { model: 'gpt-5', maxTokens: 40000 });
    expect(typeof result.choices[0].message.content).toBe('string');
    expect(result.choices[0].message.content).toBe('{"ok":true}');
  });

  it('does not retry when array-shaped content already carries visible text (reasoning models)', async () => {
    const provider = newProvider();
    let attempts = 0;
    provider.makeRequest = async () => {
      attempts += 1;
      return {
        choices: [
          {
            message: { content: [{ type: 'text', text: '{"answer":42}' }] },
            finish_reason: 'stop',
          },
        ],
      };
    };
    const result = await provider.call(MESSAGES, { model: 'gpt-5-mini', maxTokens: 4096 });
    expect(attempts).toBe(1);
    expect(result.choices[0].message.content).toBe('{"answer":42}');
  });

  it('treats content-parts arrays whose text is empty as still empty and triggers retry', async () => {
    const provider = newProvider();
    const calls = [];
    provider.makeRequest = async (_endpoint, payload) => {
      calls.push(payload);
      if (calls.length === 1) {
        return {
          choices: [
            { message: { content: [{ type: 'text', text: '' }] }, finish_reason: 'length' },
          ],
        };
      }
      return {
        choices: [{ message: { content: [{ type: 'text', text: 'recovered' }] }, finish_reason: 'stop' }],
      };
    };
    const result = await provider.call(MESSAGES, { model: 'gpt-5', maxTokens: 4096 });
    expect(calls).toHaveLength(2);
    expect(result.choices[0].message.content).toBe('recovered');
  });
});
