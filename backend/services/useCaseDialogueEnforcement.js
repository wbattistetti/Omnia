/**
 * Enforce non-empty assistant dialogue on LLM use-case JSON (chunked or full bundle).
 */

const ALT_ASSISTANT_KEYS = [
  'assistant_message',
  'assistant_text',
  'agent_text',
  'agent_message',
  'message',
  'example',
  'example_message',
];

/**
 * @param {unknown} uc
 * @returns {string}
 */
function assistantContentFromDialogueArray(uc) {
  if (!uc || typeof uc !== 'object') return '';
  const dialogue = Array.isArray(uc.dialogue) ? uc.dialogue : [];
  const assistant =
    dialogue.find((t) => t && typeof t === 'object' && t.role === 'assistant') || dialogue[0];
  if (!assistant || typeof assistant !== 'object') return '';
  return typeof assistant.content === 'string' ? assistant.content.trim() : '';
}

/**
 * @param {unknown} uc
 * @returns {string}
 */
function assistantContentFromAltKeys(uc) {
  if (!uc || typeof uc !== 'object') return '';
  for (const key of ALT_ASSISTANT_KEYS) {
    const v = uc[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

/**
 * @param {unknown} uc
 * @returns {string}
 */
function getRawUseCaseAssistantContent(uc) {
  const fromDialogue = assistantContentFromDialogueArray(uc);
  if (fromDialogue) return fromDialogue;
  return assistantContentFromAltKeys(uc);
}

/**
 * Copy alt-key / partial dialogue into standard `dialogue[0].assistant` shape.
 * @param {object} uc
 * @returns {object}
 */
function coalesceRawUseCaseDialogue(uc) {
  if (!uc || typeof uc !== 'object') return uc;
  const content = getRawUseCaseAssistantContent(uc);
  if (!content) return uc;
  const dialogue = Array.isArray(uc.dialogue) ? uc.dialogue : [];
  const existing = dialogue.find((t) => t && typeof t === 'object' && t.role === 'assistant');
  if (existing && typeof existing.content === 'string' && existing.content.trim()) {
    return uc;
  }
  const turn_id =
    existing && typeof existing.turn_id === 'string' && existing.turn_id.trim()
      ? existing.turn_id.trim()
      : `turn_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  return {
    ...uc,
    dialogue: [{ turn_id, role: 'assistant', content }],
  };
}

/**
 * @param {readonly object[]} useCases
 * @returns {object[]}
 */
function coalesceRawUseCasesDialogue(useCases) {
  if (!Array.isArray(useCases)) return [];
  return useCases.map((u) => coalesceRawUseCaseDialogue(u));
}

/**
 * @param {readonly object[]} useCases
 * @returns {object[]}
 */
function useCasesMissingAssistantContent(useCases) {
  if (!Array.isArray(useCases)) return [];
  return useCases.filter((uc) => !getRawUseCaseAssistantContent(uc));
}

/**
 * @param {readonly object[]} missing
 * @returns {string}
 */
function buildDialogueCompleteRetryDirective(missing) {
  const labels = missing
    .slice(0, 8)
    .map((u) => {
      const id = typeof u.id === 'string' ? u.id : '';
      const label = typeof u.label === 'string' ? u.label.slice(0, 48) : '';
      return label || id || '?';
    })
    .join(', ');
  const n = missing.length;
  return (
    `\nOUTPUT_RETRY (mandatory): ${n} use case(s) in your previous JSON had missing or empty assistant "dialogue"[0]."content". ` +
    `Every object in "use_cases" MUST include dialogue: [{ "turn_id": string, "role": "assistant", "content": "<one full non-empty sentence>" }]. ` +
    `Keep scenario.descrittivo short if needed, but never omit or leave blank the assistant message. ` +
    (labels ? `Rows that were incomplete: ${labels}.` : '')
  );
}

/**
 * @param {readonly object[]} missing
 * @param {string} stage
 */
/**
 * @param {readonly object[]} missing
 * @param {string} stage
 * @param {number} [attemptCount]
 */
function throwUseCasesMissingDialogue(missing, stage, attemptCount) {
  const ids = missing
    .map((u) => (typeof u.id === 'string' ? u.id : typeof u.label === 'string' ? u.label : '?'))
    .slice(0, 8);
  const attemptsNote =
    typeof attemptCount === 'number' && attemptCount > 0
      ? ` after ${attemptCount} attempt(s)`
      : '';
  const err = new Error(
    `Use case generation (${stage}): ${missing.length} scenario(s) without assistant message${attemptsNote} (ids: ${ids.join(', ')})`
  );
  err.code = 'USE_CASE_DIALOGUE_INCOMPLETE';
  err.message = `${err.message} Riprova la generazione; se hai già scenari in lista, salva e usa «Crea altri use case».`;
  throw err;
}

module.exports = {
  ALT_ASSISTANT_KEYS,
  getRawUseCaseAssistantContent,
  coalesceRawUseCaseDialogue,
  coalesceRawUseCasesDialogue,
  useCasesMissingAssistantContent,
  buildDialogueCompleteRetryDirective,
  throwUseCasesMissingDialogue,
};
