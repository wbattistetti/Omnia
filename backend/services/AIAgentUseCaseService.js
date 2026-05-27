// Use case composer: LLM helpers for generate / regenerate (design-time only).

const { extractJsonString } = require('./AIAgentDesignService');
const {
  extractAndParseModelJson,
  buildCompactJsonRetryDirective,
  buildStrictJsonRetryDirective,
  shouldRetryModelJsonParse,
  throwModelJsonParseFailure,
} = require('./modelJsonResponse');

const USE_CASE_JSON_PARSE_MAX_ATTEMPTS = 3;
const {
  USE_CASE_BUNDLE_CHUNK_SIZE,
  USE_CASE_BUNDLE_MAX_TOTAL,
} = require('./useCaseBundleChunkConfig');
const { mergeCreateUseCaseWithDraft } = require('./mergeCreateUseCaseDraft');
const { normalizeUseCaseScenarioFields, scenarioTextForLlm } = require('./useCaseScenarioFields');
const {
  flattenUseCasesDepthFirst,
  applyNarrativeOrder,
} = require('./useCaseNarrativeOrder');
const {
  coalesceRawUseCasesDialogue,
  useCasesMissingAssistantContent,
  buildDialogueCompleteRetryDirective,
  throwUseCasesMissingDialogue,
} = require('./useCaseDialogueEnforcement');

/**
 * HTTP timeout for the OpenAI/Groq request (BaseProvider.makeRequest).
 * Must stay >= client abort in src/services/aiAgentDesignApi.ts (GENERATE_USE_CASES_TIMEOUT_MS).
 */
const GENERATE_USE_CASE_BUNDLE_TIMEOUT_MS = 300000;
/** Second pass: narrative reorder of generated use_cases (same HTTP request as bundle). */
const NARRATIVE_REORDER_USE_CASES_TIMEOUT_MS = 120000;

/** Regenerate single scenario / turn: allow more than default 60s provider cap. */
const REGENERATE_USE_CASE_TIMEOUT_MS = 120000;
const REGENERATE_TURN_TIMEOUT_MS = 90000;
/** Batch rewrite assistant example lines to match user-edited style references (wizard passo 2). */
const PROPAGATE_EXAMPLE_PHRASE_STYLE_TIMEOUT_MS = 120000;
/** Debugger flow-mode: classify turn vs catalog / suggest new scenario. */
const ANALYZE_DEBUG_TURN_TIMEOUT_MS = 90000;
/** Root composer: decide 1..N use case drafts from free text (meaning, not punctuation). */
const SPLIT_ROOT_USE_CASE_DRAFT_TIMEOUT_MS = 90000;
const SPLIT_ROOT_USE_CASE_DRAFT_MAX_LABELS = 30;

/**
 * Regole universali catalogo use case: un pattern conversazionale per riga, non enumerazione
 * per entità/attributo di dominio (valido per qualsiasi settore).
 */
const USE_CASE_CATALOG_ABSTRACTION_RULES = `CATALOG_ABSTRACTION (any domain — booking, retail, IT support, finance, healthcare, etc.):
- Emit one use_case per **conversational pattern**: same user goal, same agent questions and order, same outcomes. Count **patterns**, not every catalog item in the task.
- **Entity** (product, service, department, city, plan, ticket type, policy, module, SKU, …): express generically in "label" and "scenario.llm"; put varying words in bracket **slots** in dialogue. Use **one worked example** in natural language — the platform compiles surfaces to canonical slots and parametric grids cover other entities later.
- **Attribute / choice** (first-time vs renewal, standard vs premium, visit type, priority, severity, channel, …): same rule — one use_case for the decision; do not spawn siblings per attribute value when the script is unchanged.
- Emit a **separate** use_case only when the **conversation script or guardrails** change (extra questions, refusal, escalation, different outcome), not when only entity or attribute **values** change.
- Before adding a row, ask: "If I replace the catalog noun with another item governed by the same rules, does the assistant dialogue change?" If **no** → do not add; merge into an existing pattern.
- **Anti-pattern:** N use_cases whose labels only swap a proper noun ("… for X", "… for Y", "… for Z") with identical logic.
- **Good pattern:** one row — generic label and scenario.llm ("Resolve <choice> for the requested <entity>"); dialogue with [entity] and [choice] slots (snake_case slot_id or mappable surfaces); ONE concrete instance in prose, not a list of every item from DESIGNER_TASK_DESCRIPTION.
- "label" must not name a single catalog item unless the scenario truly applies only there by explicit business rule.
- Prefer fewer generalized roots (and parent/child when flows fork) over exhaustively instantiating every noun in the task description.
- **Never pad** with shallow duplicates — including **parameter variants** (same decision repeated per catalog noun or enum value).`;

const UC_SYSTEM = `You are an expert conversational AI designer for OMNIA.
Respond with a single valid JSON object only (no markdown fences, no commentary).
Every id and turn_id in the JSON must be a string value (quoted), never a number.
When OUTPUT_LANGUAGE is set, write every human-readable string in that language.
Never output "editable" (the platform injects it).

Each use case must include:
- one concise synthetic scenario ("scenario.llm", mirrored to "payoff")
- a single assistant "dialogue" turn (the virtual agent output example only; content must never be empty)

For assistant "content":
- mark only the variable semantic fragment with brackets
- in Italian, keep articles, prepositions, and fixed function words outside the brackets (e.g., \`alle [14]\`, not \`[alle 14]\`)
- plain text outside brackets is fixed script; bracket inners are runtime-filled slots
- **assistant messages must be extremely concise, in the style of a real call-center agent: 1–2 short sentences, direct, no explanations, no introductory phrases, no redundancy**

One use_case per conversational pattern; parameterize catalog entities and attribute choices with slots — do not enumerate separate use_cases per product, service, department, or enum value when the agent script is the same.

The user message may give a numeric band for how many "use_cases" to emit — follow it when it fits the task. Do not collapse to exactly four scenarios by habit; vary the count with real pattern coverage, not catalog enumeration.`;

/** System prompt for annotate_assistant_message_for_json only — avoids UC_SYSTEM “design full use case” framing. */
const ANNOTATE_ASSISTANT_FOR_JSON_SYSTEM = `You annotate existing assistant messages for OMNIA runtime JSON templating.
Respond with a single valid JSON object only (no markdown fences, no commentary).
The user message contains the authoritative assistant text under "Current assistant message text": preserve that wording exactly except for inserting [slot_id] brackets and optional obvious spelling/typo fixes. Do not paraphrase, rephrase for style, add/remove sentences, or normalize tone.
When OUTPUT_LANGUAGE is set, slot labels and motor surfaces still follow the scenario language.
For bracket placement: mark only variable semantic fragments. In Italian, keep articles, prepositions, and fixed function words outside brackets (e.g. \`alle [ora_disponibile]\` not \`[alle 8]\`).`;

const STYLE_IDS = new Set(['cortese', 'ironico', 'formale']);

function makeTurnId() {
  return `t-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function coerceStyleId(raw) {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (STYLE_IDS.has(s)) return s;
  return 'cortese';
}

/**
 * @param {unknown} t
 */
function normalizeDialogueTurn(t) {
  if (!t || typeof t !== 'object') return null;
  const role = t.role === 'user' ? 'user' : 'assistant';
  const turn_id = typeof t.turn_id === 'string' && t.turn_id.trim() ? t.turn_id.trim() : makeTurnId();
  const content = typeof t.content === 'string' ? t.content : '';
  if (role === 'user') {
    return { turn_id, role: 'user', content, editable: false };
  }
  const base = { turn_id, role: 'assistant', content, editable: true };
  const ms = t.motor_snapshot;
  if (
    ms &&
    typeof ms === 'object' &&
    typeof ms.source_content === 'string' &&
    ms.payload &&
    typeof ms.payload === 'object'
  ) {
    base.motor_snapshot = ms;
  }
  return base;
}

/**
 * Keep only the first assistant turn as the canonical agent output example.
 * @param {unknown[]} dialogueIn
 */
function normalizeDialogueAgentOnly(dialogueIn) {
  const mapped = Array.isArray(dialogueIn)
    ? dialogueIn.map((t) => normalizeDialogueTurn(t)).filter(Boolean)
    : [];
  const assistant = mapped.find((x) => x.role === 'assistant');
  if (assistant) {
    return [{ turn_id: assistant.turn_id, role: 'assistant', content: assistant.content, editable: true }];
  }
  /** Garantisce un turno assistente così l’UI può mostrare messaggio + rigenera anche se il modello omette. */
  return [{ turn_id: makeTurnId(), role: 'assistant', content: '', editable: true }];
}

/**
 * @param {object} uc
 * @param {string} [globalStyleId]
 */
function normalizeUseCase(uc, globalStyleId) {
  if (!uc || typeof uc !== 'object') return uc;
  const dialogueIn = Array.isArray(uc.dialogue) ? uc.dialogue : [];
  const dialogue = normalizeDialogueAgentOnly(dialogueIn);
  const style_id = coerceStyleId(globalStyleId ?? uc.style_id ?? uc.style);
  const { style: _drop, editable: _e, ...rest } = uc;
  return normalizeUseCaseScenarioFields({ ...rest, dialogue, style_id });
}

/**
 * @param {{ logical_steps: object[], use_cases: object[] }} bundle
 * @param {string} [globalStyleId]
 */
function normalizeUseCaseBundle(bundle, globalStyleId) {
  const use_cases = bundle.use_cases.map((u) => normalizeUseCase(u, globalStyleId));
  return { logical_steps: bundle.logical_steps, use_cases };
}

/**
 * Build a one-line summary of the assistant `dialogue` shape for each parsed use case, used to
 * diagnose silent regressions (e.g. reasoning models that return `dialogue: []` or
 * `content: ""` despite the prompt requiring a non-empty agent line). Returns an array of strings
 * in the form `<idx>:role=...|contentLen=N|fields=[...]`, where `fields` lists alternative keys
 * the model may have used for the assistant text (`assistant_message`, `agent_text`, ...).
 *
 * @param {object[]} useCases
 * @returns {string[]}
 */
function summarizeUseCaseDialogueShapes(useCases) {
  if (!Array.isArray(useCases)) return [];
  const ALT_KEYS = ['assistant_message', 'assistant_text', 'agent_text', 'agent_message', 'message', 'example', 'example_message'];
  return useCases.map((uc, idx) => {
    if (!uc || typeof uc !== 'object') return `${idx}:non-object`;
    const dialogue = Array.isArray(uc.dialogue) ? uc.dialogue : null;
    let part;
    if (!dialogue) {
      part = 'dialogue=missing';
    } else if (dialogue.length === 0) {
      part = 'dialogue=empty';
    } else {
      const first = dialogue.find((t) => t && typeof t === 'object' && t.role === 'assistant') || dialogue[0];
      const role = first && typeof first === 'object' ? first.role : 'n/a';
      const content = first && typeof first === 'object' ? first.content : undefined;
      const contentLen = typeof content === 'string' ? content.length : -1;
      part = `dialogue.role=${role}|contentLen=${contentLen}`;
    }
    const altPresent = ALT_KEYS.filter((k) => typeof uc[k] === 'string' && uc[k].trim());
    const altPart = altPresent.length ? `|altKeys=[${altPresent.join(',')}]` : '';
    const id = typeof uc.id === 'string' ? uc.id : 'n/a';
    return `${idx}(id=${id}):${part}${altPart}`;
  });
}

/**
 * Log a compact summary of the assistant dialogue shape returned by the LLM, plus the count of
 * use cases whose canonical assistant `content` is empty after parsing — that count is the
 * direct upstream cause of the empty bubble the designer sees in the UI.
 *
 * @param {string} stage e.g. 'bundle' or 'extend'
 * @param {string|undefined} model
 * @param {object[]} useCases
 */
function logUseCaseDialogueDiagnostics(stage, model, useCases) {
  const shapes = summarizeUseCaseDialogueShapes(useCases);
  const emptyContentCount = shapes.filter((s) => /contentLen=0(\D|$)/.test(s) || /contentLen=-1(\D|$)/.test(s) || /dialogue=(empty|missing)/.test(s)).length;
  console.log(
    `[useCases:${stage}] model=${model || 'n/a'} count=${useCases.length} emptyAssistantContent=${emptyContentCount}`
  );
  if (emptyContentCount > 0) {
    console.warn(`[useCases:${stage}] dialogue shapes:`, shapes.slice(0, 12));
  }
}

/**
 * Random band per HTTP request so the model cannot settle on a ritual count (e.g. four).
 * Groq models are often capped at 8192 completion tokens — keep the first-pass band smaller.
 * @param {'openai'|'groq'|string} [provider]
 * @returns {{ lo: number, hi: number }}
 */
function pickBundleScenarioTargetBand(provider) {
  if (provider === 'openai') {
    const lo = 8 + Math.floor(Math.random() * 5); // 8–12
    const hi = Math.min(lo + 4 + Math.floor(Math.random() * 7), 24); // lo+4 … lo+10, cap 24
    return { lo, hi };
  }
  const lo = 5 + Math.floor(Math.random() * 3); // 5–7
  const hi = Math.min(lo + 2 + Math.floor(Math.random() * 4), 10); // lo+2 … lo+5, cap 10
  return { lo, hi };
}

/** Output token budget for full use-case bundle generation. */
function resolveUseCaseBundleMaxTokens(provider) {
  return provider === 'openai' ? 32768 : 8192;
}

/** Band for **new** rows only in extend mode (different scale than full bundle). */
function pickExtendNewScenarioTargetBand() {
  const lo = 3 + Math.floor(Math.random() * 4); // 3–6
  const hi = Math.min(lo + 3 + Math.floor(Math.random() * 6), 14);
  return { lo, hi };
}

/**
 * @param {string} outputLanguage
 * @param {string} userDesc
 * @param {string} [runtimeContext] composed markdown or summary
 * @param {{ lo: number, hi: number }} [scenarioBand] from {@link pickBundleScenarioTargetBand}
 */
function buildGenerateUseCasesUserMessage(userDesc, outputLanguage, runtimeContext, scenarioBand) {
  const lang =
    typeof outputLanguage === 'string' && outputLanguage.trim()
      ? `\nOUTPUT_LANGUAGE (BCP 47): ${outputLanguage.trim()}\n`
      : '';
  const ctx =
    typeof runtimeContext === 'string' && runtimeContext.trim()
      ? `\nRUNTIME_PROMPT_OR_SECTIONS (context):\n"""\n${runtimeContext.slice(0, 12000)}\n"""\n`
      : '';
  const band =
    scenarioBand &&
    typeof scenarioBand.lo === 'number' &&
    typeof scenarioBand.hi === 'number' &&
    scenarioBand.lo > 0 &&
    scenarioBand.hi >= scenarioBand.lo
      ? `\nREQUEST_SCENARIO_BAND (this API call only — overrides blind defaults): For a normal multi-outcome agent, emit **between ${scenarioBand.lo} and ${scenarioBand.hi}** use_cases (roots and/or nested children). **If your draft has exactly four use_cases, revise before returning:** add missing branches/edge cases or merge true duplicates — four is a known shortcut to avoid. Only fewer than ${scenarioBand.lo} if the DESIGNER_TASK_DESCRIPTION is explicitly a minimal single-path demo; only more than ${scenarioBand.hi} if the domain clearly needs deeper coverage.\n`
      : '';
  return `${lang}DESIGNER_TASK_DESCRIPTION:
"""
${userDesc}
"""
${ctx}${band}
Produce JSON with exactly:
1) "logical_steps" — array of { "id": string (snake_case), "description": string } — **6–14** ordered steps the agent follows (use **5–15** if needed; do **not** read this range as the number of use_cases). Start counts here from **six**, not four.
2) "use_cases" — array. **No fixed count:** derive how many **distinct conversational patterns** from DESIGNER_TASK_DESCRIPTION plus REQUEST_SCENARIO_BAND above — not one row per catalog item. Typical non-trivial flows need **several distinct patterns**; complex domains need **many patterns**, not **many entity instances**. **Never pad** with shallow duplicates or parameter variants (same script, different catalog noun). **Do not treat “four” as a batch size.** A **tiny** micro-task may need **2–3** scenarios; a broad task should **greatly exceed four** only when distinct **flows** demand it. Each object:
   - "id": string (unique among all use_cases)
   - "label": string — short descriptive title for this scenario only (who/what/goal). Do NOT prefix with situation-type or category names (forbidden: "Chiarimento:", "Selezione:", "Ingresso:", etc.); thematic grouping is assigned later in separate categories.
   - "scenario": object with exactly:
     - "llm": string — minimal synthetic scenario (who, goal, constraints, outcome) in telegraphic form for designers and LLM routing (1–3 short lines; NOT the agent dialogue script).
     - "descrittivo": string — MUST equal "scenario.llm" exactly (platform mirror).
   - "payoff": string — MUST equal "scenario.llm" exactly.
   - "parent_id": string | null — null = root; if a string, it MUST equal the "id" of another object in this same "use_cases" array (no dangling references)
   - "sort_order": number — among siblings (same parent_id), use 0-based integers 0,1,2,... with strictly increasing order (no ties per sibling group)
   - "refinement_prompt": string (may be "")
   - "dialogue": array containing EXACTLY ONE object: { "turn_id": string, "role": "assistant", "content": string } — the virtual agent spoken output example for this scenario only (concise, follows GLOBAL_STYLE_CONTRACT). **"content" MUST be non-empty substantive Italian (or OUTPUT_LANGUAGE) prose** — at least one full sentence the agent would say in this scenario; never omit, never use only placeholders. No user turns. Do NOT include "editable".
   - "notes": { "behavior": string, "tone": string } — may summarize payoff briefly in "behavior" if helpful
   - "bubble_notes": {} (may be empty object)

