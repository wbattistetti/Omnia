// Propagate stylistic corrections (assistant message only) using a directional schema:
// the LLM sees ORIGINAL→MODIFIED pairs from the user's substantial edits, infers the
// editorial intent (synthetic vs verbose, formal vs casual, …) and applies the same
// transformation to TARGETS that are still on the IA baseline.
//
// Compared to legacy `propagateExamplePhraseStyle` (single-side, modified-only):
//  - examples are pairs `{ original, modified }` (direction explicit, not implicit);
//  - targets are sent with their `original` text so the model rewrites it (not generates
//    from scratch) and emits NEW text marked as such for client-side badging.

const { extractJsonString } = require('./AIAgentDesignService');

/** Same provider ceilings used by the legacy phrase-style propagator. */
const PROPAGATE_CORRECTION_OPENAI_MAX_TOKENS = 4096;
const PROPAGATE_CORRECTION_TIMEOUT_MS = 120000;
const PROPAGATE_CORRECTION_RETRY_PER_TARGET = 3;
/** Defensive caps to keep prompts well under provider context windows. */
const MAX_FIELD_CHARS = 2000;
const MAX_EXAMPLES_BLOCK_CHARS = 12000;
const MAX_TARGETS_BLOCK_CHARS = 12000;

const PROPAGATE_CORRECTION_SYSTEM = `You are an OMNIA design-time editor that learns the user's stylistic preferences from corrections.
DIRECTIONAL_EXAMPLES are pairs ORIGINAL → MODIFIED authored by the user: study the DIRECTION of the change (concise vs verbose, formal vs casual, more empathetic, less hedging, different bracket habits, …) — do NOT just imitate the surface tone.
TARGETS are assistant example lines still at the IA baseline that the user has NOT touched. Rewrite each TARGET applying the SAME kind of transformation observed in DIRECTIONAL_EXAMPLES, while preserving the scenario meaning of that target (do not change what the agent is doing, only how it says it).
Bracket rules: variable semantic fragments only; in Italian keep articles/prepositions outside brackets (e.g. \`alle [ora_disponibile]\`, not \`[alle 14]\`).
Respond with one JSON object only: { "style_synthesis": string (Italian, 2–6 sentences: describe the editorial pattern you inferred from DIRECTIONAL_EXAMPLES — tone, length, formality, empathy, bracket habits — without repeating the examples verbatim), "updates": [ { "use_case_id": string, "new_assistant_content": string, "is_new": true } ] }.
Emit exactly one update per id in TARGET_IDS_ORDER, in that order. Each "new_assistant_content" must be non-empty. The "style_synthesis" field must always be present (use an empty string only if impossible).`;

/**
 * Builds the user-message body. Pure function (no I/O) so it is unit-testable.
 * Inputs are already normalized/clamped by the caller (see `propagateCorrectionStyle`).
 * @param {string} outputLanguage
 * @param {Array<{useCaseId: string, useCaseLabel: string, original: string, modified: string}>} directionalExamples
 * @param {Array<{useCaseId: string, useCaseLabel: string, original: string}>} directionalTargets
 * @param {string} globalStyleContract
 * @param {string[]} targetIdsOrder
 */
function buildPropagateCorrectionUserMessage(
  outputLanguage,
  directionalExamples,
  directionalTargets,
  globalStyleContract,
  targetIdsOrder
) {
  const langLine =
    typeof outputLanguage === 'string' && outputLanguage.trim()
      ? `OUTPUT_LANGUAGE (BCP 47): ${outputLanguage.trim()}\n`
      : '';
  const styleBlock =
    typeof globalStyleContract === 'string' && globalStyleContract.trim()
      ? `\nGLOBAL_STYLE_CONTRACT:\n${globalStyleContract.trim()}\nApply this style contract consistently to every rewritten line.`
      : '';
  const singleHint =
    Array.isArray(targetIdsOrder) && targetIdsOrder.length === 1
      ? '\n\nThere is exactly one target id in TARGET_IDS_ORDER — emit exactly one object in "updates" for that id.'
      : '';
  const examplesJson = JSON.stringify(directionalExamples).slice(0, MAX_EXAMPLES_BLOCK_CHARS);
  const targetsJson = JSON.stringify(directionalTargets).slice(0, MAX_TARGETS_BLOCK_CHARS);
  return `${langLine}DIRECTIONAL_EXAMPLES (authoritative — observe the ORIGINAL→MODIFIED transformation):
${examplesJson}

TARGETS (rewrite "original" applying the SAME transformation; preserve scenario meaning):
${targetsJson}
${styleBlock}

TARGET_IDS_ORDER (emit updates in this exact order): ${JSON.stringify(targetIdsOrder)}${singleHint}

Return JSON only: { "updates": [ { "use_case_id": "<id>", "new_assistant_content": "...", "is_new": true } ] }`;
}

