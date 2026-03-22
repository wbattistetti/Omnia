// Please write clean, production-grade JavaScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Design-time AI Agent task generation.
 * Calls an LLM with a meta-prompt to produce: proposed variables, initial state template,
 * runtime agent prompt, and a sample dialogue for UX preview.
 */

const META_SYSTEM = `You are an expert conversational AI designer for the OMNIA dialogue engine.
You MUST respond with a single valid JSON object only (no markdown fences, no commentary).
The JSON must match the schema described in the user message exactly.`;

/** Canonical entity types (keep in sync with frontend src/types/dataEntityTypes.ts). */
const ENTITY_TYPES = [
  'text',
  'freeform',
  'number',
  'integer',
  'boolean',
  'date',
  'time',
  'datetime',
  'email',
  'phone',
  'address',
  'postal_code',
  'url',
  'currency',
  'percent',
  'identifier',
  'full_name',
  'country',
  'language',
];

/**
 * Map LLM type string to canonical id (default text).
 * @param {string|null|undefined} t
 * @returns {string}
 */
function coerceEntityType(t) {
  const s = String(t ?? '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_');
  if (!s) return 'text';
  if (ENTITY_TYPES.includes(s)) return s;
  const aliases = {
    string: 'text',
    str: 'text',
    int: 'integer',
    double: 'number',
    float: 'number',
    bool: 'boolean',
    mail: 'email',
    e_mail: 'email',
    tel: 'phone',
    mobile: 'phone',
    cap: 'postal_code',
    zip: 'postal_code',
    postcode: 'postal_code',
    money: 'currency',
    euro: 'currency',
    amount: 'currency',
    uri: 'url',
    link: 'url',
    id: 'identifier',
    uuid: 'identifier',
  };
  const x = aliases[s] || s;
  return ENTITY_TYPES.includes(x) ? x : 'text';
}

/**
 * Strip markdown code fences and trim content for JSON.parse.
 * @param {string} raw
 * @returns {string}
 */
function extractJsonString(raw) {
  if (!raw || typeof raw !== 'string') {
    throw new Error('Empty model response');
  }
  let s = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/im;
  const m = s.match(fence);
  if (m) {
    s = m[1].trim();
  }
  return s;
}

/**
 * Build the user message for the meta-prompt.
 * @param {string} userDesc
 * @returns {string}
 */
function buildMetaUserMessage(userDesc) {
  return `DESIGNER TASK DESCRIPTION (natural language):
"""
${userDesc}
"""

Your job is to design an "AI Agent" task for OMNIA runtime.

Produce JSON with exactly these top-level keys:
1) "proposed_variables" — array of objects, each with:
   - "field_name": string, snake_case, unique (e.g. "visit_type", "first_name") — JSON key in updated_state only; Omnia shows a separate human variable name from "label"
   - "label": string, human-readable name for the flow variable (may include spaces, e.g. "Data di nascita")
   - "type": string, MUST be exactly one of: ${ENTITY_TYPES.join(', ')}
   - "required": boolean

2) "initial_state_template" — object representing the EMPTY state before any user message.
   It MUST include:
   - "task": short string id derived from the scenario (e.g. "booking_visit")
   - one key per field_name from proposed_variables, each set to null
   - "confirmation_status": "collecting" | "awaiting_user" | "confirmed" (start with "collecting")
   - "missing_fields": array of field_name strings (all required fields that are null)
   - "history_summary": "" (empty string)
   - "task_completed": false (boolean)

3) "agent_prompt" — string, the FULL system/runtime instructions for the agent that will run in production.
   The runtime engine sends the user utterance and the current state JSON to the model; the model must ALWAYS reply with ONLY this JSON shape (no extra text):
   { "updated_state": { ...same shape as initial_state_template... }, "assistant_reply": "..." }
   Rules the agent_prompt MUST encode:
   - Never rely on memory outside updated_state; state is the source of truth.
   - Ask only for missing fields until all required fields are filled.
   - When all required fields are filled, set confirmation_status to "awaiting_user" and ask for confirmation.
   - If user confirms, set confirmation_status to "confirmed" and task_completed to true.
   - If user corrects a field (explicitly or implicitly), update the field and set confirmation_status back appropriately; task_completed false until re-confirmed.
   - Keep assistant_reply concise and in the same language as the designer description when possible.
   - Always recompute "missing_fields" from null required keys in updated_state.

4) "sample_dialogue" — array of { "role": "assistant" | "user", "content": "..." }
   A realistic 6–14 turn simulation showing tone, order of questions, confirmation, and one correction.
   Must be consistent with proposed_variables.

5) "design_notes" — string, 1–3 sentences for the designer (optional hints).

Remember: output valid JSON only.`;
}