ID rules:
- All "id" and "turn_id" values must be non-empty strings in JSON (never numeric types).
- "logical_steps"[].id must be pairwise distinct from each other.
- "use_cases"[].id must be pairwise distinct from each other and must not collide with any "logical_steps"[].id.

Content rules:
- Every human-readable string must strictly relate to the DESIGNER_TASK_DESCRIPTION${ctx ? ' and stay consistent with RUNTIME_PROMPT_OR_SECTIONS when provided above' : ''}.
- "scenario.llm" must make the scenario understandable without a multi-turn transcript.

${USE_CASE_CATALOG_ABSTRACTION_RULES}

Coverage (not a four-item checklist): where relevant, span **situation types** (success path, corrections/clarifications, ambiguity, refusals/guardrails) as **patterns** — using as many use_cases as **distinct flows** require (parent/child when a pattern has real branches). **Do not** interpret coverage as listing every service, product, department, or specialty from the task. **Listing themes does not mean “output exactly four use_cases”.**
Return valid JSON only.`;
}

/**
 * First batch only: logical_steps skeleton + fixed-size use_cases slice (chunked pipeline).
 * @param {string} userDesc
 * @param {string} [outputLanguage]
 * @param {string} [runtimeContext]
 */
function buildGenerateUseCasesInitialChunkUserMessage(userDesc, outputLanguage, runtimeContext) {
  const lang =
    typeof outputLanguage === 'string' && outputLanguage.trim()
      ? `\nOUTPUT_LANGUAGE (BCP 47): ${outputLanguage.trim()}\n`
      : '';
  const ctx =
    typeof runtimeContext === 'string' && runtimeContext.trim()
      ? `\nRUNTIME_PROMPT_OR_SECTIONS (context):\n"""\n${runtimeContext.slice(0, 12000)}\n"""\n`
      : '';
  const n = USE_CASE_BUNDLE_CHUNK_SIZE;
  return `${lang}DESIGNER_TASK_DESCRIPTION:
"""
${userDesc}
"""
${ctx}
CHUNKED_GENERATION (batch 1 of several): This call is only the **first batch**. Later API calls will add more scenarios — do **not** try to exhaust the whole domain now.

Produce JSON with exactly:
1) "logical_steps" — array of { "id": string (snake_case), "description": string } — **6–10** ordered steps for the full agent (stable skeleton for all future batches).
2) "use_cases" — array of **exactly ${n}** scenario objects (first coverage slice). Each object:
   - "id": string (unique among all use_cases in this response)
   - "label": string
   - "scenario": { "llm": string, "descrittivo": string (= llm) }
   - "payoff": string (= llm)
   - "parent_id": string | null
   - "sort_order": number
   - "refinement_prompt": string (may be "")
   - "dialogue": [ { "turn_id": string, "role": "assistant", "content": string } ] — one non-empty assistant sentence
   - "notes": { "behavior": string, "tone": string }
   - "bubble_notes": {}

Pick ${n} **high-value distinct conversational patterns** (e.g. opening, clarification, success, guardrail — expressed in scenario.llm, not as "Tipo:" prefixes in labels). Do **not** spend this batch listing every catalog entity from the task — follow CATALOG_ABSTRACTION in the system message.

${USE_CASE_CATALOG_ABSTRACTION_RULES}

Keep scenario.llm to 1–3 telegraphic lines. Use-case "label" must describe the **pattern**, not a single catalog item name.

CRITICAL: Every use_cases[i] MUST have non-empty dialogue[0].content (one full assistant sentence). Rows without a message are invalid.

Return valid JSON only.`;
}

/**
 * Parse model JSON with parse + dialogue completeness retries.
 * @param {object} params
 * @param {(userSuffix: string) => Promise<unknown>} params.callModel
 * @param {number} params.maxAttempts
 * @param {boolean} [params.chunkedPipeline]
 * @param {number} [params.compactLo]
 * @param {number} [params.compactHi]
 * @param {string} params.stage
 * @param {boolean} [params.allowEmptyUseCases]
 */
async function parseUseCaseModelJsonWithRetries({
  callModel,
  maxAttempts,
  chunkedPipeline = true,
  compactLo,
  compactHi,
  stage,
  allowEmptyUseCases = false,
}) {
  let dialogueRetrySuffix = '';
  let lastFail;
  for (let attemptIndex = 0; attemptIndex < maxAttempts; attemptIndex++) {
    let userSuffix = dialogueRetrySuffix;
    if (!userSuffix) {
      if (attemptIndex === 0) {
        userSuffix = '';
      } else if (attemptIndex === 1 && typeof compactLo === 'number' && typeof compactHi === 'number') {
        userSuffix = buildCompactJsonRetryDirective(compactLo, compactHi);
      } else {
        userSuffix = buildStrictJsonRetryDirective();
      }
    }
    const response = await callModel(userSuffix);
    const result = extractAndParseModelJson(response, { errorLabel: 'Model' });
    if (!result.ok) {
      lastFail = result;
      const canRetryParse = chunkedPipeline
        ? shouldRetryModelJsonParse(attemptIndex, maxAttempts, true)
        : attemptIndex === 0 && result.truncated;
      if (!canRetryParse) break;
      dialogueRetrySuffix = '';
      continue;
    }
    let parsed = result.parsed;
    if (Array.isArray(parsed.use_cases)) {
      parsed = { ...parsed, use_cases: coalesceRawUseCasesDialogue(parsed.use_cases) };
    }
    if (allowEmptyUseCases && (!parsed.use_cases || parsed.use_cases.length === 0)) {
      return parsed;
    }
    const missing = useCasesMissingAssistantContent(parsed.use_cases || []);
    if (missing.length === 0) {
      return parsed;
    }
    if (attemptIndex < maxAttempts - 1) {
      dialogueRetrySuffix = buildDialogueCompleteRetryDirective(missing);
      continue;
    }
    throwUseCasesMissingDialogue(missing, stage, maxAttempts);
  }
  throwModelJsonParseFailure(lastFail);
}

function buildGlobalStyleBlock(globalStyleContract) {
  const contract = typeof globalStyleContract === 'string' ? globalStyleContract.trim() : '';
  if (!contract) return '';
  return `\nGLOBAL_STYLE_CONTRACT:\n${contract}\nApply this style contract consistently to every assistant turn.`;
}

/**
 * @param {unknown} raw
 * @returns {{ logical_steps: object[], use_cases: object[] }}
 */
function validateUseCaseBundle(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid use case JSON: not an object');
  }
  const ls = raw.logical_steps;
  const uc = raw.use_cases;
  if (!Array.isArray(ls) || ls.length === 0) {
    throw new Error('Invalid use case JSON: logical_steps must be a non-empty array');
  }
  if (!Array.isArray(uc) || uc.length === 0) {
    throw new Error('Invalid use case JSON: use_cases must be a non-empty array');
  }
  return { logical_steps: ls, use_cases: uc };
}

/**
 * Extend bundle: only `use_cases` (new scenarios to append).
 * @param {unknown} raw
 */
function validateExtendUseCases(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid extend use case JSON: not an object');
  }
  const uc = raw.use_cases;
  const coverage_complete =
    raw.coverage_complete === true || raw.coverageComplete === true;
  if (!Array.isArray(uc)) {
    throw new Error('Invalid extend JSON: use_cases must be an array');
  }
  if (uc.length === 0 && !coverage_complete) {
    throw new Error('Invalid extend JSON: use_cases empty without coverage_complete');
  }
  return { use_cases: uc, coverage_complete };
}

/**
 * Compact summary of existing scenarios so the model avoids duplicates.
 * @param {object[]} existingUseCases
 */
function summarizeExistingUseCasesForPrompt(existingUseCases) {
  const arr = Array.isArray(existingUseCases) ? existingUseCases : [];
  return arr.map((u) => ({
    label: typeof u.label === 'string' ? u.label.slice(0, 160) : '',
    payoff_excerpt: String(scenarioTextForLlm(u) || u.payoff || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 280),
  }));
}

/**
 * @param {string} userDesc
 * @param {string} [outputLanguage]
 * @param {string} [runtimeContext]
 * @param {object[]} existingUseCases
 * @param {object[]} existingLogicalSteps
 */
function buildExtendUseCasesUserMessage(
  userDesc,
  outputLanguage,
  runtimeContext,
  existingUseCases,
  existingLogicalSteps,
  newScenarioBand,
  opts = {}
) {
  const chunked = opts.chunked === true;
  const lang =
    typeof outputLanguage === 'string' && outputLanguage.trim()
      ? `\nOUTPUT_LANGUAGE (BCP 47): ${outputLanguage.trim()}\n`
      : '';
  const ctx =
    typeof runtimeContext === 'string' && runtimeContext.trim()
      ? `\nRUNTIME_PROMPT_OR_SECTIONS (context):\n"""\n${runtimeContext.slice(0, 12000)}\n"""\n`
      : '';
  const existingJson = JSON.stringify(summarizeExistingUseCasesForPrompt(existingUseCases)).slice(0, 14000);
  const lsJson = JSON.stringify(
    Array.isArray(existingLogicalSteps)
      ? existingLogicalSteps.map((s) => ({
          id: typeof s.id === 'string' ? s.id : '',
          description:
            typeof s.description === 'string' ? String(s.description).slice(0, 240) : '',
        }))
      : []
  ).slice(0, 8000);

  const band = chunked
    ? `\nNEW_USE_CASES_BATCH (chunked pipeline): add **up to ${USE_CASE_BUNDLE_CHUNK_SIZE}** net-new scenarios (minimum 1 while meaningful gaps remain). Set "coverage_complete": true when no significant new scenarios remain (themes already in ALREADY_DEFINED_USE_CASES). If coverage_complete is true, "use_cases" may be []. Total catalog cap is about ${USE_CASE_BUNDLE_MAX_TOTAL} — stop adding shallow variants.\n`
    : newScenarioBand &&
        typeof newScenarioBand.lo === 'number' &&
        typeof newScenarioBand.hi === 'number' &&
        newScenarioBand.lo > 0 &&
        newScenarioBand.hi >= newScenarioBand.lo
      ? `\nNEW_USE_CASES_BAND (this call only): add **between ${newScenarioBand.lo} and ${newScenarioBand.hi}** net-new scenarios. **Do not add exactly four new rows** unless unavoidable — split edges or combine duplicates if you hit four by habit.\n`
      : '';

  return `${lang}DESIGNER_TASK_DESCRIPTION:
