// Please write clean, production-grade JavaScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Structured agent design pipeline (definitive):
 * (1) Phase 1 — LLM extraction from natural language only → JSON IR.
 * (2) Phase 2 — deterministic multi-platform compile (no LLM). No LLM refine of JSON.
 */

const util = require('util');
const { extractJsonString } = require('./AIAgentDesignService');

const LOG_PREFIX = '[StructuredPipeline]';

/**
 * Deep-clone API payloads for logging so nested objects are not shown as [Object] in console.
 * @param {unknown} x
 */
function cloneForLog(x) {
  if (x === undefined || x === null) return x;
  if (typeof x !== 'object') return x;
  try {
    return JSON.parse(JSON.stringify(x));
  } catch {
    return util.inspect(x, {
      depth: null,
      maxArrayLength: null,
      breakLength: 120,
      colors: false,
    });
  }
}

/**
 * @param {unknown} response
 * @param {unknown} messageContent
 */
function buildRawResponseLogPayload(response, messageContent) {
  let jsonFull = '';
  try {
    jsonFull = JSON.stringify(response, null, 2);
  } catch {
    jsonFull = util.inspect(response, {
      depth: null,
      maxArrayLength: null,
      breakLength: 120,
      colors: false,
    });
  }
  return {
    message_content_full: messageContent === undefined || messageContent === null ? null : String(messageContent),
    provider_response_object_full: cloneForLog(response),
    provider_response_json_full: jsonFull,
  };
}

/**
 * Emit backend console diagnostics: prefix + full value (objects as second arg, no truncation).
 * @param {'Phase1'|'Phase2'} phase
 * @param {string} tag e.g. SYSTEM_PROMPT, USER_PROMPT, MODEL_PARAMS, RAW_RESPONSE, PARSED_JSON, INPUT, OUTPUT, ERROR
 * @param {unknown} payload string or JSON-serializable value
 */
function pipelineLog(phase, tag, payload) {
  const prefix = `${LOG_PREFIX}[${phase}][${tag}]`;
  if (payload !== null && typeof payload === 'object') {
    console.log(prefix, payload);
    return;
  }
  const line = typeof payload === 'string' ? payload : String(payload);
  console.log(`${prefix} ${line}`);
}

/**
 * @param {unknown} err
 * @returns {{ message: string, name: string|null, stack: string|null }}
 */
function formatErrorPayload(err) {
  if (!err || typeof err !== 'object') {
    return { message: String(err), name: null, stack: null };
  }
  const e = err;
  return {
    message: typeof e.message === 'string' ? e.message : String(err),
    name: typeof e.name === 'string' ? e.name : 'Error',
    stack: typeof e.stack === 'string' ? e.stack : null,
  };
}

/**
 * @param {'Phase1'|'Phase2'} phase
 * @param {unknown} err
 */
function logError(phase, err) {
  pipelineLog(phase, 'ERROR', formatErrorPayload(err));
}

/**
 * Model params exactly as sent to callAI merge (verbose; null when omitted).
 * @param {object} callOptions options passed to aiProviderService.callAI
 */
function buildModelLogPayloadStrict(callOptions) {
  const o = callOptions && typeof callOptions === 'object' ? callOptions : {};
  return {
    model: o.model !== undefined && o.model !== null && o.model !== '' ? o.model : null,
    temperature: o.temperature !== undefined ? o.temperature : null,
    max_tokens: o.maxTokens !== undefined ? o.maxTokens : null,
    top_p: o.top_p !== undefined ? o.top_p : null,
    presence_penalty: o.presence_penalty !== undefined ? o.presence_penalty : null,
    frequency_penalty: o.frequency_penalty !== undefined ? o.frequency_penalty : null,
  };
}

/** MODEL_PARAMS when no LLM is invoked (deterministic Phase 2 compile). */
function buildModelLogPayloadNoLlm() {
  return {
    model: null,
    temperature: null,
    max_tokens: null,
    top_p: null,
    presence_penalty: null,
    frequency_penalty: null,
  };
}

