/**
 * Design-time: translate natural language into a JavaScript expression for SEND advancement.
 * Uses AIProviderService; response JSON { dslExpression, refinedNaturalLanguage? }.
 * Il campo dslExpression contiene l'espressione JS (persistenza invariata).
 */

/**
 * @param {object} params
 * @param {string} params.naturalLanguage
 * @param {string} params.targetParam
 * @param {string} params.targetType
 * @param {object} params.signature - e.g. { parameters: { name: { type, description } } }
 * @param {import('./AIProviderService')} params.aiProviderService
 * @param {string} [params.provider]
 * @param {string} [params.model]
 * @returns {Promise<{ dslExpression: string, refinedNaturalLanguage?: string }>}
 */
async function translateAdvancementDslRequest(params) {
  const {
    naturalLanguage,
    targetParam,
    targetType,
    signature,
    aiProviderService,
    provider = 'groq',
    model,
  } = params;

  const nl = typeof naturalLanguage === 'string' ? naturalLanguage.trim() : '';
  if (!nl) {
    const e = new Error('naturalLanguage is required');
    e.statusCode = 400;
    throw e;
  }
  const tp = typeof targetParam === 'string' ? targetParam.trim() : '';
  if (!tp) {
    const e = new Error('targetParam is required');
    e.statusCode = 400;
    throw e;
  }
  const tt = typeof targetType === 'string' ? targetType.trim() : 'String';
  if (!aiProviderService) {
    const e = new Error('aiProviderService is required');
    e.statusCode = 500;
    throw e;
  }

  const system = `You are a compiler assistant. Output exactly one JSON object with keys:
- "dslExpression" (string, required): the **body** of ONE JavaScript expression for the next SEND value (standard JS). No markdown outside JSON.

**Goal:** produce an expression whose evaluated value matches \`targetType\`. Never a top-level assignment. Never an **uninvoked** empty-parameter arrow at the root: forbidden \`() => …\` (that would evaluate to a Function, not a value). For multi-line / block logic use an **invoked** IIFE only: \`( () => { … return x; } )()\`.

**Interpreter allowed:** infix operators (+ - * /), native builtins (\`Date\`, \`Math\`, …), literals, ternary, \`param.x\`, \`prev.x\`, \`===\`, etc.

**Bindings (read carefully):** only \`param\` and \`prev\` (objects built from SEND row **literals** at Play/Test / batch). The keys in \`backendParameterSignature.parameters\` are **internal SEND names** (task \`internalName\` / mapping \`wireKey\` — the “left” technical id), **not** the OpenAPI / “Campo API” name on the right. OpenAPI may be \`startDate\` while the internal key is \`start_date\` (slug). **Use only the exact keys present in \`parameters\`** for \`param.<key>\` and \`prev.<key>\`. Do not invent \`param.prev\` or camelCase API names unless that string is literally a key in \`parameters\`. For “previous batch” values use \`prev.<internalName>\` when appropriate.

**Type rules (MUST):**
- **String** — final value must be a **string** (explicit conversion: \`.toString()\`, \`.toISOString()\`, \`.toISOString().slice(0,10)\`, \`String(...)\`, template literals).
- **Date** — a \`Date\` instance, a finite **number** (ms, e.g. \`getTime()\` or \`setDate\` return), or an ISO date string; runtime normalizes.
- **Int** / **Number** — a finite **number** (integer for Int).

**Examples** (assume \`parameters\` contains internal keys \`start_date\` and \`days\`, not OpenAPI \`startDate\`):
- Wrong (assignment): \`x = new Date(param.start_date).setDate(...)\`
- Wrong (uninvoked arrow): \`() => { const d = new Date(param.start_date); d.setDate(d.getDate() + param.days); return d.toISOString(); }\`
- Wrong (API name): \`param.startDate\` when the key in \`parameters\` is \`start_date\` — will be \`undefined\` at runtime.
- OK (**Date**): \`new Date(param.start_date).setDate(new Date(param.start_date).getDate() + param.days)\` (numeric ms is ok for Date type)
- OK (**String**): \`( () => { const d = new Date(param.start_date); d.setDate(d.getDate() + param.days); return d.toISOString().slice(0, 10); } )()\`
- OK (**Int**): \`param.days + 1\`

If a \`Date\` helper returns a number but **targetType is String**, wrap so the **final** value is a string.

- "refinedNaturalLanguage" (string, required): same language as the user (often Italian), concise; verbatim if already clear.`;

  const user = JSON.stringify(
    {
      targetParam: tp,
      targetType: tt,
      userIntent: nl,
      backendParameterSignature: signature && typeof signature === 'object' ? signature : {},
    },
    null,
    0
  );

  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];

  const result = await aiProviderService.callAI(provider, messages, {
    model: model || undefined,
    temperature: 0.1,
    maxTokens: 900,
  });

  const rawText = extractChatText(result);
  if (!rawText) {
    const e = new Error('Empty AI response');
    e.statusCode = 502;
    throw e;
  }

  const text = stripMarkdownJsonFence(rawText);

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    const e = new Error('AI did not return valid JSON');
    e.statusCode = 502;
    throw e;
  }
  const dslExpression =
    typeof parsed.dslExpression === 'string'
      ? parsed.dslExpression.trim()
      : typeof parsed.expression === 'string'
        ? parsed.expression.trim()
        : '';

  if (!dslExpression) {
    const e = new Error('JSON missing dslExpression');
    e.statusCode = 502;
    throw e;
  }

  let refinedNaturalLanguage;
  if (typeof parsed.refinedNaturalLanguage === 'string') {
    refinedNaturalLanguage = parsed.refinedNaturalLanguage.trim();
  }

  const out = { dslExpression };
  if (refinedNaturalLanguage && refinedNaturalLanguage !== nl) {
    out.refinedNaturalLanguage = refinedNaturalLanguage;
  }
  return out;
}

function stripMarkdownJsonFence(text) {
  const t = String(text || '').trim();
  if (!t.startsWith('```')) return t;
  const endFence = t.lastIndexOf('```');
  if (endFence <= 2) return t;
  const firstLineEnd = t.indexOf('\n');
  const start = firstLineEnd === -1 ? 3 : firstLineEnd + 1;
  return t.slice(start, endFence).trim();
}

function extractChatText(result) {
  try {
    return result.choices[0].message.content.trim();
  } catch {
    return '';
  }
}

module.exports = {
  translateAdvancementDslRequest,
};