"""
${userDesc}
"""
${ctx}
EXISTING_LOGICAL_STEPS (reference — stay consistent with the agent flow):
${lsJson}

ALREADY_DEFINED_USE_CASES (do **not** duplicate these themes, labels, or near-identical payoffs):
${existingJson}
${band}
Produce JSON with **exactly one** top-level key:
"use_cases" — array of **NEW** scenarios only (minimum 1). Each object uses the same shape as in the full bundle:
"id", "label", "scenario" ({ "llm", "descrittivo" (= llm) }), "payoff" (= llm), "parent_id", "sort_order", "refinement_prompt",
"dialogue" (exactly one assistant turn), "notes", "bubble_notes".

Rules:
- Only **net-new** **patterns** that expand coverage relative to ALREADY_DEFINED_USE_CASES — not another catalog entity with the same script as an existing row.
- How many: **as many as remain meaningful** — typically **1–14** added items depending on **flow** gaps; **never** output a fixed ritual count (e.g. always four). **Do not pad** with shallow variants or entity/attribute enumeration.

${USE_CASE_CATALOG_ABSTRACTION_RULES}

- Use **new** unique string ids among themselves; parent_id may reference another **new** id in this array or null.
- Each assistant "dialogue" turn **content** must be non-empty substantive prose (label + payoff + message triplet for designers). **Never return a use case without dialogue.content.**
${chunked ? '- Include top-level boolean "coverage_complete" (required).\n' : ''}
Return valid JSON only: { "use_cases": [ ... ]${chunked ? ', "coverage_complete": boolean' : ''} }`;
}

/**
 * @param {object} params
 * @param {string} params.userDesc
 * @param {object[]} params.existingUseCases
 * @param {object[]} params.existingLogicalSteps
 * @param {string} [params.runtimeContext]
 * @param {string} [params.outputLanguage]
 * @param {string} [params.provider]
 * @param {string} [params.model]
 * @param {import('./AIProviderService')} params.aiProviderService
 */
async function generateUseCaseBundleExtend({
  userDesc,
  runtimeContext,
  outputLanguage,
  globalStyleContract,
  globalStyleId,
  existingUseCases,
  existingLogicalSteps,
  provider = 'groq',
  model,
  purpose,
  taskId = null,
  taskLabel = null,
  aiProviderService,
  chunked = false,
}) {
  if (!userDesc || typeof userDesc !== 'string' || userDesc.trim().length < 8) {
    throw new Error('userDesc must be a non-empty string (at least 8 characters)');
  }
  if (!Array.isArray(existingUseCases) || existingUseCases.length === 0) {
    throw new Error('existingUseCases required for extend');
  }
  const newBand = pickExtendNewScenarioTargetBand();
  const maxTokens = resolveUseCaseBundleMaxTokens(provider);
  const maxAttempts = chunked ? USE_CASE_JSON_PARSE_MAX_ATTEMPTS : 2;
  const extendBaseUser = `${buildExtendUseCasesUserMessage(
    userDesc.trim(),
    outputLanguage,
    runtimeContext,
    existingUseCases,
    existingLogicalSteps || [],
    newBand,
    { chunked }
  )}${buildGlobalStyleBlock(globalStyleContract)}`;
  const parsed = await parseUseCaseModelJsonWithRetries({
    stage: chunked ? 'chunk_extend' : 'extend',
    maxAttempts,
    chunkedPipeline: chunked,
    compactLo: Math.max(2, newBand.lo - 1),
    compactHi: Math.min(6, newBand.hi),
    allowEmptyUseCases: true,
    callModel: async (userSuffix) =>
      aiProviderService.callAI(
        provider,
        [
          { role: 'system', content: UC_SYSTEM },
          { role: 'user', content: `${extendBaseUser}${userSuffix}` },
        ],
        {
          model: model || undefined,
          temperature: userSuffix.includes('OUTPUT_RETRY') ? 0.5 : 0.52,
          maxTokens,
          timeout: GENERATE_USE_CASE_BUNDLE_TIMEOUT_MS,
          purpose,
          taskId,
          taskLabel,
        }
      ),
  });
  const ext = validateExtendUseCases(parsed);
  logUseCaseDialogueDiagnostics('extend', model, ext.use_cases);
  const use_cases = ext.use_cases.map((u) => normalizeUseCase(u, globalStyleId));
  return { use_cases, coverage_complete: ext.coverage_complete === true };
}

/**
 * @param {object} params
 * @param {string} params.userDesc
 * @param {string} [params.runtimeContext]
 * @param {string} [params.outputLanguage]
 * @param {string} [params.provider]
 * @param {string} [params.model]
 * @param {import('./AIProviderService')} params.aiProviderService
 */
const NARRATIVE_REORDER_SYSTEM = `You order design-time use cases for OMNIA in a reasonably chronological narrative flow.
Respond with a single valid JSON object only (no markdown fences, no commentary).
Do NOT rewrite scenario text, labels, or dialogue — only permute order.`;

/**
 * @param {string} [outputLanguage]
 * @param {object[]} useCases normalized use cases (post pass 1)
 * @param {object[]} logicalSteps
 */
function buildNarrativeReorderUserMessage(outputLanguage, useCases, logicalSteps) {
  const lang =
    typeof outputLanguage === 'string' && outputLanguage.trim()
      ? `OUTPUT_LANGUAGE (BCP 47): ${outputLanguage.trim()}\n`
      : '';
  const compact = flattenUseCasesDepthFirst(useCases).map((u) => ({
    id: u.id,
    label: typeof u.label === 'string' ? u.label.slice(0, 80) : '',
    parent_id: u.parent_id ?? null,
    scenario_llm: scenarioTextForLlm(u).slice(0, 320),
  }));
  return `${lang}Reorder the use cases below into a **reasonably chronological** narrative sequence — as if walking through a typical conversation (not a rigid state machine).

Preferred progression among roots and siblings (adapt to domain):
ingresso / richiesta iniziale → chiarimenti → varianti / alternative → correzioni → casi problematici / rifiuti → conferma finale.

Rules:
- Include **every** id exactly once in "ordered_use_case_ids".
- Use **depth-first** order: parent before its children; siblings ordered by narrative position.
- Alternative branches (mutually exclusive paths) may sit adjacent; note ambiguity in ordering_note_it if needed.
- Do not omit or invent ids.

LOGICAL_STEPS (context):
${JSON.stringify(logicalSteps).slice(0, 4000)}

USE_CASES (id, label, parent_id, scenario_llm):
${JSON.stringify(compact).slice(0, 14000)}

Return JSON:
{
  "ordered_use_case_ids": ["<id>", ...],
  "ordering_note_it": "<1–2 sentences: order is indicative / reasonably chronological, not a strict runtime pipeline>"
}`;
}

/**
 * @param {object} params
 */
/**
 * First chunk: logical_steps + exactly USE_CASE_BUNDLE_CHUNK_SIZE use_cases (no narrative reorder).
 */
async function generateUseCaseBundleInitialChunk({
  userDesc,
  runtimeContext,
  outputLanguage,
  globalStyleContract,
  globalStyleId,
  provider = 'groq',
  model,
  purpose,
  taskId = null,
  taskLabel = null,
  aiProviderService,
}) {
  if (!userDesc || typeof userDesc !== 'string' || userDesc.trim().length < 8) {
    throw new Error('userDesc must be a non-empty string (at least 8 characters)');
  }
  const maxTokens = resolveUseCaseBundleMaxTokens(provider);
  const baseUser = `${buildGenerateUseCasesInitialChunkUserMessage(
    userDesc.trim(),
    outputLanguage,
    runtimeContext
  )}${buildGlobalStyleBlock(globalStyleContract)}`;
  const chunkSize = USE_CASE_BUNDLE_CHUNK_SIZE;
  const parsed = await parseUseCaseModelJsonWithRetries({
    stage: 'chunk_initial',
    maxAttempts: USE_CASE_JSON_PARSE_MAX_ATTEMPTS,
    chunkedPipeline: true,
    compactLo: chunkSize,
    compactHi: chunkSize,
    callModel: async (userSuffix) =>
      aiProviderService.callAI(
        provider,
        [
          { role: 'system', content: UC_SYSTEM },
          { role: 'user', content: `${baseUser}${userSuffix}` },
        ],
        {
          model: model || undefined,
          temperature: userSuffix.includes('OUTPUT_RETRY') ? 0.5 : 0.6,
          maxTokens,
          timeout: GENERATE_USE_CASE_BUNDLE_TIMEOUT_MS,
          purpose,
          taskId,
          taskLabel,
        }
      ),
  });
  const bundle = validateUseCaseBundle(parsed);
  logUseCaseDialogueDiagnostics('chunk_initial', model, bundle.use_cases);
  return normalizeUseCaseBundle(bundle, globalStyleId);
}

async function reorderUseCasesNarratively({
  useCases,
  logicalSteps,
  outputLanguage,
  provider = 'groq',
  model,
  purpose,
  taskId = null,
  taskLabel = null,
  aiProviderService,
}) {
  if (!Array.isArray(useCases) || useCases.length < 2) {
    return {
      use_cases: useCases,
      ordering_note_it:
        'Ordinamento narrativo non applicato: meno di due scenari nella lista.',
    };
  }
  const messages = [
    { role: 'system', content: NARRATIVE_REORDER_SYSTEM },
    {
      role: 'user',
      content: buildNarrativeReorderUserMessage(outputLanguage, useCases, logicalSteps || []),
    },
  ];
  const response = await aiProviderService.callAI(provider, messages, {
    model: model || undefined,
    temperature: 0.35,
    maxTokens: provider === 'openai' ? 4096 : 8192,
    timeout: NARRATIVE_REORDER_USE_CASES_TIMEOUT_MS,
    purpose: purpose || 'USE_CASE_BUNDLE_NARRATIVE_ORDER',
    taskId,
    taskLabel,
  });
  const content = response?.choices?.[0]?.message?.content;
  const jsonStr = extractJsonString(content);
  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    const err = new Error(`Narrative reorder returned non-JSON: ${e.message}`);
    err.rawSnippet = jsonStr.slice(0, 500);
    throw err;
  }
  const orderedIds = parsed.ordered_use_case_ids;
  if (!Array.isArray(orderedIds)) {
    throw new Error('Narrative reorder: missing ordered_use_case_ids array');
  }
  const reordered = applyNarrativeOrder(useCases, orderedIds);
  const note =
    typeof parsed.ordering_note_it === 'string' && parsed.ordering_note_it.trim()
      ? parsed.ordering_note_it.trim().slice(0, 500)
      : 'Ordine ragionevolmente cronologico per lettura designer; in conversazioni reali alcuni percorsi sono paralleli o saltabili.';
  return { use_cases: reordered, ordering_note_it: note };
}

const CATEGORIZE_USE_CASES_TIMEOUT_MS = 120000;
const USE_CASE_CATEGORIZE_MAX_ATTEMPTS = 3;

const CATEGORIZE_JSON_RETRY_SUFFIX =
  '\n\nOUTPUT_RETRY: Rispondi solo con JSON valido. Includi "categories" (non vuoto) e "use_case_placements" con ogni use_case_id esattamente una volta.';

const CATEGORIZE_SYSTEM = `You group design-time use cases into thematic categories for the OMNIA designer UI.
Respond with a single valid JSON object only (no markdown fences, no commentary).
Assign categories and ordering positions only. Do not rewrite scenario text or dialogue. Category names belong in "categories", not in use-case labels.`;

/** Rimuove prefisso "Categoria: titolo" quando coincide con la categoria assegnata. */
function stripCategoryPrefixFromLabel(label, categoryLabel) {
  if (typeof label !== 'string' || !label.trim()) return label;
  const trimmed = label.trim();
  const m = /^([^:]{2,48}):\s*(.+)$/.exec(trimmed);
  if (!m) return trimmed;
  if (
    categoryLabel &&
    m[1].trim().toLowerCase() !== String(categoryLabel).trim().toLowerCase()
  ) {
    return trimmed;
  }
  const rest = m[2].trim();
  return rest || trimmed;
}

/**
 * @param {string} [outputLanguage]
 * @param {object[]} useCases
 * @param {object[]} logicalSteps
 */
function buildCategorizeUserMessage(outputLanguage, useCases, logicalSteps) {
  const lang =
    typeof outputLanguage === 'string' && outputLanguage.trim()
      ? `OUTPUT_LANGUAGE (BCP 47): ${outputLanguage.trim()}\n`
      : '';
  const compact = flattenUseCasesDepthFirst(useCases).map((u) => ({
    id: u.id,
    label: typeof u.label === 'string' ? u.label.slice(0, 80) : '',
    parent_id: u.parent_id ?? null,
    scenario_llm: scenarioTextForLlm(u).slice(0, 280),
  }));
  return `${lang}Assign each use case to a **thematic category** so designers can scan the list (e.g. Ingresso, Disambiguazione, Successo, Errori / guardrail, Escalation — adapt to domain).

