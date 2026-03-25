// Please write clean, production-grade JavaScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Design-time AI Agent task generation.
 * Produces rich editor content (sections, sample_dialogue) and REQUIRED runtime_compact for execution.
 * Application code only concatenates compact text fields into one rules string (no stylistic rewrite).
 */

const META_SYSTEM = `You are an expert AI agent designer for the OMNIA dialogue engine.

ARCHITECTURE (non-negotiable):
- Rich design (structured sections, sample_dialogue, design_notes) exists for the EDITOR and persistence only. It is NOT the runtime instruction set sent to the execution engine as a whole.
- runtime_compact is REQUIRED on every response. It is the ONLY authoritative behavioral contract for runtime: the runtime engine receives rules built ONLY from runtime_compact (four text fields concatenated in fixed order by code). The rich Markdown composed from sections is NOT sent to runtime execution.
- You MUST write runtime_compact yourself in this JSON. Never assume code will infer or summarize compact text from rich sections.
- runtime_compact is the agent "voice" at runtime: stylistic and semantic distillation so the runtime LLM can match tone and flow of sample_dialogue without receiving the full rich text.
- On every Generate and Refine, output a fresh runtime_compact aligned with the current rich design.

You MUST respond with a single valid JSON object only (no markdown fences, no commentary).
The JSON must match exactly the schema described in the user message.

When OUTPUT_LANGUAGE is specified, write every human-readable string in that language
(structured sections, sample_dialogue content, design_notes, proposed_variables labels,
runtime_compact strings, and natural-language values inside initial_state_template).

Do NOT include a top-level "agent_prompt" key.
The server assembles editor Markdown from structured sections only.

STRICT RULES FOR structured sections:
- "tone" MUST begin with Tone: <token> on line 1; token MUST be one of: neutral, friendly_professional, warm, concise, formal, playful.
- "constraints" MUST contain two labeled blocks: Must: ... and Must not: ... (plain text, no markdown headings).

STRICT RULES FOR runtime_compact (LLM-authored; code only joins fields with blank lines, never rewrites wording):
- NON-OVERLAP: behavior_compact, constraints_compact, sequence_compact, corrections_compact must each hold unique information. No duplicated meaning across these four fields.
- MINIMALITY, imperative, token-efficient, no markdown in compact strings.
- examples_compact: 2–3 turns, ≤ 12 words per turn, tone and structure reflecting the rich sample_dialogue.
- The compact is a stylistic operational contract, not a dry label list.

Before returning JSON, run this self-check:
1) runtime_compact present; all keys non-empty where required.
2) Remove duplicated meaning across the four main compact strings.
3) Ensure examples_compact matches dialogue style of sample_dialogue in brief form.`;

/** @type {readonly string[]} */
const STRUCTURED_SECTION_IDS = [
  'goal',
  'operational_sequence',
  'context',
  'constraints',
  'personality',
  'tone',
];

const TONE_TOKENS = [
  'neutral',
  'friendly_professional',
  'warm',
  'concise',
  'formal',
  'playful',
];

const REQUIRED_NONEMPTY_SECTION_KEYS = [
  'goal',
  'operational_sequence',
  'constraints',
  'personality',
  'tone',
];

const SECTION_MARKDOWN_TITLES = {
  goal: 'Goal',
  operational_sequence: 'Operational sequence',
  context: 'Context',
  constraints: 'Guardrails',
  personality: 'Personality',
  tone: 'Tone',
};

/**
 * @param {Record<string, string>} sections
 * @returns {string}
 */
