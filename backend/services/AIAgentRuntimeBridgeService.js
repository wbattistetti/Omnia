// Runtime bridge for VB.NET AIAgentTaskExecutor: POST body { state, user_message, rules }
// -> LLM -> { new_state, assistant_message, status }.

const { extractJsonString } = require('./AIAgentDesignService');

const RUNTIME_SYSTEM = `You are the runtime engine for an OMNIA AI Agent dialogue task.
You MUST respond with a single valid JSON object only (no markdown fences, no commentary).
The JSON must have exactly these keys:
- "new_state": object (full updated task/conversation state after this turn)
- "assistant_message": string (what the voice assistant should say next; use "" only if truly nothing to say)
- "status": either "in_progress" or "completed"
Use "completed" when TASK_RULES indicate the task is finished and the flow should leave this AI Agent step.`;

const DEFAULT_TIMEOUT_MS = 120000;

/**
 * @param {import('./AIProviderService')} aiProviderService
 * @param {string} [preferred] groq | openai
 * @returns {string}
 */
function resolveProvider(aiProviderService, preferred) {
  const fromEnv = (process.env.OMNIA_AI_AGENT_RUNTIME_PROVIDER || '').toLowerCase().trim();
  const p = (preferred || fromEnv || 'groq').toLowerCase();
  const available = aiProviderService.getAvailableProviders();
  if (available.includes(p)) return p;
  if (available.includes('groq')) return 'groq';
  if (available.includes('openai')) return 'openai';
  throw new Error(
    'No AI provider available. Configure Groq or OpenAI API keys (see backend config / AIConfig).'
  );
}

/**
 * @param {unknown} body
 * @returns {{ state: object, user_message: string, rules: string }}
 */
function normalizeBody(body) {
  if (!body || typeof body !== 'object') {
    throw new Error('Request body must be a JSON object');
  }
  let state = body.state;
  if (state === undefined || state === null) {
    state = {};
  } else if (typeof state === 'string') {
    try {
      state = JSON.parse(state);
    } catch {
      throw new Error('state must be a JSON object or a JSON string');
    }
  } else if (typeof state !== 'object' || Array.isArray(state)) {
    throw new Error('state must be a JSON object');
  }
  const user_message = typeof body.user_message === 'string' ? body.user_message : '';
  const rules = typeof body.rules === 'string' ? body.rules : '';
  return { state, user_message, rules };
}

/**
 * @param {object} obj
 */
function validateLlmPayload(obj) {
  if (!obj || typeof obj !== 'object') {
    throw new Error('LLM returned invalid JSON (not an object)');
  }
  if (obj.new_state === undefined || obj.new_state === null) {
    throw new Error('LLM response missing new_state');
  }
  if (typeof obj.new_state !== 'object' || Array.isArray(obj.new_state)) {
    throw new Error('new_state must be a JSON object');
  }
  const st = obj.status;
  if (st !== 'in_progress' && st !== 'completed') {
    throw new Error('status must be "in_progress" or "completed"');
  }
  const assistant_message =
    typeof obj.assistant_message === 'string' ? obj.assistant_message : '';
  return {
    new_state: obj.new_state,
    assistant_message,
    status: st,
  };
}

/**
 * @param {object} state
 * @param {string} userMessage
 * @param {string} rules
 */
function buildUserMessage(state, userMessage, rules) {
  return `TASK_RULES (synthetic prompt for this task):
"""
${rules}
"""

CURRENT_STATE (JSON object — update this logically into new_state):
${JSON.stringify(state)}

USER_MESSAGE (latest user utterance, may be empty on first turn):
"""
${userMessage}
"""

Instructions:
- Apply TASK_RULES and merge USER_MESSAGE into new_state.
- Set assistant_message to the next assistant reply in the user's language (infer from TASK_RULES and USER_MESSAGE).
- Set status to "completed" only when the task is fully done per TASK_RULES; otherwise "in_progress".`;
}

/**
 * One runtime step for the VB.NET AI Agent task executor.
 * @param {object} body - { state, user_message, rules, provider?, model? }
 * @param {import('./AIProviderService')} aiProviderService
 * @returns {Promise<{ new_state: object, assistant_message: string, status: string }>}
 */
async function runAIAgentRuntimeStep(body, aiProviderService) {
  const { state, user_message, rules } = normalizeBody(body);
  const provider = resolveProvider(aiProviderService, body && body.provider);
  const model =
    (body && typeof body.model === 'string' && body.model.trim()) ||
    (process.env.OMNIA_AI_AGENT_RUNTIME_MODEL || '').trim() ||
    undefined;

  const messages = [
    { role: 'system', content: RUNTIME_SYSTEM },
    { role: 'user', content: buildUserMessage(state, user_message, rules) },
  ];

  const maxTokens = provider === 'openai' ? 4096 : 8192;
  const response = await aiProviderService.callAI(provider, messages, {
    model,
    temperature: 0.3,
    maxTokens,
    timeout: DEFAULT_TIMEOUT_MS,
  });

  const content = response?.choices?.[0]?.message?.content;
  const jsonStr = extractJsonString(content);
  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    const err = new Error(`Model returned non-JSON: ${e.message}`);
    err.rawSnippet = jsonStr.slice(0, 800);
    throw err;
  }

  return validateLlmPayload(parsed);
}

module.exports = {
  runAIAgentRuntimeStep,
  resolveProvider,
};