Rules:
- Emit **4–10** categories unless fewer than 4 use cases (then use 2–4).
- Category labels: short Italian titles (max ~6 words), designer-facing, UPPERCASE style optional in label text.
- "categories"[].description: 1–2 sentences in Italian explaining what belongs in this group (for designers), not a list of use cases.
- "categories"[].id: unique strings "cat_" + snake_case slug.
- "categories"[].sort_order: 0-based order of **categories** in logical reading flow (ingresso → … → chiusura).
- "use_case_placements": **every** use case id exactly once with category_id and "position" (0-based narrative/logical order **within that category**; respect parent/child: parent before children in position order).
- Do not invent use case ids.

LOGICAL_STEPS (context):
${JSON.stringify(logicalSteps || []).slice(0, 4000)}

USE_CASES:
${JSON.stringify(compact).slice(0, 14000)}

Return JSON:
{
  "categories": [ { "id": "cat_...", "label": "...", "description": "...", "sort_order": 0 } ],
  "use_case_placements": [ { "use_case_id": "<id>", "category_id": "cat_...", "position": 0 } ],
  "categorization_note_it": "<optional 1 sentence>"
}`;
}

/**
 * @param {object[]} useCases
 * @param {object} parsed model JSON
 */
function applyCategorizationFromModel(useCases, parsed) {
  const rawCats = parsed.categories;
  if (!Array.isArray(rawCats) || rawCats.length === 0) {
    throw new Error('Categorize: missing categories array');
  }
  const placements = parsed.use_case_placements;
  if (!Array.isArray(placements) || placements.length === 0) {
    throw new Error('Categorize: missing use_case_placements array');
  }
  const categories = rawCats
    .map((c, i) => {
      if (!c || typeof c !== 'object') return null;
      const id = typeof c.id === 'string' ? c.id.trim() : '';
      const label = typeof c.label === 'string' ? c.label.trim() : '';
      const sort_order =
        typeof c.sort_order === 'number' && Number.isFinite(c.sort_order) ? c.sort_order : i;
      const description =
        typeof c.description === 'string' && c.description.trim()
          ? c.description.trim().slice(0, 500)
          : '';
      if (!id || !label) return null;
      return { id, label, sort_order, ...(description ? { description } : {}) };
    })
    .filter(Boolean)
    .sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label));

  const byId = new Map(useCases.map((u) => [u.id, u]));
  const catIds = new Set(categories.map((c) => c.id));
  const placementByUc = new Map();
  for (const p of placements) {
    if (!p || typeof p !== 'object') continue;
    const ucId = typeof p.use_case_id === 'string' ? p.use_case_id.trim() : '';
    const catId = typeof p.category_id === 'string' ? p.category_id.trim() : '';
    const position =
      typeof p.position === 'number' && Number.isFinite(p.position) ? p.position : 0;
    if (!ucId || !catId || !byId.has(ucId) || !catIds.has(catId)) continue;
    placementByUc.set(ucId, { category_id: catId, position });
  }

  const catById = new Map(categories.map((c) => [c.id, c]));
  let withCategory = useCases.map((uc) => {
    const pl = placementByUc.get(uc.id);
    if (!pl || !catIds.has(pl.category_id)) {
      const { category_id: _drop, ...rest } = uc;
      return rest;
    }
    const cat = catById.get(pl.category_id);
    const label = cat
      ? stripCategoryPrefixFromLabel(uc.label, cat.label)
      : typeof uc.label === 'string'
        ? uc.label
        : '';
    return { ...uc, category_id: pl.category_id, label };
  });

  const reorderedChunks = [];
  const assigned = new Set();
  for (const cat of categories) {
    const ids = placements
      .filter(
        (p) =>
          p &&
          typeof p === 'object' &&
          typeof p.category_id === 'string' &&
          p.category_id.trim() === cat.id &&
          typeof p.use_case_id === 'string' &&
          byId.has(p.use_case_id.trim())
      )
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((p) => p.use_case_id.trim());
    const missing = withCategory
      .filter((u) => u.category_id === cat.id && !ids.includes(u.id))
      .map((u) => u.id);
    const orderedIds = [...ids, ...missing];
    if (orderedIds.length === 0) continue;
    const subset = withCategory.filter((u) => orderedIds.includes(u.id));
    try {
      const reordered = applyNarrativeOrder(subset, orderedIds);
      for (const u of reordered) {
        reorderedChunks.push(u);
        assigned.add(u.id);
      }
    } catch {
      for (const id of orderedIds) {
        const u = subset.find((x) => x.id === id);
        if (u) {
          reorderedChunks.push(u);
          assigned.add(u.id);
        }
      }
    }
  }
  const uncategorized = withCategory.filter((u) => {
    const cid = typeof u.category_id === 'string' ? u.category_id.trim() : '';
    return !cid || !catIds.has(cid);
  });
  for (const u of uncategorized) {
    if (!assigned.has(u.id)) reorderedChunks.push(u);
  }

  const note =
    typeof parsed.categorization_note_it === 'string' && parsed.categorization_note_it.trim()
      ? parsed.categorization_note_it.trim().slice(0, 500)
      : undefined;
  return { categories, use_cases: reorderedChunks, categorization_note_it: note };
}

/**
 * @param {object} params
 */
async function categorizeUseCases({
  useCases,
  logicalSteps,
  outputLanguage,
  provider = 'groq',
  model,
  purpose,
  taskId = null,
  taskLabel = null,
  aiProviderService,
}) {
  if (!Array.isArray(useCases) || useCases.length === 0) {
    return { categories: [], use_cases: [], categorization_note_it: 'Nessuno use case da categorizzare.' };
  }
  if (useCases.length === 1) {
    const lone = { ...useCases[0] };
    delete lone.category_id;
    return {
      categories: [],
      use_cases: [lone],
      categorization_note_it: 'Un solo use case: nessuna categoria.',
    };
  }
  const baseUser = buildCategorizeUserMessage(outputLanguage, useCases, logicalSteps || []);
  let lastErr;
  for (let attempt = 0; attempt < USE_CASE_CATEGORIZE_MAX_ATTEMPTS; attempt++) {
    const userContent =
      attempt === 0 ? baseUser : `${baseUser}${CATEGORIZE_JSON_RETRY_SUFFIX}`;
    const messages = [
      { role: 'system', content: CATEGORIZE_SYSTEM },
      { role: 'user', content: userContent },
    ];
    try {
      const response = await aiProviderService.callAI(provider, messages, {
        model: model || undefined,
        temperature: attempt === 0 ? 0.35 : 0.25,
        maxTokens: provider === 'openai' ? 4096 : 8192,
        timeout: CATEGORIZE_USE_CASES_TIMEOUT_MS,
        purpose: purpose || 'USE_CASE_CATEGORIZE',
        taskId,
        taskLabel,
      });
      const content = response?.choices?.[0]?.message?.content;
      const jsonStr = extractJsonString(content);
      let parsed;
      try {
        parsed = JSON.parse(jsonStr);
      } catch (e) {
        const err = new Error(`Categorize returned non-JSON: ${e.message}`);
        err.rawSnippet = jsonStr.slice(0, 500);
        throw err;
      }
      return applyCategorizationFromModel(useCases, parsed);
    } catch (e) {
      lastErr = e;
      if (attempt >= USE_CASE_CATEGORIZE_MAX_ATTEMPTS - 1) break;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

async function generateUseCaseBundle({
  userDesc,
  runtimeContext,
  outputLanguage,
  globalStyleContract,
  globalStyleId,
  provider = 'groq',
  model,
  purpose,
  taskId = null,
  taskLabel = null,
  aiProviderService,
}) {
  if (!userDesc || typeof userDesc !== 'string' || userDesc.trim().length < 8) {
    throw new Error('userDesc must be a non-empty string (at least 8 characters)');
  }
  const scenarioBand = pickBundleScenarioTargetBand(provider);
  const maxTokens = resolveUseCaseBundleMaxTokens(provider);
  const compactRetryBand = {
    lo: Math.max(4, scenarioBand.lo - 2),
    hi: Math.min(8, scenarioBand.hi),
  };
  const bundleBaseUser = `${buildGenerateUseCasesUserMessage(
    userDesc.trim(),
    outputLanguage,
    runtimeContext,
    scenarioBand
  )}${buildGlobalStyleBlock(globalStyleContract)}`;
  const parsed = await parseUseCaseModelJsonWithRetries({
    stage: 'bundle',
    maxAttempts: USE_CASE_JSON_PARSE_MAX_ATTEMPTS,
    chunkedPipeline: false,
    compactLo: compactRetryBand.lo,
    compactHi: compactRetryBand.hi,
    callModel: async (userSuffix) =>
      aiProviderService.callAI(
        provider,
        [
          { role: 'system', content: UC_SYSTEM },
          { role: 'user', content: `${bundleBaseUser}${userSuffix}` },
        ],
        {
          model: model || undefined,
          temperature: userSuffix.includes('OUTPUT_RETRY') ? 0.55 : 0.62,
          maxTokens,
          timeout: GENERATE_USE_CASE_BUNDLE_TIMEOUT_MS,
          purpose,
          taskId,
          taskLabel,
        }
      ),
  });
  const bundle = validateUseCaseBundle(parsed);
  logUseCaseDialogueDiagnostics('bundle', model, bundle.use_cases);
  let normalized = normalizeUseCaseBundle(bundle, globalStyleId);
  const { use_cases: reordered, ordering_note_it } = await reorderUseCasesNarratively({
    useCases: normalized.use_cases,
    logicalSteps: normalized.logical_steps,
    outputLanguage,
    provider,
    model,
    purpose: 'USE_CASE_BUNDLE_NARRATIVE_ORDER',
    taskId,
    taskLabel,
    aiProviderService,
  });
  return {
    logical_steps: normalized.logical_steps,
    use_cases: reordered,
    use_case_ordering_note: ordering_note_it,
  };
}

function buildRegenerateUseCaseUserMessage(outputLanguage, useCase, allCases, logicalSteps, globalStyleContract) {
  const lang =
    typeof outputLanguage === 'string' && outputLanguage.trim()
      ? `OUTPUT_LANGUAGE (BCP 47): ${outputLanguage.trim()}\n`
      : '';
  const styleBlock = buildGlobalStyleBlock(globalStyleContract);
  return `${lang}You refine ONE use case. Current use case (JSON):\n${JSON.stringify(useCase)}\n\nAll use cases (context, do not remove others):\n${JSON.stringify(allCases).slice(0, 8000)}\n\nLogical steps:\n${JSON.stringify(logicalSteps).slice(0, 4000)}\n\nReuse tone from existing use cases.${styleBlock}\n\nThe designer may have edited "scenario.llm" / "payoff" — if so, you MUST:\n- Update "label" to a short UI title (max ~64 chars) that matches the CURRENT scenario (do not keep an obsolete label).\n- Keep "scenario.llm" as the canonical scenario text (telegraphic); set "scenario.descrittivo" equal to "scenario.llm".\n- Set "payoff" equal to "scenario.llm".\n- Rewrite "dialogue"[0].content so it fits the scenario and GLOBAL_STYLE_CONTRACT.\n- Bracket only runtime-varying fragments; **Italian:** keep \`al\`, \`alle\`, \`alla\`, … outside brackets (\`alle [8]\` not \`[alle 8]\`).\n- "dialogue" content must be non-empty after refinement.\n\nReturn JSON with a single key "use_case" containing the full updated object. Requirements:\n- "scenario": { "llm", "descrittivo" (= llm) } — respect user edits on scenario.llm.\n- "payoff": equal to scenario.llm.\n- "label": short tree title aligned with scenario.llm.\n- "dialogue": exactly ONE assistant turn { turn_id, role "assistant", content } — virtual agent output example only; non-empty content.\n- Do NOT include "editable". Preserve "id" and "parent_id". Valid JSON only.`;
}

