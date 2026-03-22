// Please write clean, production-grade JavaScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Design-time AI Agent task generation.
 * Calls an LLM with a meta-prompt to produce: proposed variables, initial state template,
 * runtime agent prompt, and a sample dialogue for UX preview.
 */

const META_SYSTEM = `You are an expert conversational AI designer for the OMNIA dialogue engine.
You MUST respond with a single valid JSON object only (no markdown fences, no commentary).
The JSON must match the schema described in the user message exactly.
When the user message specifies OUTPUT_LANGUAGE, write every human-readable string in the JSON in that language (structured section bodies, sample_dialogue content, design_notes, proposed_variables labels, string values inside initial_state_template such as task id labels if natural language).
Do NOT include a top-level "agent_prompt" key in your JSON; the server assembles the runtime prompt from structured sections.`;

/** @type {readonly string[]} */
const STRUCTURED_SECTION_IDS = [
  'behavior_spec',
  'positive_constraints',
  'negative_constraints',
  'operational_sequence',
  'correction_rules',
  'conversational_state',
];

const REQUIRED_NONEMPTY_SECTION_KEYS = [
  'behavior_spec',
  'positive_constraints',
  'negative_constraints',
  'operational_sequence',
  'correction_rules',
];

const SECTION_MARKDOWN_TITLES = {
  behavior_spec: 'Behavior Spec',
  positive_constraints: 'Vincoli positivi',
  negative_constraints: 'Vincoli negativi',
  operational_sequence: 'Sequenza operativa',
  correction_rules: 'Regole di correzione',
  conversational_state: 'Stato conversazionale',
};

/**
 * @param {Record<string, string>} sections
 * @returns {string}
 */
function composeRuntimePromptMarkdownFromSections(sections) {
  const order = [
    'behavior_spec',
    'positive_constraints',
    'negative_constraints',
    'operational_sequence',
    'correction_rules',
    'conversational_state',
  ];
  const chunks = [];
  for (const id of order) {
    const body = String(sections[id] ?? '').trim();
    if (id === 'conversational_state' && !body) continue;
    const title = SECTION_MARKDOWN_TITLES[id];
    chunks.push(`## ${title}\n\n${body.length > 0 ? body : '—'}`);
  }
  return chunks.join('\n\n').trim();
}

/**
 * @param {unknown} raw
 * @returns {Array<{ sectionId: string, baseText: string, refinementPatch: unknown[] }>|undefined}
 */
function normalizeSectionRefinements(raw) {
  if (!Array.isArray(raw)) return undefined;
  const out = [];
  for (const e of raw) {
    if (!e || typeof e !== 'object') continue;
    const sectionId = typeof e.sectionId === 'string' ? e.sectionId.trim() : '';
    if (!STRUCTURED_SECTION_IDS.includes(sectionId)) continue;
    out.push({
      sectionId,
      baseText: typeof e.baseText === 'string' ? e.baseText : '',
      refinementPatch: Array.isArray(e.refinementPatch) ? e.refinementPatch : [],
    });
  }
  return out.length ? out : undefined;
}

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
 * @param {unknown} raw
 * @returns {string|undefined}
 */