/**
 * Redact options for logging (no function dumps).
 * @param {Record<string, unknown>} opts
 */
function summarizeGenerateOptions(opts) {
  if (!opts || typeof opts !== 'object') return {};
  return {
    mode: 'deterministic',
    provider: typeof opts.provider === 'string' ? opts.provider : undefined,
    model: opts.model !== undefined ? opts.model : undefined,
  };
}

const EXTRACT_SYSTEM = `You are a Structured-Design Extraction Agent.
Your task is to convert a natural-language description into a structured JSON design WITHOUT inventing, assuming, or generalizing anything.

RULES (STRICT, NON-NEGOTIABLE)
Do NOT invent information. If a section cannot be derived explicitly from the description, use the exact string "missing".
Do NOT generalize or normalize. Use the exact temporal, logical, and behavioral details as written.
Do NOT reinterpret or improve the description. Extract, do not rewrite.
Do NOT add domain assumptions unless explicitly stated in the description.
Do NOT fill sections with generic filler text. If the description does not contain content for a section, use "missing".
Do NOT merge sections. Each section must contain only what belongs to that section.
If the description is ambiguous for a section, use the exact string "ambiguous" for that section only.
If the description contains no context, context must be "missing".

OUTPUT FORMAT (STRICT JSON)
Return ONLY a JSON object with exactly these keys:
- "goal": string
- "operational_sequence": string
- "context": string
- "constraints": object with string keys "must" and "must_not" only (each string or "missing")
- "personality": string
- "tone": string

No markdown fences. No commentary outside JSON.`;

/**
 * User-message suffix: force IR natural-language strings to match project/browser locale.
 * @param {string|undefined|null} outputLanguage BCP 47 (e.g. it-IT, en-US)
 * @returns {string}
 */
function buildOutputLanguageInstruction(outputLanguage) {
  const t = String(outputLanguage || '').trim();
  if (!t) return '';
  return [
    '',
    'OUTPUT_LANGUAGE (MUST FOLLOW):',
    `Write every human-readable string value in the JSON (goal, operational_sequence, context, constraints.must, constraints.must_not, personality, tone) in the natural language that matches this BCP 47 locale tag: ${t}.`,
    'Keep the exact reserved tokens "missing" and "ambiguous" in English when those rules require them.',
  ].join('\n');
}

/** @param {unknown} v */
function isMissingToken(v) {
  if (v === null || v === undefined) return true;
  const t = String(v).trim().toLowerCase();
  return t === '' || t === 'missing';
}

/** @param {unknown} v */
function sectionTextForCompile(v) {
  if (v === null || v === undefined) return '';
  const s = String(v).trim();
  if (!s) return '';
  if (s.toLowerCase() === 'missing') return '';
  return s;
}

/** @param {string|undefined|null} platform */
function normalizePlatformInput(platform) {
  return String(platform || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

/** @param {string} p normalized platform key */
function resolveResponsePlatformKey(p) {
  if (p === 'elevenlabs') return 'elevenlabs';
  if (p === 'openai') return 'openai';
  if (p === 'anthropic') return 'anthropic';
  if (p === 'google') return 'google';
  return p || 'generic';
}

/**
 * Coerce a single Phase-1 IR string field (LLMs often emit null or numbers).
 * @param {unknown} v
 * @returns {string}
 */
function coercePhase1String(v) {
  if (v === null || v === undefined) return 'missing';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) {
    const parts = [];
    for (const item of v) {
      if (item === null || item === undefined) continue;
      parts.push(typeof item === 'string' ? item : JSON.stringify(item));
    }
    return parts.length ? parts.join('\n') : 'missing';
  }
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v);
    } catch {
      return 'missing';
    }
  }
  return 'missing';
}

/**
 * @param {Record<string, unknown>} obj
 * @param {string[]} keyCandidates
 * @returns {unknown}
 */
function pickFirstDefined(obj, keyCandidates) {
  for (const k of keyCandidates) {
    if (Object.prototype.hasOwnProperty.call(obj, k) && obj[k] !== undefined) {
      return obj[k];
    }
  }
  return undefined;
}