/**
 * @param {object} params
 * @param {object} params.useCase
 * @param {object[]} params.allCases
 * @param {object[]} params.logicalSteps
 */
async function regenerateUseCase({
  useCase,
  allCases,
  logicalSteps,
  outputLanguage,
  globalStyleContract,
  globalStyleId,
  provider = 'groq',
  model,
  purpose,
  taskId = null,
  taskLabel = null,
  aiProviderService,
}) {
  if (!useCase || typeof useCase !== 'object') {
    throw new Error('useCase is required');
  }
  const messages = [
    { role: 'system', content: UC_SYSTEM },
    {
      role: 'user',
      content: buildRegenerateUseCaseUserMessage(
        outputLanguage,
        useCase,
        allCases,
        logicalSteps || [],
        globalStyleContract
      ),
    },
  ];
  const maxTokens = provider === 'openai' ? 4096 : 8192;
  const response = await aiProviderService.callAI(provider, messages, {
    model: model || undefined,
    temperature: 0.35,
    maxTokens,
    timeout: REGENERATE_USE_CASE_TIMEOUT_MS,
    purpose,
    taskId,
    taskLabel,
  });
  const content = response?.choices?.[0]?.message?.content;
  const jsonStr = extractJsonString(content);
  const parsed = JSON.parse(jsonStr);
  if (!parsed || typeof parsed !== 'object' || !parsed.use_case) {
    throw new Error('Invalid JSON: expected { use_case }');
  }
  return normalizeUseCase(parsed.use_case, globalStyleId);
}

/** System dedicato: solo label + payoff (no dialogue). */
const GENERALIZE_USE_CASE_META_SYSTEM = `You help OMNIA designers generalize use case metadata for reuse across similar domains.
Respond with a single valid JSON object only (no markdown fences, no commentary).
The JSON must contain exactly two string keys: "label" and "payoff".
When OUTPUT_LANGUAGE is set in the user message, write both strings in that language.
Do not invent new clinical facts; keep the same intent, constraints, and decision points as the input.
Remove or replace overly tenant-specific proper names with role-based or generic wording when it improves reuse.`;

function buildGeneralizeUseCaseMetaUserMessage(outputLanguage, label, payoff, globalStyleContract) {
  const lang =
    typeof outputLanguage === 'string' && outputLanguage.trim()
      ? `OUTPUT_LANGUAGE (BCP 47): ${outputLanguage.trim()}\n`
      : '';
  const styleBlock = buildGlobalStyleBlock(globalStyleContract);
  const safeLabel = typeof label === 'string' ? label : '';
  const safePayoff = typeof payoff === 'string' ? payoff : '';
  return `${lang}Generalize this use case metadata.

Current tree TITLE ("label"):
${JSON.stringify(safeLabel)}

Current SCENARIO narrative ("payoff"):
${JSON.stringify(safePayoff)}

${styleBlock}

1) "label": short UI title (max ~120 characters), precise but domain-generalized where obvious.
2) "payoff": clear reusable scenario narrative — same intent and constraints, template-friendly language, no new invented facts.

Return JSON: { "label": "<string>", "payoff": "<string>" } only. Valid JSON only.`;
}

/**
 * LLM: generalizza titolo e scenario (payoff) senza toccare dialogue o altri campi.
 * @param {object} params
 * @param {string} params.label
 * @param {string} params.payoff
 * @param {string} [params.outputLanguage]
 * @param {string} [params.globalStyleContract]
 * @param {string} [params.provider]
 * @param {string} [params.model]
 * @param {import('./AIProviderService')} params.aiProviderService
 */
async function generalizeUseCaseMeta({
  label,
  payoff,
  outputLanguage,
  globalStyleContract,
  provider = 'groq',
  model,
  purpose,
  taskId = null,
  taskLabel = null,
  aiProviderService,
}) {
  const messages = [
    { role: 'system', content: GENERALIZE_USE_CASE_META_SYSTEM },
    {
      role: 'user',
      content: buildGeneralizeUseCaseMetaUserMessage(outputLanguage, label, payoff, globalStyleContract),
    },
  ];
  const maxTokens = provider === 'openai' ? 2048 : 4096;
  const response = await aiProviderService.callAI(provider, messages, {
    model: model || undefined,
    temperature: 0.35,
    maxTokens,
    timeout: REGENERATE_USE_CASE_TIMEOUT_MS,
    purpose,
    taskId,
    taskLabel,
  });
  const content = response?.choices?.[0]?.message?.content;
  const jsonStr = extractJsonString(content);
  const parsed = JSON.parse(jsonStr);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid JSON: expected object with label and payoff');
  }
  const outLabel = typeof parsed.label === 'string' ? parsed.label.trim() : '';
  const outPayoff = typeof parsed.payoff === 'string' ? parsed.payoff.trim() : '';
  if (!outLabel || !outPayoff) {
    throw new Error('Invalid response: label and payoff must be non-empty strings');
  }
  if (outLabel.length > 500 || outPayoff.length > 32000) {
    throw new Error('Invalid response: label or payoff exceeds maximum length');
  }
  return { label: outLabel, payoff: outPayoff };
}

const POLISH_USE_CASE_SCENARIO_TIMEOUT_MS = 90000;

const POLISH_USE_CASE_SCENARIO_SYSTEM = `You polish OMNIA use-case scenario text for designers.
Respond with a single valid JSON object only (no markdown fences, no commentary): { "scenario_llm": string }.

Rules:
- Improve clarity, grammar, and telegraphic form ONLY — **preserve the exact meaning**, intent, constraints, actors, and outcome.
- Do NOT add new facts, steps, policies, or assumptions. Do NOT remove material constraints.
- Keep 1–3 short lines, synthetic style suitable for LLM routing (not conversational agent script).
- When OUTPUT_LANGUAGE is set, write in that language.
- If the input is already clean, return a lightly tightened version (minimal edits).`;

/**
 * @param {string} outputLanguage
 * @param {string} scenarioText
 */
function buildPolishUseCaseScenarioUserMessage(outputLanguage, scenarioText) {
  const lang =
    typeof outputLanguage === 'string' && outputLanguage.trim()
      ? `OUTPUT_LANGUAGE (BCP 47): ${outputLanguage.trim()}\n`
      : '';
  const safe = typeof scenarioText === 'string' ? scenarioText : '';
  return `${lang}Polish this scenario text (designer draft):

"""
${safe.slice(0, 12000)}
"""

Return JSON: { "scenario_llm": "<polished text>" } only. Valid JSON only.`;
}

/**
 * LLM: rifinisce forma dello scenario senza cambiare significato.
 * @param {object} params
 * @param {string} params.scenarioText
 */
async function polishUseCaseScenario({
  scenarioText,
  outputLanguage,
  provider = 'groq',
  model,
  purpose,
  taskId = null,
  taskLabel = null,
  aiProviderService,
}) {
  const raw = typeof scenarioText === 'string' ? scenarioText.trim() : '';
  if (!raw) {
    throw new Error('scenarioText is required');
  }
  const messages = [
    { role: 'system', content: POLISH_USE_CASE_SCENARIO_SYSTEM },
    {
      role: 'user',
      content: buildPolishUseCaseScenarioUserMessage(outputLanguage, raw),
    },
  ];
  const response = await aiProviderService.callAI(provider, messages, {
    model: model || undefined,
    temperature: 0.2,
    maxTokens: provider === 'openai' ? 2048 : 4096,
    timeout: POLISH_USE_CASE_SCENARIO_TIMEOUT_MS,
    purpose,
    taskId,
    taskLabel,
  });
  const content = response?.choices?.[0]?.message?.content;
  const jsonStr = extractJsonString(content);
  const parsed = JSON.parse(jsonStr);
  const out =
    typeof parsed.scenario_llm === 'string'
      ? parsed.scenario_llm.trim()
      : typeof parsed.payoff === 'string'
        ? parsed.payoff.trim()
        : '';
  if (!out) {
    throw new Error('Invalid JSON: expected non-empty scenario_llm');
  }
  if (out.length > 2000) {
    throw new Error('Invalid response: scenario_llm exceeds maximum length');
  }
  return { scenario_llm: out };
}

const POLISH_DESIGN_DESCRIPTION_TIMEOUT_MS = 120000;

const POLISH_DESIGN_DESCRIPTION_SYSTEM = `You polish OMNIA AI Agent TASK DESCRIPTION text for designers.
Respond with a single valid JSON object only (no markdown fences, no commentary): { "design_description": string }.

Rules:
- Improve **formatting and readability** only: short titled sections with ## when helpful, bullet lists (- ) for enumerations, line breaks, light grammar fixes.
- **Preserve the exact meaning**, intent, constraints, policies, actors, tools, and outcomes. Do NOT add or remove material facts.
- Do NOT shorten aggressively; keep the same level of detail as the input.
- No markdown code fences; no commentary outside the JSON field.
- When OUTPUT_LANGUAGE is set, write in that language.
- If the input is already well formatted, return a lightly improved version (minimal edits).`;

/**
 * @param {string} outputLanguage
 * @param {string} descriptionText
 */
function buildPolishDesignDescriptionUserMessage(outputLanguage, descriptionText) {
  const lang =
    typeof outputLanguage === 'string' && outputLanguage.trim()
      ? `OUTPUT_LANGUAGE (BCP 47): ${outputLanguage.trim()}\n`
      : '';
  const safe = typeof descriptionText === 'string' ? descriptionText : '';
  return `${lang}Polish this task description (designer draft) for clearer structure without changing meaning:

"""
${safe.slice(0, 48000)}
"""

Return JSON: { "design_description": "<polished text>" } only. Valid JSON only.`;
}

/**
 * LLM: rifinisce forma della descrizione task (paragrafi/elenco) senza cambiare significato.
 * @param {object} params
 * @param {string} params.descriptionText
 */
async function polishDesignDescription({
  descriptionText,
  outputLanguage,
  provider = 'groq',
  model,
  purpose,
  taskId = null,
  taskLabel = null,
  aiProviderService,
}) {
  const raw = typeof descriptionText === 'string' ? descriptionText.trim() : '';
  if (!raw) {
    throw new Error('descriptionText is required');
  }
  const messages = [
    { role: 'system', content: POLISH_DESIGN_DESCRIPTION_SYSTEM },
    {
      role: 'user',
      content: buildPolishDesignDescriptionUserMessage(outputLanguage, raw),
    },
  ];
  const response = await aiProviderService.callAI(provider, messages, {
    model: model || undefined,
    temperature: 0.2,
    maxTokens: provider === 'openai' ? 8192 : 8192,
    timeout: POLISH_DESIGN_DESCRIPTION_TIMEOUT_MS,
    purpose,
    taskId,
    taskLabel,
  });
  const content = response?.choices?.[0]?.message?.content;
  const jsonStr = extractJsonString(content);
  const parsed = JSON.parse(jsonStr);
  const out =
    typeof parsed.design_description === 'string'
      ? parsed.design_description.trim()
      : typeof parsed.agentDesignDescription === 'string'
        ? parsed.agentDesignDescription.trim()
        : '';
  if (!out) {
    throw new Error('Invalid JSON: expected non-empty design_description');
  }
  if (out.length > 120000) {
    throw new Error('Invalid response: design_description exceeds maximum length');
  }
  return { design_description: out };
}

