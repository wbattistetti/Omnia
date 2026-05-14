/**
 * Sliding-window burst limiter (per chiave, es. IP) per proteggere costi LLM:
 * blocca se in una finestra temporale si supera un numero massimo di richieste.
 *
 * Contatore condiviso per tutte le rotte Express di **progettazione IA** (stesso limite per IP).
 * Configurazione (preferenza `OMNIA_DESIGN_AI_LLM_BURST_*`, fallback legacy `OMNIA_AI_AGENT_GENERATE_BURST_*`):
 * - `OMNIA_DESIGN_AI_LLM_BURST_WINDOW_MS` o `OMNIA_AI_AGENT_GENERATE_BURST_WINDOW_MS` (default 1000)
 * - `OMNIA_DESIGN_AI_LLM_BURST_MAX` o `OMNIA_AI_AGENT_GENERATE_BURST_MAX` (default 10)
 * - Disattiva: `OMNIA_DESIGN_AI_LLM_BURST=0` oppure `OMNIA_AI_AGENT_GENERATE_BURST=0` / `false`
 */

'use strict';

/**
 * @param {{ windowMs?: number, maxPerWindow?: number, now?: () => number }} [opts]
 */
function createSlidingWindowBurstGuard(opts = {}) {
  const windowMs =
    typeof opts.windowMs === 'number' && Number.isFinite(opts.windowMs) && opts.windowMs > 0
      ? opts.windowMs
      : 1000;
  const maxPerWindow =
    typeof opts.maxPerWindow === 'number' &&
    Number.isFinite(opts.maxPerWindow) &&
    opts.maxPerWindow > 0
      ? Math.floor(opts.maxPerWindow)
      : 10;
  const nowFn = typeof opts.now === 'function' ? opts.now : () => Date.now();

  /** @type {Map<string, number[]>} */
  const stampsByKey = new Map();

  /**
   * @param {string} rawKey
   * @returns {{ ok: boolean, retryAfterMs: number, inWindow: number }}
   */
  function tryConsume(rawKey) {
    const key = String(rawKey || 'unknown').trim() || 'unknown';
    const now = nowFn();
    let arr = stampsByKey.get(key);
    if (!arr) {
      arr = [];
      stampsByKey.set(key, arr);
    }
    const cutoff = now - windowMs;
    while (arr.length > 0 && arr[0] < cutoff) {
      arr.shift();
    }
    if (arr.length >= maxPerWindow) {
      const oldest = arr[0];
      return {
        ok: false,
        retryAfterMs: Math.max(0, oldest + windowMs - now),
        inWindow: arr.length,
      };
    }
    arr.push(now);
    return { ok: true, retryAfterMs: 0, inWindow: arr.length };
  }

  return {
    tryConsume,
    /** @internal tests */
    _config: () => ({ windowMs, maxPerWindow }),
  };
}

function createDesignAiLlmBurstGuardFromEnv() {
  const disabled =
    process.env.OMNIA_DESIGN_AI_LLM_BURST === '0' ||
    process.env.OMNIA_DESIGN_AI_LLM_BURST === 'false' ||
    process.env.OMNIA_AI_AGENT_GENERATE_BURST === '0' ||
    process.env.OMNIA_AI_AGENT_GENERATE_BURST === 'false';
  if (disabled) {
    return {
      tryConsume: () => ({ ok: true, retryAfterMs: 0, inWindow: 0 }),
      _disabled: true,
    };
  }
  const windowMs = parseInt(
    process.env.OMNIA_DESIGN_AI_LLM_BURST_WINDOW_MS ||
      process.env.OMNIA_AI_AGENT_GENERATE_BURST_WINDOW_MS ||
      '1000',
    10
  );
  const maxPerWindow = parseInt(
    process.env.OMNIA_DESIGN_AI_LLM_BURST_MAX ||
      process.env.OMNIA_AI_AGENT_GENERATE_BURST_MAX ||
      '10',
    10
  );
  return createSlidingWindowBurstGuard({
    windowMs: Number.isFinite(windowMs) && windowMs > 0 ? windowMs : 1000,
    maxPerWindow: Number.isFinite(maxPerWindow) && maxPerWindow > 0 ? maxPerWindow : 10,
  });
}

/** @deprecated Usare {@link createDesignAiLlmBurstGuardFromEnv}; alias per compatibilità. */
const createAiAgentGenerateBurstGuardFromEnv = createDesignAiLlmBurstGuardFromEnv;

module.exports = {
  createSlidingWindowBurstGuard,
  createDesignAiLlmBurstGuardFromEnv,
  createAiAgentGenerateBurstGuardFromEnv,
};