/**
 * Normalizes common LLM drift (null constraints, camelCase keys, scalar must/must_not)
 * before {@link validateStructuredDesign}. Does not invent domain content beyond "missing".
 *
 * @param {unknown} parsed
 * @returns {Record<string, unknown>}
 */
function normalizePhase1StructuredDesign(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return /** @type {Record<string, unknown>} */ (parsed);
  }
  const o = /** @type {Record<string, unknown>} */ ({ ...parsed });
  const topStrings = ['goal', 'operational_sequence', 'context', 'personality', 'tone'];
  for (const k of topStrings) {
    o[k] = coercePhase1String(o[k]);
  }
  const rawC = o.constraints;
  if (!rawC || typeof rawC !== 'object' || Array.isArray(rawC)) {
    o.constraints = { must: 'missing', must_not: 'missing' };
  } else {
    const c = /** @type {Record<string, unknown>} */ ({ ...rawC });
    const mustRaw = pickFirstDefined(c, [
      'must',
      'Must',
      'MUST',
      'positive',
      'positive_constraints',
      'must_do',
    ]);
    const notRaw = pickFirstDefined(c, [
      'must_not',
      'mustNot',
      'Must_not',
      'MUST_NOT',
      'negative',
      'negative_constraints',
      'forbidden',
      'must_not_do',
    ]);
    const mustVal = mustRaw !== undefined ? mustRaw : c.must;
    const notVal = notRaw !== undefined ? notRaw : c.must_not;
    o.constraints = {
      must: coercePhase1String(mustVal),
      must_not: coercePhase1String(notVal),
    };
  }
  return o;
}

/**
 * Validate structured design object (Phase 1 extract output).
 * @param {unknown} raw
 * @returns {object}
 */
function validateStructuredDesign(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('structured_design must be a non-null object');
  }
  const o = raw;
  const keys = ['goal', 'operational_sequence', 'context', 'personality', 'tone'];
  for (const k of keys) {
    if (typeof o[k] !== 'string') {
      throw new Error(`Invalid structured_design: "${k}" must be a string`);
    }
  }
  const c = o.constraints;
  if (!c || typeof c !== 'object' || Array.isArray(c)) {
    throw new Error('Invalid structured_design: constraints must be an object');
  }
  if (typeof c.must !== 'string' || typeof c.must_not !== 'string') {
    throw new Error('Invalid structured_design: constraints.must and constraints.must_not must be strings');
  }
  return {
    goal: o.goal,
    operational_sequence: o.operational_sequence,
    context: o.context,
    constraints: { must: c.must, must_not: c.must_not },
    personality: o.personality,
    tone: o.tone,
  };
}

/**
 * Phase 1: extract structured design from natural language (no invention).
 * @param {string} description
 * @param {string} [provider]
 * @param {string} [model]
 * @param {import('./AIProviderService')} aiProviderService
 * @param {string|undefined} [outputLanguage] BCP 47 tag for all IR string fields
 */