function buildCreateUseCaseUserMessage(outputLanguage, useCase, allCases, logicalSteps, globalStyleContract) {
  const lang =
    typeof outputLanguage === 'string' && outputLanguage.trim()
      ? `OUTPUT_LANGUAGE (BCP 47): ${outputLanguage.trim()}\n`
      : '';
  const styleBlock = buildGlobalStyleBlock(globalStyleContract);
  return `${lang}Create ONE new use case from this DESIGNER DRAFT (JSON):\n${JSON.stringify(useCase)}\n\nThe draft "label" and/or notes.behavior may be rough notes or a long paragraph — treat them as intent only.\n\nAll existing use cases (context):\n${JSON.stringify(allCases).slice(0, 10000)}\n\nLogical steps:\n${JSON.stringify(logicalSteps).slice(0, 4000)}\n\nYou MUST output:\n- "label": short UI title for the tree (max ~64 characters), polished and specific — NOT a copy-paste of the whole draft.\n- "scenario": { "llm": string, "descrittivo": string (= llm) } — concise telegraphic scenario (1–3 lines) from the draft intent; NOT a copy-paste of the whole draft.\n- "payoff": MUST equal scenario.llm.\n- "dialogue": exactly ONE assistant turn example matching tone from existing use cases.${styleBlock}\n- In assistant "content", bracket only runtime-varying fragments. **Italian:** leave \`al\`, \`alle\`, \`alla\`, \`allo\`, \`ai\`, \`nel\`, \`sul\`, \`del\`, … **outside** brackets — e.g. \`alle [8]\`, \`al [pomeriggio]\`, not \`[alle 8]\` / \`[al pomeriggio]\`.\n- "dialogue"[0].content MUST be non-empty.\n- "notes": { "behavior": string (one-line summary aligned with payoff), "tone": string } — may mirror GLOBAL_STYLE_CONTRACT briefly in "tone" if helpful.\n\n"dialogue" must be exactly ONE object: { turn_id, role "assistant", content }. Do NOT include "editable".\n\nPreserve exactly as in the draft (do not change): "id", "parent_id", "sort_order". You MAY replace "label", "payoff", "refinement_prompt", "notes", "bubble_notes", "dialogue", "style_id".\nReturn JSON with exactly: { "use_case": <full use case object> }.\nValid JSON only.`;
}

/**
 * @param {object} params
 * @param {object} params.useCase
 * @param {object[]} params.allCases
 * @param {object[]} params.logicalSteps
 * @param {string} [params.outputLanguage]
 * @param {string} [params.globalStyleContract]
 * @param {string} [params.provider]
 * @param {string} [params.model]
 * @param {import('./AIProviderService')} params.aiProviderService
 */
async function createUseCase({
  useCase,
  allCases,
  logicalSteps,
  outputLanguage,
  globalStyleContract,
  globalStyleId,
  provider = 'groq',
  model,
  purpose,
  taskId = null,
  taskLabel = null,
  aiProviderService,
}) {
  if (!useCase || typeof useCase !== 'object') {
    throw new Error('useCase is required');
  }
  const messages = [
    { role: 'system', content: UC_SYSTEM },
    {
      role: 'user',
      content: buildCreateUseCaseUserMessage(
        outputLanguage,
        useCase,
        allCases || [],
        logicalSteps || [],
        globalStyleContract
      ),
    },
  ];
  const maxTokens = provider === 'openai' ? 4096 : 8192;
  const response = await aiProviderService.callAI(provider, messages, {
    model: model || undefined,
    temperature: 0.35,
    maxTokens,
    timeout: REGENERATE_USE_CASE_TIMEOUT_MS,
    purpose,
    taskId,
    taskLabel,
  });
  const content = response?.choices?.[0]?.message?.content;
  const jsonStr = extractJsonString(content);
  const parsed = JSON.parse(jsonStr);
  if (!parsed || typeof parsed !== 'object' || !parsed.use_case) {
    throw new Error('Invalid JSON: expected { use_case }');
  }
  const normalized = normalizeUseCase(parsed.use_case, globalStyleId);
  return mergeCreateUseCaseWithDraft(normalized, useCase);
}

const SPLIT_ROOT_USE_CASE_DRAFT_SYSTEM = `You analyze designer text pasted into the root use case composer in OMNIA.
Respond with a single valid JSON object only (no markdown fences, no commentary): { "labels": ["...", ...] }.

Decide how many DISTINCT use cases exist from MEANING and intent — NOT from punctuation.
Semicolons, commas, and line breaks may be formatting only (one paragraph can be one use case).

Rules:
- Return between 1 and ${SPLIT_ROOT_USE_CASE_DRAFT_MAX_LABELS} entries in "labels".
- Each label is a short draft title or one-line scenario intent (max ~120 characters), in OUTPUT_LANGUAGE when set.
- Do NOT include labels that duplicate scenarios already in EXISTING_CATALOG (same meaning, not just similar wording).
- If the paste is a single coherent scenario, return exactly one label.
- If the paste lists multiple independent scenarios, return one label per scenario.`;

/**
 * @param {string} outputLanguage
 * @param {string} draftText
 * @param {object[]} allCases
 */
function buildSplitRootUseCaseDraftUserMessage(outputLanguage, draftText, allCases) {
  const lang =
    typeof outputLanguage === 'string' && outputLanguage.trim()
      ? `OUTPUT_LANGUAGE (BCP 47): ${outputLanguage.trim()}\n`
      : '';
  const catalog = summarizeExistingUseCasesForPrompt(allCases || []);
  return `${lang}DESIGNER_DRAFT (verbatim):
"""
${String(draftText || '').slice(0, 24000)}
"""

EXISTING_CATALOG (do not duplicate by meaning):
${JSON.stringify(catalog).slice(0, 14000)}

Return JSON only: { "labels": [ "draft label 1", ... ] }`;
}

/**
 * LLM: split root paste into 1..N draft labels (semantic, not punctuation).
 * @param {object} params
 * @param {string} params.draftText
 * @param {object[]} params.allCases
 * @param {string} [params.outputLanguage]
 * @param {string} [params.provider]
 * @param {string} [params.model]
 * @param {import('./AIProviderService')} params.aiProviderService
 */
async function splitRootUseCaseDraft({
  draftText,
  allCases,
  outputLanguage,
  provider = 'groq',
  model,
  purpose,
  taskId = null,
  taskLabel = null,
  aiProviderService,
}) {
  const draft = typeof draftText === 'string' ? draftText.trim() : '';
  if (!draft) {
    throw new Error('draftText is required');
  }
  const messages = [
    { role: 'system', content: SPLIT_ROOT_USE_CASE_DRAFT_SYSTEM },
    {
      role: 'user',
      content: buildSplitRootUseCaseDraftUserMessage(outputLanguage, draft, allCases || []),
    },
  ];
  const response = await aiProviderService.callAI(provider, messages, {
    model: model || undefined,
    temperature: 0.2,
    maxTokens: provider === 'openai' ? 2048 : 4096,
    timeout: SPLIT_ROOT_USE_CASE_DRAFT_TIMEOUT_MS,
    purpose,
    taskId,
    taskLabel,
  });
  const content = response?.choices?.[0]?.message?.content;
  const jsonStr = extractJsonString(content);
  const parsed = JSON.parse(jsonStr);
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.labels)) {
    throw new Error('Invalid JSON: expected { labels: string[] }');
  }
  const labels = parsed.labels
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter((x) => x.length > 0)
    .slice(0, SPLIT_ROOT_USE_CASE_DRAFT_MAX_LABELS);
  if (labels.length === 0) {
    throw new Error('Invalid JSON: labels array empty');
  }
  return { labels };
}

function buildRegenerateTurnUserMessage(outputLanguage, useCase, turnId) {
  const lang =
    typeof outputLanguage === 'string' && outputLanguage.trim()
      ? `OUTPUT_LANGUAGE (BCP 47): ${outputLanguage.trim()}\n`
      : '';
  return `${lang}Use case (JSON):\n${JSON.stringify(useCase).slice(0, 8000)}\n\nRegenerate ONLY the dialogue turn with turn_id === "${String(turnId)}". The message must fit the use case "payoff" and scenario context.\nBracket only variable fragments; in Italian keep \`al\`/\`alle\`/… outside brackets (\`alle [8]\` not \`[alle 8]\`).\nReturn JSON: { "turn": { "turn_id": same as input, "role": "assistant"|"user", "content": "..." } }. Content must be non-empty for assistant turns. Do NOT include "editable". Keep role the same as the current turn. Valid JSON only.`;
}

/**
 * @param {object} params
 * @param {object} params.useCase
 * @param {string} params.turnId
 */
async function regenerateTurn({
  useCase,
  turnId,
  outputLanguage,
  provider = 'groq',
  model,
  purpose,
  taskId = null,
  taskLabel = null,
  aiProviderService,
}) {
  if (!useCase || typeof useCase !== 'object') {
    throw new Error('useCase is required');
  }
  if (!turnId || typeof turnId !== 'string') {
    throw new Error('turnId is required');
  }
  const messages = [
    { role: 'system', content: UC_SYSTEM },
    {
      role: 'user',
      content: buildRegenerateTurnUserMessage(outputLanguage, useCase, turnId),
    },
  ];
  const maxTokens = provider === 'openai' ? 2048 : 4096;
  const response = await aiProviderService.callAI(provider, messages, {
    model: model || undefined,
    temperature: 0.35,
    maxTokens,
    timeout: REGENERATE_TURN_TIMEOUT_MS,
    purpose,
    taskId,
    taskLabel,
  });
  const content = response?.choices?.[0]?.message?.content;
  const jsonStr = extractJsonString(content);
  const parsed = JSON.parse(jsonStr);
  if (!parsed || typeof parsed !== 'object' || !parsed.turn) {
    throw new Error('Invalid JSON: expected { turn }');
  }
  const normalized = normalizeDialogueTurn(parsed.turn);
  if (!normalized) {
    throw new Error('Invalid turn payload after normalize');
  }
  if (normalized.role === 'assistant' && !(typeof normalized.content === 'string' && normalized.content.trim())) {
    throw new Error('Model returned empty assistant message content');
  }
  return normalized;
}

const PROPAGATE_EXAMPLE_PHRASE_STYLE_SYSTEM = `You align assistant example lines across use cases for OMNIA design-time.
STYLE_EXAMPLES are authoritative: copy their tone, register, sentence rhythm, politeness level, and bracket habits for runtime slots.
TARGETS need NEW assistant example text that fits EACH scenario (label + payoff) while sounding like STYLE_EXAMPLES wrote them.
Respond with one JSON object only: { "updates": [ { "use_case_id": string, "assistant_content": string } ] }.
Emit exactly one update per target id in TARGET_IDS_ORDER; never omit an id. Each assistant_content must be non-empty.
Bracket rules: variable semantic fragments only; in Italian keep articles/prepositions outside brackets (e.g. alle [ora_disponibile], not [alle 14]).`;

/**
 * @param {string} outputLanguage
 * @param {object[]} styleExamples — full use case objects (designer-edited lines)
 * @param {object[]} targets — use cases still at IA baseline; rewrite assistant line only
 * @param {object[]} logicalSteps
 * @param {string} [globalStyleContract]
 * @param {string[]} targetIdsOrder
 */
function buildPropagateExamplePhraseStyleUserMessage(
  outputLanguage,
  styleExamples,
  targets,
  logicalSteps,
  globalStyleContract,
  targetIdsOrder
) {
  const lang =
    typeof outputLanguage === 'string' && outputLanguage.trim()
      ? `OUTPUT_LANGUAGE (BCP 47): ${outputLanguage.trim()}\n`
      : '';
  const styleBlock = buildGlobalStyleBlock(globalStyleContract);
  const singleHint =
    Array.isArray(targetIdsOrder) && targetIdsOrder.length === 1
      ? '\n\nThere is exactly one target id in TARGET_IDS_ORDER — emit exactly one object in "updates" for that id.\n'
      : '';
  return `${lang}STYLE_EXAMPLES (authoritative — imitate these assistant lines):\n${JSON.stringify(styleExamples).slice(
    0,
    12000
  )}\n\nTARGETS (rewrite assistant example only; preserve scenario meaning):\n${JSON.stringify(targets).slice(
    0,
    12000
  )}\n\nLogical steps (context):\n${JSON.stringify(logicalSteps || []).slice(0, 4000)}\n${styleBlock}\n\nTARGET_IDS_ORDER (emit updates in this exact order): ${JSON.stringify(
    targetIdsOrder
  )}\n${singleHint}\nReturn JSON: { "updates": [ { "use_case_id": "<id>", "assistant_content": "..." }, ... ] }. Valid JSON only.`;
}