function sanitizeOutputLanguage(raw) {
  if (typeof raw !== 'string') return undefined;
  const s = raw.trim();
  if (!s || s.length > 24) return undefined;
  if (!/^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/.test(s)) {
    return undefined;
  }
  return s;
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
 * @param {string|undefined} outputLanguage BCP 47 tag
 * @param {{ refinementPatch?: unknown[], baseText?: string, sectionRefinements?: Array<{ sectionId: string, baseText: string, refinementPatch: unknown[] }> }} [opts]
 * @returns {string}
 */
function buildMetaUserMessage(userDesc, outputLanguage, opts = {}) {
  const { refinementPatch, baseText, sectionRefinements } = opts;
  const langBlock =
    typeof outputLanguage === 'string' && outputLanguage.trim().length > 0
      ? `

OUTPUT_LANGUAGE (BCP 47): ${outputLanguage.trim()}
Use this language for all natural-language content in the JSON output. Match the designer task description language when it is clearly the same locale; otherwise follow OUTPUT_LANGUAGE.
`
      : '';

  let revisionBlock = '';
  const sr = normalizeSectionRefinements(sectionRefinements);
  if (sr && sr.length > 0) {
    revisionBlock = `

STRUCTURED_SECTION_REFINEMENTS (JSON array). Each entry: { "sectionId", "baseText", "refinementPatch" }.
sectionId is one of: ${STRUCTURED_SECTION_IDS.join(', ')}.
refinementPatch is chronological delete/insert ops; character positions refer ONLY to that entry's baseText (clean Monaco snapshot before user revisions).
${JSON.stringify(sr)}
`;
  } else if (Array.isArray(refinementPatch) && refinementPatch.length > 0) {
    revisionBlock = `

STRUCTURED_REVISION_PATCH (legacy single-field refine; positions are in the clean base snapshot below):
${JSON.stringify(refinementPatch)}
`;
    if (typeof baseText === 'string' && baseText.length > 0) {
      revisionBlock += `

CLEAN_BASE_SNAPSHOT (legacy single prompt):
"""
${baseText}
"""
`;
    }
  } else if (typeof baseText === 'string' && baseText.length > 0) {
    revisionBlock = `

CLEAN_BASE_SNAPSHOT (Monaco model before user revisions):
"""
${baseText}
"""
`;
  }

  return `DESIGNER TASK DESCRIPTION (natural language):
"""
${userDesc}
"""
${revisionBlock}${langBlock}

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

3) Structured runtime instructions (strings; the app composes the final Markdown runtime prompt — do NOT output "agent_prompt"):
   - "behavior_spec": main behavior and goals for the agent.
   - "positive_constraints": what the agent must do / must respect.
   - "negative_constraints": what the agent must avoid.
   - "operational_sequence": ordered steps the agent should follow in the dialogue.
   - "correction_rules": how to handle user corrections and re-confirmation.
   - "conversational_state": optional free-text notes on dialogue state usage (may be empty string if not needed).
   Each of behavior_spec..correction_rules MUST be non-empty. conversational_state may be "".
   Together these sections MUST still encode that the runtime model replies with ONLY this JSON shape (no extra text):
   { "updated_state": { ...same shape as initial_state_template... }, "assistant_reply": "..." }
   Encode: never rely on memory outside updated_state; ask only for missing fields; confirmation flow; corrections reset confirmation; recompute missing_fields from null required keys; assistant_reply concise.

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

  const sectionTexts = {};
  for (const key of REQUIRED_NONEMPTY_SECTION_KEYS) {
    if (typeof parsed[key] !== 'string' || !parsed[key].trim()) {
      throw new Error(`Invalid JSON: ${key} must be a non-empty string`);
    }
    sectionTexts[key] = parsed[key].trim();
  }
  const conv =
    typeof parsed.conversational_state === 'string' ? parsed.conversational_state : '';
  sectionTexts.conversational_state = conv;

  const agentPromptComposed = composeRuntimePromptMarkdownFromSections(sectionTexts);
  if (!agentPromptComposed) {
    throw new Error('Invalid JSON: composed runtime prompt is empty');
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
    behavior_spec: sectionTexts.behavior_spec,
    positive_constraints: sectionTexts.positive_constraints,
    negative_constraints: sectionTexts.negative_constraints,
    operational_sequence: sectionTexts.operational_sequence,
    correction_rules: sectionTexts.correction_rules,
    conversational_state: sectionTexts.conversational_state,
    agent_prompt: agentPromptComposed,
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
 * @param {Array<{ type: string }>|undefined} [params.refinementPatch]
 * @param {string|undefined} [params.baseText]
 * @param {unknown} [params.sectionRefinements]
 * @param {string|undefined} [params.outputLanguage]
 * @returns {Promise<object>}
 */
async function generateAIAgentDesign({
  userDesc,
  provider = 'groq',
  model,
  aiProviderService,
  refinementPatch,
  baseText,
  sectionRefinements,
  outputLanguage,
}) {
  if (!userDesc || typeof userDesc !== 'string' || userDesc.trim().length < 8) {
    throw new Error('userDesc must be a non-empty string (at least 8 characters)');
  }

  const lang = sanitizeOutputLanguage(outputLanguage);

  const messages = [
    { role: 'system', content: META_SYSTEM },
    {
      role: 'user',
      content: buildMetaUserMessage(userDesc.trim(), lang, {
        refinementPatch,
        baseText,
        sectionRefinements,
      }),
    },
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