/**
 * Single LLM round-trip for one batch of targets.
 * @param {object} params
 */
async function propagateCorrectionStyleOneShot({
  directionalExamples,
  directionalTargetsForBatch,
  outputLanguage,
  globalStyleContract,
  provider,
  model,
  purpose,
  taskId,
  taskLabel,
  aiProviderService,
}) {
  const targetIdsOrder = directionalTargetsForBatch.map((t) => t.useCaseId);
  const messages = [
    { role: 'system', content: PROPAGATE_CORRECTION_SYSTEM },
    {
      role: 'user',
      content: buildPropagateCorrectionUserMessage(
        outputLanguage,
        directionalExamples,
        directionalTargetsForBatch,
        globalStyleContract,
        targetIdsOrder
      ),
    },
  ];
  const maxTokens = provider === 'openai' ? PROPAGATE_CORRECTION_OPENAI_MAX_TOKENS : 16384;
  const response = await aiProviderService.callAI(provider, messages, {
    model: model || undefined,
    temperature: 0.45,
    maxTokens,
    timeout: PROPAGATE_CORRECTION_TIMEOUT_MS,
    purpose,
    taskId,
    taskLabel,
  });
  const content = response?.choices?.[0]?.message?.content;
  const jsonStr = extractJsonString(content);
  const parsed = JSON.parse(jsonStr);
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.updates)) {
    throw new Error('Invalid JSON: expected { style_synthesis?, updates: [] }');
  }
  const styleSynthesisRaw =
    typeof parsed.style_synthesis === 'string'
      ? parsed.style_synthesis.trim()
      : typeof parsed.styleSynthesis === 'string'
        ? parsed.styleSynthesis.trim()
        : '';
  const want = new Set(targetIdsOrder.map(String));
  const seen = new Set();
  const out = [];
  for (const row of parsed.updates) {
    if (!row || typeof row !== 'object') continue;
    const useCaseId =
      typeof row.use_case_id === 'string'
        ? row.use_case_id.trim()
        : typeof row.useCaseId === 'string'
          ? row.useCaseId.trim()
          : '';
    const newAssistantContent =
      typeof row.new_assistant_content === 'string'
        ? row.new_assistant_content.trim()
        : typeof row.newAssistantContent === 'string'
          ? row.newAssistantContent.trim()
          : '';
    if (!useCaseId || !want.has(useCaseId) || seen.has(useCaseId)) continue;
    if (!newAssistantContent) continue;
    seen.add(useCaseId);
    out.push({ useCaseId, newAssistantContent, isNew: true });
  }
  if (out.length !== targetIdsOrder.length) {
    throw new Error(
      `Expected ${targetIdsOrder.length} updates, got ${out.length} (ids: ${targetIdsOrder.join(', ')})`
    );
  }
  return { updates: out, styleSynthesis: styleSynthesisRaw };
}

function clampString(value, max) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

/**
 * Validate + normalize input arrays. Fails loudly on missing/empty fields so
 * malformed callers don't silently produce empty prompts.
 * @param {unknown} rawExamples
 * @param {unknown} rawTargets
 */
function normalizeDirectionalInputs(rawExamples, rawTargets) {
  if (!Array.isArray(rawExamples) || rawExamples.length === 0) {
    throw new Error('directionalExamples is required and must be a non-empty array');
  }
  if (!Array.isArray(rawTargets) || rawTargets.length === 0) {
    throw new Error('directionalTargets is required and must be a non-empty array');
  }
  const examples = [];
  for (const e of rawExamples) {
    if (!e || typeof e !== 'object') {
      throw new Error('directionalExamples entry must be an object');
    }
    const useCaseId =
      typeof e.useCaseId === 'string'
        ? e.useCaseId.trim()
        : typeof e.use_case_id === 'string'
          ? e.use_case_id.trim()
          : '';
    if (!useCaseId) throw new Error('directionalExamples entry missing useCaseId');
    const useCaseLabel =
      typeof e.useCaseLabel === 'string'
        ? e.useCaseLabel.trim()
        : typeof e.use_case_label === 'string'
          ? e.use_case_label.trim()
          : '';
    const original = clampString(e.original, MAX_FIELD_CHARS);
    const modified = clampString(e.modified, MAX_FIELD_CHARS);
    if (!original || !modified) {
      throw new Error(
        `directionalExamples[${useCaseId}] requires non-empty original AND modified text`
      );
    }
    examples.push({ useCaseId, useCaseLabel, original, modified });
  }
  const seenTargets = new Set();
  const targets = [];
  for (const t of rawTargets) {
    if (!t || typeof t !== 'object') {
      throw new Error('directionalTargets entry must be an object');
    }
    const useCaseId =
      typeof t.useCaseId === 'string'
        ? t.useCaseId.trim()
        : typeof t.use_case_id === 'string'
          ? t.use_case_id.trim()
          : '';
    if (!useCaseId) throw new Error('directionalTargets entry missing useCaseId');
    if (seenTargets.has(useCaseId)) {
      throw new Error(`directionalTargets duplicate useCaseId: ${useCaseId}`);
    }
    const useCaseLabel =
      typeof t.useCaseLabel === 'string'
        ? t.useCaseLabel.trim()
        : typeof t.use_case_label === 'string'
          ? t.use_case_label.trim()
          : '';
    const original = clampString(t.original, MAX_FIELD_CHARS);
    if (!original) {
      throw new Error(`directionalTargets[${useCaseId}] requires a non-empty original`);
    }
    seenTargets.add(useCaseId);
    targets.push({ useCaseId, useCaseLabel, original });
  }
  return { examples, targets };
}