/** OpenAI completion ceiling for models capped at 4096 output tokens (e.g. gpt-4 class). */
const PROPAGATE_STYLE_OPENAI_MAX_TOKENS = 4096;
const PROPAGATE_STYLE_RETRY_PER_TARGET = 3;

/**
 * One LLM call: STYLE_EXAMPLES + contesto + subset di target (di solito uno).
 * @param {object} params
 * @param {object[]} params.styleExamples — già normalizzati
 * @param {string[]} params.targetUseCaseIds — ordine emissione atteso
 */
async function propagateExamplePhraseStyleOneShot({
  styleExamples,
  targetUseCaseIds,
  allUseCases,
  logicalSteps,
  outputLanguage,
  globalStyleContract,
  globalStyleId,
  provider,
  model,
  purpose,
  taskId = null,
  taskLabel = null,
  aiProviderService,
}) {
  const byId = new Map(allUseCases.map((u) => [u.id, u]));
  const targets = [];
  for (const id of targetUseCaseIds) {
    const u = byId.get(id);
    if (u) targets.push(normalizeUseCase(u, globalStyleId));
  }
  if (targets.length === 0 || targets.length !== targetUseCaseIds.length) {
    throw new Error('Missing or invalid target use case(s) for propagate style');
  }
  const messages = [
    { role: 'system', content: PROPAGATE_EXAMPLE_PHRASE_STYLE_SYSTEM },
    {
      role: 'user',
      content: buildPropagateExamplePhraseStyleUserMessage(
        outputLanguage,
        styleExamples,
        targets,
        logicalSteps || [],
        globalStyleContract,
        targetUseCaseIds
      ),
    },
  ];
  const maxTokens = provider === 'openai' ? PROPAGATE_STYLE_OPENAI_MAX_TOKENS : 16384;
  const response = await aiProviderService.callAI(provider, messages, {
    model: model || undefined,
    temperature: 0.45,
    maxTokens,
    timeout: PROPAGATE_EXAMPLE_PHRASE_STYLE_TIMEOUT_MS,
    purpose,
    taskId,
    taskLabel,
  });
  const content = response?.choices?.[0]?.message?.content;
  const jsonStr = extractJsonString(content);
  const parsed = JSON.parse(jsonStr);
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.updates)) {
    throw new Error('Invalid JSON: expected { updates: [] }');
  }
  const want = new Set(targetUseCaseIds.map(String));
  const out = [];
  const seen = new Set();
  for (const row of parsed.updates) {
    if (!row || typeof row !== 'object') continue;
    const use_case_id =
      typeof row.use_case_id === 'string'
        ? row.use_case_id.trim()
        : typeof row.useCaseId === 'string'
          ? row.useCaseId.trim()
          : '';
    const assistant_content =
      typeof row.assistant_content === 'string'
        ? row.assistant_content.trim()
        : typeof row.assistantContent === 'string'
          ? row.assistantContent.trim()
          : '';
    if (!use_case_id || !want.has(use_case_id) || seen.has(use_case_id)) continue;
    if (!assistant_content) continue;
    seen.add(use_case_id);
    out.push({ use_case_id, assistant_content });
  }
  if (out.length !== targetUseCaseIds.length) {
    throw new Error(
      `Expected ${targetUseCaseIds.length} updates, got ${out.length} (ids: ${targetUseCaseIds.join(', ')})`
    );
  }
  return { updates: out };
}

/**
 * Rigenera solo le righe assistente ancora alla baseline, imitando le frasi modificate dall’utente.
 * @param {object} params
 * @param {object[]} params.allUseCases
 * @param {object[]} params.logicalSteps
 * @param {string[]} params.styleExampleUseCaseIds
 * @param {string[]} params.targetUseCaseIds
 */
async function propagateExamplePhraseStyle({
  allUseCases,
  logicalSteps,
  styleExampleUseCaseIds,
  targetUseCaseIds,
  outputLanguage,
  globalStyleContract,
  globalStyleId,
  provider = 'groq',
  model,
  purpose,
  taskId = null,
  taskLabel = null,
  aiProviderService,
}) {
  if (!Array.isArray(allUseCases) || allUseCases.length === 0) {
    throw new Error('allUseCases is required');
  }
  if (!Array.isArray(styleExampleUseCaseIds) || styleExampleUseCaseIds.length === 0) {
    throw new Error('styleExampleUseCaseIds is required');
  }
  if (!Array.isArray(targetUseCaseIds) || targetUseCaseIds.length === 0) {
    throw new Error('targetUseCaseIds is required');
  }
  const byId = new Map(allUseCases.map((u) => [u.id, u]));
  const styleExamples = [];
  for (const id of styleExampleUseCaseIds) {
    const u = byId.get(id);
    if (u) styleExamples.push(normalizeUseCase(u, globalStyleId));
  }
  if (styleExamples.length === 0) {
    throw new Error('No valid style examples');
  }
  const order = targetUseCaseIds.map(String);
  const merged = [];
  for (const id of order) {
    let lastErr = null;
    let batch = null;
    for (let attempt = 1; attempt <= PROPAGATE_STYLE_RETRY_PER_TARGET; attempt += 1) {
      try {
        batch = await propagateExamplePhraseStyleOneShot({
          styleExamples,
          targetUseCaseIds: [id],
          allUseCases,
          logicalSteps,
          outputLanguage,
          globalStyleContract,
          globalStyleId,
          provider,
          model,
          purpose,
          taskId,
          taskLabel,
          aiProviderService,
        });
        break;
      } catch (e) {
        lastErr = e;
        if (attempt === PROPAGATE_STYLE_RETRY_PER_TARGET) {
          throw new Error(
            `propagateExamplePhraseStyle failed for use_case_id=${id} after ${PROPAGATE_STYLE_RETRY_PER_TARGET} attempts: ${lastErr?.message || lastErr}`
          );
        }
      }
    }
    if (!batch || !Array.isArray(batch.updates) || batch.updates.length !== 1) {
      throw new Error(`propagateExamplePhraseStyle: invalid batch for id=${id}`);
    }
    merged.push(batch.updates[0]);
  }
  return { updates: merged };
}

const ANNOTATE_ASSISTANT_FOR_JSON_TIMEOUT_MS = REGENERATE_TURN_TIMEOUT_MS;

/**
 * Same bracket split as `splitAgentMessageTemplate.ts` (design-time motor segments).
 * @param {string} content
 */
function splitAgentMessageBracketsJs(content) {
  const s = typeof content === 'string' ? content : '';
  if (!s) return [];
  const out = [];
  const re = /\[([^\]]+)\]/g;
  let last = 0;
  let m;
  while ((m = re.exec(s)) !== null) {
    const start = m.index;
    if (start > last) {
      out.push({ kind: 'text', text: s.slice(last, start) });
    }
    const inner = (m[1] ?? '').trim();
    out.push({ kind: 'slot', name: inner, raw: m[0] ?? '' });
    last = start + (m[0]?.length ?? 0);
  }
  if (last < s.length) {
    out.push({ kind: 'text', text: s.slice(last) });
  }
  return out;
}

function dedupeSlotBindingsJs(rows) {
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue;
    const id = String(r.slot_id ?? '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({
      slot_id: id,
      surface: String(r.surface ?? '').trim() || id,
    });
  }
  return out;
}

function bindingsFallbackFromSegmentsJs(segments) {
  const names = [...new Set(segments.filter((x) => x.kind === 'slot').map((x) => x.name))];
  return names.map((slot_id) => ({ slot_id, surface: slot_id }));
}

/**
 * New schema: { slot_id, values, pattern?, separator?, last_separator?, period? }.
 * Legacy: { period, times } → same values list with a derived slot_id.
 */
function normalizeMotorGroupsJs(groups) {
  if (!Array.isArray(groups) || groups.length === 0) return undefined;
  const out = [];
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    if (!g || typeof g !== 'object') continue;

    let slot_id = typeof g.slot_id === 'string' ? g.slot_id.trim() : '';
    let values = [];
    if (Array.isArray(g.values)) {
      values = g.values.map((t) => String(t ?? '').trim()).filter(Boolean);
    }

    const legacyTimes = Array.isArray(g.times)
      ? g.times.map((t) => String(t ?? '').trim()).filter(Boolean)
      : [];
    const period = typeof g.period === 'string' ? g.period.trim() : '';

    if (!values.length && legacyTimes.length) {
      values = legacyTimes;
      if (!slot_id) {
        slot_id = period ? `orari_${period}` : `gruppo_${i}`;
      }
    }

    if (!slot_id || !values.length) continue;

    const pattern = typeof g.pattern === 'string' && g.pattern.trim() ? g.pattern.trim() : '';
    const separator = typeof g.separator === 'string' ? g.separator : undefined;
    const last_separator = typeof g.last_separator === 'string' ? g.last_separator : undefined;

    const row = {
      slot_id,
      values,
      ...(pattern ? { pattern } : {}),
      ...(separator !== undefined ? { separator } : {}),
      ...(last_separator !== undefined ? { last_separator } : {}),
      ...(period ? { period } : {}),
    };
    out.push(row);
  }
  return out.length ? out : undefined;
}

/**
 * @param {string} useCaseId
 * @param {string} label
 * @param {string} template
 * @param {object} [modelMotor]
 * @param {object[]} [modelMotor.slots]
 * @param {object[]} [modelMotor.groups]
 * @param {object[]} [modelMotor.linear_semantic]
 */
function buildMotorPayloadFromAnnotatedContent(useCaseId, label, template, modelMotor) {
  const segments = splitAgentMessageBracketsJs(template);
  const m = modelMotor && typeof modelMotor === 'object' ? modelMotor : {};

  let slotBindings = [];
  if (Array.isArray(m.slots) && m.slots.length > 0) {
    const first = m.slots[0];
    if (typeof first === 'string') {
      slotBindings = [];
    } else {
      slotBindings = m.slots
        .map((s) => {
          if (!s || typeof s !== 'object') return null;
          const sid = typeof s.slot_id === 'string' ? s.slot_id.trim() : '';
          if (!sid) return null;
          const surface = typeof s.surface === 'string' ? s.surface.trim() : '';
          return { slot_id: sid, surface: surface || sid };
        })
        .filter(Boolean);
    }
  }

  const slots = dedupeSlotBindingsJs(
    slotBindings.length ? slotBindings : bindingsFallbackFromSegmentsJs(segments)
  );

  const motor = {
    use_case_id: useCaseId,
    label: label || '',
    template,
    segments,
    slots,
  };

  const groups = normalizeMotorGroupsJs(m.groups);
  if (groups) {
    motor.groups = groups;
  }

  if (Array.isArray(m.linear_semantic) && m.linear_semantic.length > 0) {
    motor.linear_semantic = m.linear_semantic
      .map((row) => {
        if (!row || typeof row !== 'object') return null;
        const text = typeof row.text === 'string' ? row.text : '';
        const slot = typeof row.slot === 'string' ? row.slot.trim() : '';
        return slot ? { text, slot } : null;
      })
      .filter(Boolean);
  }
  return motor;
}

/**
 * @param {string} outputLanguage
 * @param {object} useCase
 * @param {string} turnId
 * @param {string} [globalStyleContract]
 */
