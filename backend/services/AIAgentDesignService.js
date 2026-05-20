// Please write clean, production-grade JavaScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Design-time AI Agent task generation.
 * Produces rich editor content (sections, sample_dialogue) and REQUIRED runtime_compact for execution.
 * Application code only concatenates compact text fields into one rules string (no stylistic rewrite).
 */

const { assertAiCallContract } = require('./aiCallContract');

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
- "operational_sequence": ordered operational steps as a readable list — ONE step per line. Each line MUST start with "- " (bullet) OR "N. " (numbered). Never put multiple steps in one paragraph or one line.
- "constraints": two labeled blocks only (plain labels, no markdown # headings): line "Must:" then one obligation per line (each line starts with "- "); blank line; line "Must not:" then one prohibition per line (each line starts with "- "). No prose paragraphs under either label.

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
  'examples',
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

/**
 * The model sometimes leaves a required section blank on the first Generate/Refine; a second refine fixes it.
 * Fill minimal valid placeholders so the request succeeds and the editor can show content instead of a hard error.
 * @param {Record<string, unknown>} parsed
 */
function coalesceEmptyRequiredSections(parsed) {
  const defaults = {
    goal: 'Define the agent goal in a follow-up refinement if needed.',
    operational_sequence:
      '- Define operational steps in a follow-up refinement if needed.\n- Confirm order with the designer.',
    constraints:
      'Must:\n- Follow user intent and applicable platform rules.\n\nMust not:\n- Harm users or mishandle data.',
    personality: 'Helpful and clear.',
    tone: 'Tone: neutral\n\nRefine to set voice details.',
  };
  for (const key of REQUIRED_NONEMPTY_SECTION_KEYS) {
    const v = parsed[key];
    if (typeof v !== 'string' || !String(v).trim()) {
      parsed[key] = defaults[key];
    }
  }
}

const SECTION_MARKDOWN_TITLES = {
  goal: 'Goal',
  operational_sequence: 'Operational sequence',
  context: 'Context',
  constraints: 'Guardrails',
  personality: 'Personality',
  tone: 'Tone',
  examples: 'Examples',
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
    'examples',
  ];
  const chunks = [];
  for (const id of order) {
    const body = String(sections[id] ?? '').trim();
    if (id === 'context' && !body) continue;
    if (id === 'examples' && !body) continue;
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
 * Coerce a chat completion `message.content` value into a plain string. Modern OpenAI / Anthropic
 * SDKs sometimes return `content` as an array of content parts (`[{ type: 'text', text: '...' }]`);
 * left untouched, that array reaches the JSON parser as a non-string and the user sees
 * `"Empty model response"` even though the textual answer is right there.
 *
 * @param {unknown} raw
 * @returns {string}
 */
function coerceModelContentToText(raw) {
  if (typeof raw === 'string') return raw;
  if (!Array.isArray(raw)) return '';
  let out = '';
  for (const part of raw) {
    if (!part || typeof part !== 'object') continue;
    if (typeof part.text === 'string') {
      out += part.text;
      continue;
    }
    if (part.type === 'text' && typeof part.content === 'string') {
      out += part.content;
    }
  }
  return out;
}

/**
 * One-line diagnostic of the raw `message.content` value, suitable for embedding in error
 * messages. Trims arbitrarily large strings to keep the log readable while still pinpointing
 * the actual shape OpenAI returned.
 *
 * @param {unknown} raw
 * @returns {string}
 */
function describeRawModelContent(raw) {
  if (raw === null) return 'null';
  if (raw === undefined) return 'undefined';
  if (typeof raw === 'string') {
    const preview = raw.length > 80 ? `${raw.slice(0, 80)}...` : raw;
    return `string(len=${raw.length}, preview=${JSON.stringify(preview)})`;
  }
  if (Array.isArray(raw)) {
    const types = raw.map((p) => (p && typeof p === 'object' ? p.type || 'unknown' : typeof p));
    return `array(parts=${raw.length}, types=[${types.join(',')}])`;
  }
  return `${typeof raw}`;
}

/**
 * Strip markdown code fences and trim model content for JSON.parse. Accepts either a plain
 * string or a content-parts array (see {@link coerceModelContentToText}). Throws fail-loud with a
 * distinct message when the content is unusable, so callers can tell empty vs malformed apart.
 *
 * @param {unknown} raw
 * @returns {string}
 */
function extractJsonString(raw) {
  if (raw === null || raw === undefined) {
    throw new Error(`Empty model response (raw=${describeRawModelContent(raw)})`);
  }
  if (typeof raw !== 'string' && !Array.isArray(raw)) {
    throw new Error(
      `Model response content is not textual (got ${typeof raw}); expected string or content-parts array.`
    );
  }
  const text = coerceModelContentToText(raw).trim();
  if (!text) {
    throw new Error(`Empty model response (raw=${describeRawModelContent(raw)})`);
  }
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/im;
  const m = text.match(fence);
  return m ? m[1].trim() : text;
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
4) "operational_sequence": string (non-empty, rich) — ordered steps the agent follows in conversation. Format: ONE step per line; each line starts with "- " or "N. ". Cover data collection order, confirmations, corrections, hand-offs. No multi-step paragraphs.
5) "context": string (may be empty) — where the conversation happens, who the user is, what is already known. Short prose or bullet list is OK.
6) "constraints": string (non-empty, rich) — exactly:
   Must:
   - <one obligation per line>
   Must not:
   - <one prohibition per line>
   Use plain "Must:" / "Must not:" labels (no markdown headings). Blank line between the two blocks.
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

  coalesceEmptyRequiredSections(parsed);

  const sectionTexts = {};
  for (const key of REQUIRED_NONEMPTY_SECTION_KEYS) {
    if (typeof parsed[key] !== 'string' || !parsed[key].trim()) {
      throw new Error(`Invalid JSON: ${key} must be a non-empty string`);
    }
    sectionTexts[key] = parsed[key].trim();
  }
  const ctx = typeof parsed.context === 'string' ? parsed.context : '';
  sectionTexts.context = ctx.trim();

  const ex = typeof parsed.examples === 'string' ? parsed.examples.trim() : '';
  sectionTexts.examples = ex;

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
    examples: sectionTexts.examples || '',
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
  provider,
  model,
  aiProviderService,
  refinementPatch,
  baseText,
  sectionRefinements,
  outputLanguage,
  purpose,
  taskId = null,
  taskLabel = null,
}) {
  if (!userDesc || typeof userDesc !== 'string' || userDesc.trim().length < 8) {
    throw new Error('userDesc must be a non-empty string (at least 8 characters)');
  }

  // Fail-loud: provider+model must come from the designer Omnia Tutor selection (no hardcoded fallback).
  const contract = assertAiCallContract({ provider, model, action: 'Create / Refine Agent' });

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

  const maxTokens = contract.provider === 'openai' ? 4096 : 8192;

  const response = await aiProviderService.callAI(contract.provider, messages, {
    model: contract.model,
    temperature: 0.35,
    maxTokens,
    purpose: purpose || 'AGENT_REFINE',
    taskId,
    taskLabel,
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

/**
 * Debugger workflow: infer one style rule from wrong vs correct assistant lines.
 * Returns JSON shape { rule_text } from the model.
 *
 * @param {object} params
 * @param {string} params.wrongText
 * @param {string} params.correctText
 * @param {string|undefined} params.outputLanguage BCP 47
 * @param {string} [params.provider]
 * @param {string} [params.model]
 * @param {import('./AIProviderService')} params.aiProviderService
 * @returns {Promise<{ rule_text: string }>}
 */
async function induceStyleRuleFromCorrection({
  wrongText,
  correctText,
  outputLanguage,
  provider,
  model,
  purpose,
  taskId = null,
  taskLabel = null,
  aiProviderService,
}) {
  const w = typeof wrongText === 'string' ? wrongText.trim() : '';
  const c = typeof correctText === 'string' ? correctText.trim() : '';
  if (w.length < 3) {
    throw new Error('wrongText must be at least 3 characters');
  }
  if (c.length < 3) {
    throw new Error('correctText must be at least 3 characters');
  }
  const contract = assertAiCallContract({
    provider,
    model,
    action: 'Induce style rule (debugger)',
  });

  const lang = sanitizeOutputLanguage(outputLanguage);
  const langInstr = lang
    ? `Write rule_text using language tag ${lang} (BCP 47).`
    : 'Write rule_text in the same language as the correct line when clear; otherwise English.';

  const STYLE_RULE_INDUCTION_SYSTEM = `You infer conversational style rules for the OMNIA dialogue engine.

Respond with one JSON object only (no markdown fences, no text outside JSON).
Schema: { "rule_text": string }

Requirements for rule_text:
- Clear, formal, generally applicable (not only this pair).
- Describe what the assistant MUST follow for wording/format (dates, numbers, repetition, register).
- Do not repeat or quote the wrong/correct examples verbatim.
- No markdown headings or bullet markers; plain sentences; aim under 80 words.`;

  const userMsg = `Goal: From a wrong assistant line and a corrected target line, produce one reusable style rule.

Steps:
1) Read the wrong line.
2) Read the correct line.
3) Find stylistic differences (formats, numerals, month repetition, tone).
4) Emit one explicit rule for future replies.

Context: The rule is merged into constraints_compact for an AI Agent task.

${langInstr}

Wrong line:
${w}

Correct target line:
${c}

Return only: { "rule_text": "<rule>" }`;

  const messages = [
    { role: 'system', content: STYLE_RULE_INDUCTION_SYSTEM },
    { role: 'user', content: userMsg },
  ];

  const response = await aiProviderService.callAI(contract.provider, messages, {
    model: contract.model,
    temperature: 0.25,
    maxTokens: contract.provider === 'openai' ? 1024 : 2048,
    purpose: purpose || 'STYLE_RULE_INDUCTION',
    taskId,
    taskLabel,
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
  const ruleText = typeof parsed.rule_text === 'string' ? parsed.rule_text.trim() : '';
  if (!ruleText) {
    const err = new Error('Model JSON missing non-empty rule_text');
    err.rawSnippet = jsonStr.slice(0, 400);
    throw err;
  }
  return { rule_text: ruleText };
}

module.exports = {
  generateAIAgentDesign,
  induceStyleRuleFromCorrection,
  buildMetaUserMessage,
  extractJsonString,
  coerceModelContentToText,
  validateDesignPayload,
  coerceEntityType,
  ENTITY_TYPES,
};
