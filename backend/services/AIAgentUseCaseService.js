// Use case composer: LLM helpers for generate / regenerate (design-time only).

const { extractJsonString } = require('./AIAgentDesignService');

const UC_SYSTEM = `You are an expert conversational AI designer for OMNIA.
Respond with a single valid JSON object only (no markdown fences, no commentary).
When OUTPUT_LANGUAGE is set, write every human-readable string in that language.`;

/**
 * @param {string} outputLanguage
 * @param {string} userDesc
 * @param {string} [runtimeContext] composed markdown or summary
 */
function buildGenerateUseCasesUserMessage(userDesc, outputLanguage, runtimeContext) {
  const lang =
    typeof outputLanguage === 'string' && outputLanguage.trim()
      ? `\nOUTPUT_LANGUAGE (BCP 47): ${outputLanguage.trim()}\n`
      : '';
  const ctx =
    typeof runtimeContext === 'string' && runtimeContext.trim()
      ? `\nRUNTIME_PROMPT_OR_SECTIONS (context):\n"""\n${runtimeContext.slice(0, 12000)}\n"""\n`
      : '';
  return `${lang}DESIGNER_TASK_DESCRIPTION:
"""
${userDesc}
"""
${ctx}
Produce JSON with exactly:
1) "logical_steps" — array of { "id": string (snake_case), "description": string } — 4–12 ordered steps the agent follows.
2) "use_cases" — array of 4–10 objects, each:
   - "id": string unique
   - "label": string
   - "parent_id": string | null (tree: null = root)
   - "sort_order": number (sibling order, ascending)
   - "refinement_prompt": string (may be "")
   - "dialogue": array of { "turn_id": string unique, "role": "assistant"|"user", "content": string } — 4–12 turns, realistic
   - "notes": { "behavior": string, "tone": string }
   - "bubble_notes": object map turn_id -> short designer note (may be {})

Include at least: happy path, one correction, one ambiguity, one refusal variant (as separate use_cases or children).
Return valid JSON only.`;
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
 * @param {object} params
 * @param {string} params.userDesc
 * @param {string} [params.runtimeContext]
 * @param {string} [params.outputLanguage]
 * @param {string} [params.provider]
 * @param {string} [params.model]
 * @param {import('./AIProviderService')} params.aiProviderService
 */
async function generateUseCaseBundle({
  userDesc,
  runtimeContext,
  outputLanguage,
  provider = 'groq',
  model,
  aiProviderService,
}) {
  if (!userDesc || typeof userDesc !== 'string' || userDesc.trim().length < 8) {
    throw new Error('userDesc must be a non-empty string (at least 8 characters)');
  }
  const messages = [
    { role: 'system', content: UC_SYSTEM },
    {
      role: 'user',
      content: buildGenerateUseCasesUserMessage(userDesc.trim(), outputLanguage, runtimeContext),
    },
  ];
  const maxTokens = provider === 'openai' ? 4096 : 8192;
  const response = await aiProviderService.callAI(provider, messages, {
    model: model || undefined,
    temperature: 0.4,
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
  return validateUseCaseBundle(parsed);
}

function buildRegenerateUseCaseUserMessage(outputLanguage, useCase, allCases, logicalSteps) {
  const lang =
    typeof outputLanguage === 'string' && outputLanguage.trim()
      ? `OUTPUT_LANGUAGE (BCP 47): ${outputLanguage.trim()}\n`
      : '';
  return `${lang}You refine ONE use case. Current use case (JSON):\n${JSON.stringify(useCase)}\n\nAll use cases (context, do not remove others):\n${JSON.stringify(allCases).slice(0, 8000)}\n\nLogical steps:\n${JSON.stringify(logicalSteps).slice(0, 4000)}\n\nReturn JSON with a single key "use_case" containing the full updated use case object (same shape as input), with dialogue and notes revised according to refinement_prompt in the object (or general improvement if empty). Preserve "id" and "parent_id" unless you are explicitly merging — keep the same "id". Valid JSON only.`;
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
  provider = 'groq',
  model,
  aiProviderService,
}) {
  if (!useCase || typeof useCase !== 'object') {
    throw new Error('useCase is required');
  }
  const messages = [
    { role: 'system', content: UC_SYSTEM },
    {
      role: 'user',
      content: buildRegenerateUseCaseUserMessage(outputLanguage, useCase, allCases, logicalSteps || []),
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
  const parsed = JSON.parse(jsonStr);
  if (!parsed || typeof parsed !== 'object' || !parsed.use_case) {
    throw new Error('Invalid JSON: expected { use_case }');
  }
  return parsed.use_case;
}

function buildRegenerateTurnUserMessage(outputLanguage, useCase, turnId) {
  const lang =
    typeof outputLanguage === 'string' && outputLanguage.trim()
      ? `OUTPUT_LANGUAGE (BCP 47): ${outputLanguage.trim()}\n`
      : '';
  return `${lang}Use case (JSON):\n${JSON.stringify(useCase).slice(0, 8000)}\n\nRegenerate ONLY the dialogue turn with turn_id === "${String(turnId)}". Return JSON: { "turn": { "turn_id": same as input, "role": "assistant"|"user", "content": "..." } }. Keep role the same as the current turn. Valid JSON only.`;
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
  });
  const content = response?.choices?.[0]?.message?.content;
  const jsonStr = extractJsonString(content);
  const parsed = JSON.parse(jsonStr);
  if (!parsed || typeof parsed !== 'object' || !parsed.turn) {
    throw new Error('Invalid JSON: expected { turn }');
  }
  return parsed.turn;
}

module.exports = {
  generateUseCaseBundle,
  regenerateUseCase,
  regenerateTurn,
  validateUseCaseBundle,
};