function buildAnnotateAssistantForJsonUserMessage(
  outputLanguage,
  useCase,
  turnId,
  globalStyleContract,
  assistantMessageTextOverride
) {
  const lang =
    typeof outputLanguage === 'string' && outputLanguage.trim()
      ? `OUTPUT_LANGUAGE (BCP 47): ${outputLanguage.trim()}\n`
      : '';
  const styleBlock = buildGlobalStyleBlock(globalStyleContract);
  const dialogue = Array.isArray(useCase?.dialogue) ? useCase.dialogue : [];
  let useCaseForPrompt = useCase;
  let currentText = '';
  if (typeof assistantMessageTextOverride === 'string') {
    currentText = assistantMessageTextOverride;
    useCaseForPrompt = {
      ...useCase,
      dialogue: dialogue.map((t) =>
        t && t.turn_id === turnId ? { ...t, content: assistantMessageTextOverride } : t
      ),
    };
  } else {
    const target = dialogue.find((t) => t && t.turn_id === turnId);
    currentText = typeof target?.content === 'string' ? target.content : '';
  }
  return `${lang}You annotate assistant messages for runtime JSON templating. The designer's message is authoritative.

Full use case JSON (context for intent only — do not copy its wording over the current message):
${JSON.stringify(useCaseForPrompt).slice(0, 14000)}

TARGET assistant turn_id: "${String(turnId)}"
Current assistant message text (AUTHORITATIVE — annotate THIS text only):
"""
${currentText.slice(0, 8000)}
"""

Task:
- Preserve the **exact** wording, punctuation, spacing, and line breaks of "Current assistant message text" above.
- Do **not** paraphrase, rephrase, normalize, add sentences, remove sentences, or swap synonyms.
- Only insert \`[slot_id]\` markers around runtime-varying fragments; every other character must stay identical unless you fix an **obvious** spelling/typo in-place (optional; if unsure, leave as-is).
- Build a coherent \`motor\` JSON that matches the bracketed \`slot_id\`s in your \`content\`.
${styleBlock}

**Bracket notation (semantic slot ids):** Inside \`[ ]\` use **stable snake_case slot_id** labels (e.g. \`data_richiesta\`, \`ora_disponibile\`), **not** the literal spoken value. Fixed script stays outside brackets; **Italian:** leave articles/prepositions outside (\`alle [ora_disponibile]\` not \`[alle 8]\`).

**Patterns:** Detect lists / repetitions / conjunctions (e.g. \`alle [id], alle [id] e alle [id]\`). Do **not** invent a separate slot for each repeated role — one \`slot_id\` per semantic role. Commas and \` e \` belong to the **linguistic pattern**, not to \`slots\`.

**motor.slots:** One object per distinct \`slot_id\`: \`{ "slot_id": string, "surface": string }\` where **surface** is the **original literal** from the current message text for that role (before semantic renaming), e.g. surface \`"sabato 21"\` for \`data_richiesta\`.

**motor.groups:** For repeated same-role items (e.g. multiple times), add one group:
\`{ "slot_id": "<same as bracket>", "pattern": "alle [ora]" (example), "values": ["8","10","17"], "separator": ", ", "last_separator": " e " }\`
Order \`values\` as in the sentence. Omit \`groups\` if nothing repeats.

Legacy compatibility: you may still bucket by day-period using \`period\` + \`times\`; prefer the **groups** schema above when the sentence lists hours.

Return a single JSON object with exactly these keys:
{
  "content": "<same assistant message as Current assistant message text, with [semantic_slot_id] brackets inserted — no other wording changes except optional obvious typo fixes>",
  "motor": {
    "slots": [ { "slot_id": "data_richiesta", "surface": "sabato 21" } ],
    "groups": [ { "slot_id": "ora_disponibile", "pattern": "alle [ora]", "values": ["8","10"], "separator": ", ", "last_separator": " e " } ],
    "linear_semantic": [ { "text": "per ", "slot": "data" } ]
  }
}
\`linear_semantic\` is optional. Valid JSON only. No markdown fences.`;
}

/**
 * LLM: wrap runtime-varying fragments in [tokens] for motor JSON / slots preview.
 * @param {object} params
 * @param {object} params.useCase
 * @param {string} params.turnId
 */
async function annotateAssistantMessageForJson({
  useCase,
  turnId,
  outputLanguage,
  globalStyleContract,
  provider = 'groq',
  model,
  purpose,
  taskId = null,
  taskLabel = null,
  aiProviderService,
  assistantMessageTextOverride,
}) {
  if (!useCase || typeof useCase !== 'object') {
    throw new Error('useCase is required');
  }
  if (!turnId || typeof turnId !== 'string') {
    throw new Error('turnId is required');
  }
  const messages = [
    { role: 'system', content: ANNOTATE_ASSISTANT_FOR_JSON_SYSTEM },
    {
      role: 'user',
      content: buildAnnotateAssistantForJsonUserMessage(
        outputLanguage,
        useCase,
        turnId,
        globalStyleContract,
        typeof assistantMessageTextOverride === 'string' ? assistantMessageTextOverride : undefined
      ),
    },
  ];
  const maxTokens = provider === 'openai' ? 3072 : 4096;
  const response = await aiProviderService.callAI(provider, messages, {
    model: model || undefined,
    temperature: 0.15,
    maxTokens,
    timeout: ANNOTATE_ASSISTANT_FOR_JSON_TIMEOUT_MS,
    purpose,
    taskId,
    taskLabel,
  });
  const rawContent = response?.choices?.[0]?.message?.content;
  const jsonStr = extractJsonString(rawContent);
  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    const err = new Error(`Model returned non-JSON: ${e.message}`);
    err.rawSnippet = jsonStr.slice(0, 400);
    throw err;
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid JSON object');
  }
  const annotated = typeof parsed.content === 'string' ? parsed.content.trim() : '';
  if (!annotated) {
    throw new Error('Model returned empty content');
  }
  const label = typeof useCase.label === 'string' ? useCase.label : '';
  const useCaseId = typeof useCase.id === 'string' ? useCase.id : '';
  const modelMotor = parsed.motor && typeof parsed.motor === 'object' ? parsed.motor : {};
  const motor = buildMotorPayloadFromAnnotatedContent(useCaseId, label, annotated, modelMotor);
  return { content: annotated, motor };
}

/**
 * Compact catalog for LLM (ids + labels + example line).
 * @param {string} agentUseCasesJson
 */
function compactUseCasesForAnalyze(agentUseCasesJson) {
  let arr = [];
  try {
    const v =
      typeof agentUseCasesJson === 'string' && agentUseCasesJson.trim()
        ? JSON.parse(agentUseCasesJson)
        : [];
    arr = Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
  return arr.map((uc) => {
    const dialogue = Array.isArray(uc?.dialogue) ? uc.dialogue : [];
    const assistant = dialogue.find((t) => t && t.role === 'assistant');
    const assistant_example =
      assistant && typeof assistant.content === 'string' ? assistant.content : '';
    return {
      id: typeof uc?.id === 'string' ? uc.id : '',
      label: typeof uc?.label === 'string' ? uc.label : '',
      payoff: typeof uc?.payoff === 'string' ? uc.payoff : '',
      assistant_example,
    };
  });
}

/**
 * Debugger: compare user + assistant lines against persisted use cases; optional new scenario suggestion.
 * @param {object} params
 */
async function analyzeDebuggerTurnUseCase({
  userTurnText,
  assistantTurnText,
  agentUseCasesJson,
  globalStyleContract,
  outputLanguage,
  provider = 'groq',
  model,
  purpose,
  taskId = null,
  taskLabel = null,
  aiProviderService,
}) {
  if (!aiProviderService) {
    throw new Error('aiProviderService is required');
  }
  const catalog = compactUseCasesForAnalyze(
    typeof agentUseCasesJson === 'string' ? agentUseCasesJson : ''
  );
  const catalogStr = JSON.stringify(catalog).slice(0, 32000);
  const ut = typeof userTurnText === 'string' ? userTurnText : '';
  const at = typeof assistantTurnText === 'string' ? assistantTurnText : '';
  const gsc =
    typeof globalStyleContract === 'string' && globalStyleContract.trim()
      ? globalStyleContract.trim().slice(0, 4000)
      : '';
  const lang =
    typeof outputLanguage === 'string' && outputLanguage.trim() ? outputLanguage.trim() : 'it-IT';

  const userMsg = `OUTPUT_LANGUAGE for summary_it: ${lang}

Existing use cases (JSON array; fields: id, label, payoff, assistant_example):
${catalogStr}

User turn:
"""${ut.slice(0, 8000)}"""

Assistant reply observed in debugger:
"""${at.slice(0, 8000)}"""

Global style contract hint (may be empty):
"""${gsc}"""

Return ONE JSON object only (no markdown, no code fences):
{
  "outcome": "use_case_recognized" | "exists_but_not_recognized" | "no_matching_use_case" | "uncertain",
  "summary_it": "short Italian explanation for the designer",
  "recognized_use_case_id": "<id from catalog or null>",
  "recognized_use_case_label": "<human-readable label from catalog for that id, or empty>",
  "correct_assistant_reply_it": "Italian line the assistant SHOULD have said if the matching catalog use case were applied correctly — natural, concise; use \"\" only if truly impossible",
  "suggested_use_case": null | {
    "label": "string",
    "payoff": "string",
    "assistant_example_line": "string"
  }
}

Rules (debugger does NOT receive runtime agent use-case id yet — classify using catalog + turns only):
- use_case_recognized: the assistant reply is consistent with ONE catalog use case (same scenario); set recognized_use_case_id and recognized_use_case_label from that row.
- exists_but_not_recognized: the user intent matches or clearly relates to a catalog use case, but the assistant reply does NOT adequately match that scenario (tone/content wrong); set recognized_* to that catalog row. Do NOT emit runtime_divergence (runtime signal not available).
- no_matching_use_case: no catalog row adequately covers this user+assistant situation; fill suggested_use_case (label, payoff, assistant_example_line) aligned with global style / existing patterns.
- uncertain: ambiguous; minimal suggested_use_case if helpful.
- correct_assistant_reply_it: write in Italian (OUTPUT_LANGUAGE). Whenever you identify a best-matching scenario (recognized row or suggested_use_case), give one ideal assistant utterance for that scenario; may echo assistant_example from catalog when appropriate.

Legacy synonym (accept internally): matched_wrong_response → treat as exists_but_not_recognized.`;

  const messages = [
    { role: 'system', content: 'You output valid JSON only. No markdown fences or commentary.' },
    { role: 'user', content: userMsg },
  ];
  const maxTokens = provider === 'openai' ? 2048 : 2500;
  const response = await aiProviderService.callAI(provider, messages, {
    model: model || undefined,
    temperature: 0.2,
    maxTokens,
    timeout: ANALYZE_DEBUG_TURN_TIMEOUT_MS,
    purpose: purpose || 'DEBUGGER_ANALYZE_TURN',
    taskId,
    taskLabel,
  });
  const rawContent = response?.choices?.[0]?.message?.content;
  const jsonStr = extractJsonString(rawContent);
  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    const err = new Error(`Model returned non-JSON: ${e.message}`);
    err.rawSnippet = jsonStr.slice(0, 400);
    throw err;
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid JSON object');
  }
  const rawOc = typeof parsed.outcome === 'string' ? parsed.outcome.trim() : '';
  const legacyMap = { matched_wrong_response: 'exists_but_not_recognized' };
  const normalizedOc = legacyMap[rawOc] || rawOc;
  const outcomes = new Set([
    'use_case_recognized',
    'exists_but_not_recognized',
    'no_matching_use_case',
    'uncertain',
  ]);
  const outcome = outcomes.has(normalizedOc) ? normalizedOc : 'uncertain';
  const summary_it = typeof parsed.summary_it === 'string' ? parsed.summary_it.trim() : '';
  let recognized_use_case_id =
    typeof parsed.recognized_use_case_id === 'string' && parsed.recognized_use_case_id.trim()
      ? parsed.recognized_use_case_id.trim()
      : null;
  if (recognized_use_case_id === '') recognized_use_case_id = null;

  let recognized_use_case_label =
    typeof parsed.recognized_use_case_label === 'string' && parsed.recognized_use_case_label.trim()
      ? parsed.recognized_use_case_label.trim()
      : null;
  if (recognized_use_case_label === '') recognized_use_case_label = null;

  let correct_assistant_reply_it =
    typeof parsed.correct_assistant_reply_it === 'string' && parsed.correct_assistant_reply_it.trim()
      ? parsed.correct_assistant_reply_it.trim()
      : null;
  if (correct_assistant_reply_it === '') correct_assistant_reply_it = null;

  let suggested_use_case = null;
  const s = parsed.suggested_use_case;
  if (s && typeof s === 'object') {
    const label = typeof s.label === 'string' ? s.label.trim() : '';
    const payoff = typeof s.payoff === 'string' ? s.payoff.trim() : '';
    const assistant_example_line =
      typeof s.assistant_example_line === 'string'
        ? s.assistant_example_line.trim()
        : typeof s.assistant_example === 'string'
          ? s.assistant_example.trim()
          : '';
    if (label || payoff || assistant_example_line) {
      suggested_use_case = { label, payoff, assistant_example_line };
    }
  }

  return {
    outcome,
    summary_it,
    recognized_use_case_id,
    recognized_use_case_label,
    correct_assistant_reply_it,
    suggested_use_case,
    runtime_agent_use_case_id: null,
    runtime_agent_use_case_label: null,
  };
}

module.exports = {
  generateUseCaseBundle,
  generateUseCaseBundleInitialChunk,
  generateUseCaseBundleExtend,
  reorderUseCasesNarratively,
  categorizeUseCases,
  USE_CASE_BUNDLE_CHUNK_SIZE,
  USE_CASE_BUNDLE_MAX_TOTAL,
  createUseCase,
  splitRootUseCaseDraft,
  regenerateUseCase,
  generalizeUseCaseMeta,
  polishUseCaseScenario,
  polishDesignDescription,
  regenerateTurn,
  propagateExamplePhraseStyle,
  annotateAssistantMessageForJson,
  validateUseCaseBundle,
  analyzeDebuggerTurnUseCase,
  summarizeExistingUseCasesForPrompt,
  applyNarrativeOrder,
};