/**
 * Validate and normalize parsed JSON from the model.
 * @param {object} parsed
 * @returns {object}
 */
function validateDesignPayload(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid JSON: not an object');
  }
  const vars = parsed.proposed_variables;
  if (!Array.isArray(vars) || vars.length === 0) {
    throw new Error('Invalid JSON: proposed_variables must be a non-empty array');
  }
  for (const v of vars) {
    if (!v || typeof v !== 'object') throw new Error('Invalid proposed_variables entry');
    if (!v.field_name || typeof v.field_name !== 'string') {
      throw new Error('Each variable must have field_name (string)');
    }
    if (!v.label || typeof v.label !== 'string') {
      throw new Error('Each variable must have label (string)');
    }
  }
  if (!parsed.initial_state_template || typeof parsed.initial_state_template !== 'object') {
    throw new Error('Invalid JSON: initial_state_template must be an object');
  }
  if (typeof parsed.agent_prompt !== 'string' || !parsed.agent_prompt.trim()) {
    throw new Error('Invalid JSON: agent_prompt must be a non-empty string');
  }
  const sd = parsed.sample_dialogue;
  if (!Array.isArray(sd) || sd.length === 0) {
    throw new Error('Invalid JSON: sample_dialogue must be a non-empty array');
  }
  for (const turn of sd) {
    if (!turn || (turn.role !== 'assistant' && turn.role !== 'user')) {
      throw new Error('sample_dialogue entries must have role assistant or user');
    }
    if (typeof turn.content !== 'string') {
      throw new Error('sample_dialogue entries must have string content');
    }
  }
  const normalizedVars = vars.map((v) => ({
    ...v,
    type: coerceEntityType(v.type),
  }));

  return {
    proposed_variables: normalizedVars,
    initial_state_template: parsed.initial_state_template,
    agent_prompt: parsed.agent_prompt.trim(),
    sample_dialogue: sd,
    design_notes: typeof parsed.design_notes === 'string' ? parsed.design_notes : '',
  };
}

/**
 * @param {object} params
 * @param {string} params.userDesc
 * @param {string} [params.provider]
 * @param {string} [params.model]
 * @param {import('./AIProviderService')} params.aiProviderService
 * @returns {Promise<object>}
 */
async function generateAIAgentDesign({ userDesc, provider = 'groq', model, aiProviderService }) {
  if (!userDesc || typeof userDesc !== 'string' || userDesc.trim().length < 8) {
    throw new Error('userDesc must be a non-empty string (at least 8 characters)');
  }

  const messages = [
    { role: 'system', content: META_SYSTEM },
    { role: 'user', content: buildMetaUserMessage(userDesc.trim()) },
  ];

  // OpenAI chat models often cap completion tokens at 4096; larger values return 400 invalid_request_error.
  const maxTokens = provider === 'openai' ? 4096 : 8192;

  const response = await aiProviderService.callAI(provider, messages, {
    model: model || undefined,
    temperature: 0.35,
    maxTokens,
  });

  const content = response?.choices?.[0]?.message?.content;
  const jsonStr = extractJsonString(content);
  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    const err = new Error(`Model returned non-JSON: ${e.message}`);
    err.rawSnippet = jsonStr.slice(0, 500);
    throw err;
  }

  return validateDesignPayload(parsed);
}

module.exports = {
  generateAIAgentDesign,
  buildMetaUserMessage,
  extractJsonString,
  validateDesignPayload,
  coerceEntityType,
  ENTITY_TYPES,
};