async function extractStructure(description, provider, model, aiProviderService, outputLanguage) {
  try {
    const desc = typeof description === 'string' ? description.trim() : '';
    if (desc.length < 4) {
      const errEarly = new Error('description must be a non-empty string (at least 4 characters)');
      pipelineLog('Phase1', 'INPUT', {
        description: typeof description === 'string' ? description : '(non-string)',
        description_trimmed: desc,
        description_trimmed_length: desc.length,
        provider: provider || 'groq',
        model: model || null,
      });
      pipelineLog('Phase1', 'PARSED_JSON', {
        error: true,
        stage: 'input_validation',
        message: errEarly.message,
      });
      throw errEarly;
    }
    const langSuffix = buildOutputLanguageInstruction(outputLanguage);
    const userContent = `NATURAL_LANGUAGE_DESCRIPTION:\n"""\n${desc}\n"""\n\nReturn ONLY the JSON object with the required keys.${langSuffix}`;
    const messages = [{ role: 'system', content: EXTRACT_SYSTEM }, { role: 'user', content: userContent }];
    const maxTokens = provider === 'openai' ? 4096 : 8192;
    const callOptions = {
      model: model || undefined,
      temperature: 0.15,
      maxTokens,
    };
    const prov = provider || 'groq';

    pipelineLog('Phase1', 'INPUT', {
      description: typeof description === 'string' ? description : '(non-string)',
      description_trimmed: desc,
      description_trimmed_length: desc.length,
      provider: prov,
      model: model || null,
      outputLanguage: typeof outputLanguage === 'string' ? outputLanguage : null,
      messages_full_json: messages,
      call_options_passed_to_callAI: callOptions,
    });

    pipelineLog('Phase1', 'SYSTEM_PROMPT', EXTRACT_SYSTEM);
    pipelineLog('Phase1', 'USER_PROMPT', messages[1].content);

    pipelineLog('Phase1', 'MODEL_PARAMS', buildModelLogPayloadStrict(callOptions));

    const response = await aiProviderService.callAI(prov, messages, callOptions);
    const content = response?.choices?.[0]?.message?.content;
    pipelineLog('Phase1', 'RAW_RESPONSE', buildRawResponseLogPayload(response, content));

    let jsonStr;
    try {
      jsonStr = extractJsonString(content);
    } catch (e) {
      pipelineLog('Phase1', 'PARSED_JSON', {
        error: true,
        stage: 'extractJsonString',
        message: e.message,
        raw_message_content_full: content === undefined || content === null ? null : String(content),
      });
      throw e;
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      const err = new Error(`Model returned non-JSON: ${e.message}`);
      err.rawSnippet = jsonStr.slice(0, 500);
      pipelineLog('Phase1', 'PARSED_JSON', {
        error: true,
        stage: 'JSON.parse',
        message: e.message,
        extracted_string_after_fence_strip_full: jsonStr,
      });
      throw err;
    }
    pipelineLog('Phase1', 'PARSED_JSON', parsed);

    const normalized = normalizePhase1StructuredDesign(parsed);
    if (JSON.stringify(normalized) !== JSON.stringify(parsed)) {
      pipelineLog('Phase1', 'NORMALIZED_LLM_JSON', {
        note: 'Coerced null/non-string constraints or top-level IR fields before validation.',
        before: parsed,
        after: normalized,
      });
    }

    let out;
    try {
      out = validateStructuredDesign(normalized);
    } catch (e) {
      pipelineLog('Phase1', 'PARSED_JSON', {
        error: true,
        stage: 'validateStructuredDesign',
        message: e.message,
        parsed_before_validation: parsed,
        normalized_before_validation: normalized,
      });
      throw e;
    }
    pipelineLog('Phase1', 'OUTPUT', out);
    return out;
  } catch (err) {
    logError('Phase1', err);
    throw err;
  }
}

/**
 * Phase 2: deterministic platform system prompt (format only, no LLM).
 * @param {string} platform
 * @param {object} structuredDesign
 * @returns {{ platform: string, system_prompt: string }}
 */