function composeRuntimePromptMarkdownFromSections(sections) {
  const order = [
    'goal',
    'operational_sequence',
    'context',
    'constraints',
    'personality',
    'tone',
  ];
  const chunks = [];
  for (const id of order) {
    const body = String(sections[id] ?? '').trim();
    if (id === 'context' && !body) continue;
    const title = SECTION_MARKDOWN_TITLES[id];
    chunks.push(`### ${title}\n\n${body.length > 0 ? body : '—'}`);
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

Your job is to design an "AI Agent" task for OMNIA.

Produce JSON with exactly these REQUIRED top-level keys:

1) "proposed_variables" — array of objects:
   - "field_name": string, snake_case, unique (JSON key in updated_state; "label" is human-facing)
   - "label": string, human-readable
   - "type": string, MUST be one of: ${ENTITY_TYPES.join(', ')}
   - "required": boolean

2) "initial_state_template" — object. MUST include:
   - "task": short string id
   - one key per field_name from proposed_variables, each null
   - "confirmation_status": "collecting" | "awaiting_user" | "confirmed" (start "collecting")
   - "missing_fields": array of required field_name values initially missing
   - "history_summary": ""
   - "task_completed": false

3) "goal": string (non-empty, rich) — what the agent must achieve by the end of the conversation.
4) "operational_sequence": string (non-empty, rich) — ordered steps: which data to collect, in what order, confirmations, corrections.
5) "context": string (may be empty) — where the conversation happens, who the user is, what is already known.
6) "constraints": string (non-empty, rich) — MUST use exactly two labeled blocks (plain lines, no markdown):
   Must:
   <obligations>
   Must not:
   <prohibitions>
7) "personality": string (non-empty, rich) — who the agent is: role, attitude, empathy (no register/voice details; those go in "tone").
8) "tone": string (non-empty, rich). MUST start with line 1 exactly: Tone: <token> where <token> is one of: ${TONE_TOKENS.join(', ')}. After a blank line, how the agent speaks: brevity, clarity, formality, empathy in 2–6 short sentences.

Sections 3–8 are for the editor and Mongo persistence. The execution engine does NOT receive these rich strings as the runtime prompt; runtime behavior is driven by runtime_compact below.

Together, sections 3–8 MUST still imply that the model replies with ONLY:
{ "updated_state": { ...same shape as initial_state_template... }, "assistant_reply": "..." }
Never rely on memory outside updated_state; ask missing fields only; confirmation and corrections as designed.
The server may compose editor Markdown from sections 3–8 — do NOT output top-level "agent_prompt".

9) "sample_dialogue" — non-empty array of { "role": "assistant" | "user", "content": string }
   Realistic 6–14 turns; include confirmation and one correction; consistent with proposed_variables.

10) "design_notes" — string (1–3 sentences)

11) "runtime_compact" — REQUIRED. Regenerate on every Generate and Refine. This is the sole runtime behavioral source (plus initial state at execution). Object with EXACT keys:
   - "behavior_compact": string (<= 20 words, goal only, imperative, no markdown)
   - "constraints_compact": string (<= 28 words, MUST/MUST NOT style constraints only, no sequence, no markdown)
   - "sequence_compact": string (<= 32 words, ordered steps only, no policy prose, no markdown)
   - "corrections_compact": string (<= 20 words, correction and reconfirmation only, no markdown)
   - "examples_compact": array of 2–3 turns: { "role": "assistant" | "user", "content": string (<= 12 words) }
   Stylistic anchor: examples_compact MUST reflect tone and structure of sample_dialogue in shortened form.

Compact quality (MANDATORY):
- NON-OVERLAP across the four main compact strings; no paraphrase duplication.
- Minimal, imperative, token-efficient; coherent with the rich design.
- The compact is the runtime "voice"; downstream code concatenates the four strings with blank lines only — it does NOT rewrite style.

Before returning JSON:
1) Confirm runtime_compact is complete and non-empty where required.
2) Deduplicate meaning across behavior_compact, constraints_compact, sequence_compact, corrections_compact.
3) Align examples_compact with sample_dialogue tone.

