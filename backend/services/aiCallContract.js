// Please write clean, production-grade JavaScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Single source of truth for "fail-loud" validation of AI call contracts.
 *
 * Rule (designer LLM, Omnia Tutor):
 *   - The model MUST come from the designer's selection (Settings -> Omnia Tutor,
 *     persisted in `localStorage('omnia.aiModel')`) and travel end-to-end in every
 *     payload reaching the backend.
 *   - The provider is derived from the same selection (`localStorage('omnia.aiProvider')`).
 *   - There are NO hardcoded fallbacks: if either is missing, the call is rejected
 *     with a 400 error so the UI can route the designer to Omnia Tutor with a banner.
 */

const SUPPORTED_PROVIDERS = new Set(['openai', 'groq']);

/**
 * Assert that both provider and model are present and valid.
 *
 * @param {object} params
 * @param {unknown} params.provider Raw provider id from the request (e.g. body.provider).
 * @param {unknown} params.model Raw model id from the request (e.g. body.model).
 * @param {string} [params.action] Human-friendly action name used in the error (e.g. "Create Agent").
 * @returns {{ provider: string, model: string }} Normalized values (lowercased provider, trimmed model).
 * @throws {Error & { code: 'AI_PROVIDER_REQUIRED'|'AI_MODEL_REQUIRED'|'AI_PROVIDER_UNSUPPORTED', statusCode: 400 }}
 */
function assertAiCallContract({ provider, model, action }) {
  const actionLabel = typeof action === 'string' && action.trim() ? action.trim() : 'AI call';
  const providerNorm =
    typeof provider === 'string' && provider.trim() ? provider.trim().toLowerCase() : null;
  if (!providerNorm) {
    const err = new Error(
      `Provider not specified for ${actionLabel}. ` +
        'Configure one in Settings -> Omnia Tutor (designer LLM) before calling the AI.'
    );
    err.code = 'AI_PROVIDER_REQUIRED';
    err.statusCode = 400;
    throw err;
  }
  if (!SUPPORTED_PROVIDERS.has(providerNorm)) {
    const err = new Error(
      `Unsupported AI provider "${providerNorm}" for ${actionLabel}. ` +
        `Supported providers: ${Array.from(SUPPORTED_PROVIDERS).join(', ')}.`
    );
    err.code = 'AI_PROVIDER_UNSUPPORTED';
    err.statusCode = 400;
    throw err;
  }
  const modelNorm = typeof model === 'string' && model.trim() ? model.trim() : null;
  if (!modelNorm) {
    const err = new Error(
      `AI model not selected for ${actionLabel} (provider "${providerNorm}"). ` +
        'Choose a model in Settings -> Omnia Tutor before retrying.'
    );
    err.code = 'AI_MODEL_REQUIRED';
    err.statusCode = 400;
    throw err;
  }
  return { provider: providerNorm, model: modelNorm };
}

/**
 * Map an `assertAiCallContract` error to an HTTP-friendly response payload.
 *
 * @param {Error & { code?: string, statusCode?: number }} err
 * @returns {{ status: number, body: { success: false, error: string, code: string } } | null}
 */
function aiCallContractErrorResponse(err) {
  if (!err || typeof err !== 'object') return null;
  if (
    err.code !== 'AI_PROVIDER_REQUIRED' &&
    err.code !== 'AI_PROVIDER_UNSUPPORTED' &&
    err.code !== 'AI_MODEL_REQUIRED'
  ) {
    return null;
  }
  return {
    status: typeof err.statusCode === 'number' ? err.statusCode : 400,
    body: {
      success: false,
      error: err.message || 'AI call contract violation',
      code: err.code,
    },
  };
}

module.exports = {
  assertAiCallContract,
  aiCallContractErrorResponse,
  SUPPORTED_PROVIDERS,
};