function compileDeterministicPlatformPrompt(platform, structuredDesign) {
  const d = validateStructuredDesign(structuredDesign);
  const p = normalizePlatformInput(platform);
  pipelineLog('Phase2', 'PARSED_JSON', {
    note:
      'No LLM. Validated structured_design used for deterministic string assembly (align with Phase 1 IR).',
    platform_normalized: p,
    validated_structured_design: d,
  });

  const g = sectionTextForCompile(d.goal);
  const seq = sectionTextForCompile(d.operational_sequence);
  const ctx = sectionTextForCompile(d.context);
  const must = sectionTextForCompile(d.constraints.must);
  const mustNot = sectionTextForCompile(d.constraints.must_not);
  const pers = sectionTextForCompile(d.personality);
  const tone = sectionTextForCompile(d.tone);

  const blocks = [];
  const add = (label, text) => {
    if (text) blocks.push(`${label}: ${text}`);
  };

  if (p === 'elevenlabs') {
    add('Goal', g);
    add('Sequence', seq);
    if (must || mustNot) {
      const c = [must ? `Must: ${must}` : '', mustNot ? `Must not: ${mustNot}` : ''].filter(Boolean).join(' ');
      if (c) blocks.push(`Constraints: ${c}`);
    }
    add('Personality', pers);
    add('Tone', tone);
    const system_prompt = blocks.join('\n').trim() || '(no non-missing sections)';
    return { platform: resolveResponsePlatformKey(p), system_prompt };
  }

  if (p === 'openai') {
    add('Role and objective', g);
    add('Operational sequence', seq);
    add('Context', ctx);
    if (must) add('Must', must);
    if (mustNot) add('Must not', mustNot);
    add('Personality', pers);
    add('Speaking style', tone);
    const system_prompt = blocks.join('\n\n').trim() || '(no non-missing sections)';
    return { platform: resolveResponsePlatformKey(p), system_prompt };
  }

  if (p === 'anthropic') {
    const principles = [must ? `Must: ${must}` : '', mustNot ? `Must not: ${mustNot}` : ''].filter(Boolean).join('\n');
    const instructions = [g, seq].filter(Boolean).join('\n\n');
    const behavior = [pers, tone].filter(Boolean).join('\n\n');
    const parts = [];
    if (principles) parts.push(`Principles:\n${principles}`);
    if (instructions) parts.push(`Instructions:\n${instructions}`);
    if (behavior) parts.push(`Behavior:\n${behavior}`);
    if (ctx) parts.push(`Context:\n${ctx}`);
    const system_prompt = parts.join('\n\n').trim() || '(no non-missing sections)';
    return { platform: resolveResponsePlatformKey(p), system_prompt };
  }

  if (p === 'google') {
    add('Objective', g);
    add('Steps', seq);
    add('Context', ctx);
    if (must) add('Requirements', must);
    if (mustNot) add('Prohibitions', mustNot);
    add('Persona', pers);
    add('Tone', tone);
    const system_prompt = blocks.join('\n\n').trim() || '(no non-missing sections)';
    return { platform: resolveResponsePlatformKey(p), system_prompt };
  }

  add('goal', g);
  add('operational_sequence', seq);
  add('context', ctx);
  if (must) add('constraints_must', must);
  if (mustNot) add('constraints_must_not', mustNot);
  add('personality', pers);
  add('tone', tone);
  const system_prompt = blocks.join('\n\n').trim() || '(no non-missing sections)';
  return { platform: resolveResponsePlatformKey(p), system_prompt };
}

/**
 * Phase 2: platform system prompt — deterministic assembly only (no LLM).
 * @param {string} platform
 * @param {object} structuredDesign
 * @param {{ mode?: string }} [options]
 * @returns {Promise<{ platform: string, system_prompt: string }>}
 */
async function generatePlatformPrompt(platform, structuredDesign, options = {}) {
  try {
    const opts = options && typeof options === 'object' ? options : {};
    if (opts.mode === 'llm_compiled') {
      throw new Error('llm_compiled has been removed; only deterministic compile is supported');
    }

    pipelineLog('Phase2', 'INPUT', {
      path: 'deterministic',
      platform,
      structured_design_in: structuredDesign,
      options_summary: summarizeGenerateOptions(opts),
      note: 'generatePlatformPrompt_entry',
    });

    pipelineLog('Phase2', 'SYSTEM_PROMPT', '[deterministic] No LLM (string assembly only).');
    pipelineLog('Phase2', 'USER_PROMPT', '[deterministic] No LLM user prompt.');
    pipelineLog('Phase2', 'MODEL_PARAMS', buildModelLogPayloadNoLlm());
    pipelineLog('Phase2', 'RAW_RESPONSE', '[deterministic] No LLM raw response.');
    const out = compileDeterministicPlatformPrompt(platform, structuredDesign);
    pipelineLog('Phase2', 'OUTPUT', out);
    return out;
  } catch (err) {
    logError('Phase2', err);
    throw err;
  }
}

module.exports = {
  extractStructure,
  generatePlatformPrompt,
  validateStructuredDesign,
  normalizePhase1StructuredDesign,
  EXTRACT_SYSTEM,
  isMissingToken,
  sectionTextForCompile,
};