Output ONLY valid JSON. No markdown fences, no commentary outside JSON.`;
}

function countWords(s) {
  return String(s || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

/**
 * @param {string} text
 * @returns {string|null}
 */
function parseToneTokenFromSection(text) {
  const lines = String(text)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const first = lines[0];
  if (!first) return null;
  const m = /^Tone:\s*([a-z0-9_]+)\s*$/i.exec(first);
  return m ? m[1].toLowerCase() : null;
}

/**
 * Validate required runtime_compact object from the model.
 * @param {unknown} raw
 * @returns {{behavior_compact:string,constraints_compact:string,sequence_compact:string,corrections_compact:string,examples_compact:Array<{role:'assistant'|'user',content:string}>}}
 */
function validateRuntimeCompact(raw) {
  if (raw === undefined || raw === null) {
    throw new Error('Invalid JSON: runtime_compact is required');
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Invalid JSON: runtime_compact must be an object');
  }
  const rc = raw;
  const required = [
    'behavior_compact',
    'constraints_compact',
    'sequence_compact',
    'corrections_compact',
    'examples_compact',
  ];
  for (const k of required) {
    if (!(k in rc)) {
      throw new Error(`Invalid JSON: runtime_compact missing required key '${k}'`);
    }
  }
  const behavior = String(rc.behavior_compact ?? '').trim();
  const constraints = String(rc.constraints_compact ?? '').trim();
  const sequence = String(rc.sequence_compact ?? '').trim();
  const corrections = String(rc.corrections_compact ?? '').trim();
  if (!behavior || !constraints || !sequence || !corrections) {
    throw new Error('Invalid JSON: runtime_compact strings must be non-empty');
  }
  if (countWords(behavior) > 20) throw new Error('Invalid JSON: behavior_compact exceeds 20 words');
  if (countWords(constraints) > 28) throw new Error('Invalid JSON: constraints_compact exceeds 28 words');
  if (countWords(sequence) > 32) throw new Error('Invalid JSON: sequence_compact exceeds 32 words');
  if (countWords(corrections) > 20) throw new Error('Invalid JSON: corrections_compact exceeds 20 words');

  const ex = rc.examples_compact;
  if (!Array.isArray(ex) || ex.length < 2 || ex.length > 3) {
    throw new Error('Invalid JSON: examples_compact must be an array of 2-3 turns');
  }
  const normalizedExamples = ex.map((t, idx) => {
    if (!t || (t.role !== 'assistant' && t.role !== 'user')) {
      throw new Error(`Invalid JSON: runtime_compact.examples_compact[${idx}] has invalid role`);
    }
    const content = String(t.content ?? '').trim();
    if (!content) {
      throw new Error(`Invalid JSON: runtime_compact.examples_compact[${idx}].content is empty`);
    }
    if (countWords(content) > 12) {
      throw new Error(`Invalid JSON: runtime_compact.examples_compact[${idx}] exceeds 12 words`);
    }
    return { role: t.role, content };
  });

  return {
    behavior_compact: behavior,
    constraints_compact: constraints,
    sequence_compact: sequence,
    corrections_compact: corrections,
    examples_compact: normalizedExamples,
  };
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
  const ctx = typeof parsed.context === 'string' ? parsed.context : '';
  sectionTexts.context = ctx.trim();

  const toneTok = parseToneTokenFromSection(sectionTexts.tone);
  if (!toneTok || !TONE_TOKENS.includes(toneTok)) {
    throw new Error(
      `Invalid JSON: tone must start with Tone: <token> where token is one of: ${TONE_TOKENS.join(', ')}`
    );
  }

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
  const runtimeCompact = validateRuntimeCompact(parsed.runtime_compact);

  return {
    proposed_variables: normalizedVars,
    initial_state_template: parsed.initial_state_template,
    goal: sectionTexts.goal,
    operational_sequence: sectionTexts.operational_sequence,
    context: sectionTexts.context,
    constraints: sectionTexts.constraints,
    personality: sectionTexts.personality,
    tone: sectionTexts.tone,
    agent_prompt: agentPromptComposed,
    sample_dialogue: sd,
    design_notes: typeof parsed.design_notes === 'string' ? parsed.design_notes : '',
    runtime_compact: runtimeCompact,
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