/**
 * Public entry-point. Iterates targets one by one (mirrors the legacy propagator's
 * batch-of-1 strategy: smaller prompts, predictable JSON shape, retry granularity).
 * @param {object} params
 */
async function propagateCorrectionStyle({
  directionalExamples,
  directionalTargets,
  outputLanguage,
  globalStyleContract,
  provider = 'groq',
  model,
  purpose,
  taskId = null,
  taskLabel = null,
  aiProviderService,
}) {
  const { examples, targets } = normalizeDirectionalInputs(
    directionalExamples,
    directionalTargets
  );
  const merged = [];
  let styleSynthesis = '';
  for (const target of targets) {
    let lastErr = null;
    let batch = null;
    for (let attempt = 1; attempt <= PROPAGATE_CORRECTION_RETRY_PER_TARGET; attempt += 1) {
      try {
        batch = await propagateCorrectionStyleOneShot({
          directionalExamples: examples,
          directionalTargetsForBatch: [target],
          outputLanguage,
          globalStyleContract,
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
        if (attempt === PROPAGATE_CORRECTION_RETRY_PER_TARGET) {
          throw new Error(
            `propagateCorrectionStyle failed for use_case_id=${target.useCaseId} after ${PROPAGATE_CORRECTION_RETRY_PER_TARGET} attempts: ${lastErr?.message || lastErr}`
          );
        }
      }
    }
    if (!batch || !Array.isArray(batch.updates) || batch.updates.length !== 1) {
      throw new Error(`propagateCorrectionStyle: invalid batch for id=${target.useCaseId}`);
    }
    merged.push(batch.updates[0]);
    const syn = typeof batch.styleSynthesis === 'string' ? batch.styleSynthesis.trim() : '';
    if (syn && !styleSynthesis) {
      styleSynthesis = syn;
    }
  }
  return { updates: merged, styleSynthesis };
}

/**
 * Anteprima UX: una sola chiamata LLM sui primi N target (max 3) per ottenere sintesi
 * stilistica + bozze corrette mostrate nel callout prima di «Correggi» su tutti i target.
 * @param {object} params
 */
async function propagateCorrectionStylePreview({
  directionalExamples,
  directionalTargets,
  outputLanguage,
  globalStyleContract,
  provider = 'groq',
  model,
  purpose,
  taskId = null,
  taskLabel = null,
  aiProviderService,
  maxPreviewTargets = 3,
}) {
  const { examples, targets } = normalizeDirectionalInputs(
    directionalExamples,
    directionalTargets
  );
  const cap = Math.max(1, Math.min(Number(maxPreviewTargets) || 3, 3, targets.length));
  const batchTargets = targets.slice(0, cap);
  const batch = await propagateCorrectionStyleOneShot({
    directionalExamples: examples,
    directionalTargetsForBatch: batchTargets,
    outputLanguage,
    globalStyleContract,
    provider,
    model,
    purpose,
    taskId,
    taskLabel,
    aiProviderService,
  });
  return {
    updates: batch.updates,
    styleSynthesis: typeof batch.styleSynthesis === 'string' ? batch.styleSynthesis.trim() : '',
  };
}

module.exports = {
  propagateCorrectionStyle,
  propagateCorrectionStylePreview,
  // Exported for unit tests.
  buildPropagateCorrectionUserMessage,
  normalizeDirectionalInputs,
  PROPAGATE_CORRECTION_SYSTEM,
};
