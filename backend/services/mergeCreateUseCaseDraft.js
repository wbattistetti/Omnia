/**
 * When creating a use case from a designer draft, merge LLM-normalized output with the draft
 * if the model omits label or payoff (fallback keeps manual input usable).
 *
 * @param {Record<string, unknown>} normalized - Output of normalizeUseCase(parsed.use_case)
 * @param {Record<string, unknown>} draftUseCase - Original draft payload from the client
 * @returns {Record<string, unknown>}
 */
function mergeCreateUseCaseWithDraft(normalized, draftUseCase) {
  const draftLabel = typeof draftUseCase.label === 'string' ? draftUseCase.label.trim() : '';
  const draftBehavior =
    draftUseCase.notes &&
    typeof draftUseCase.notes === 'object' &&
    draftUseCase.notes !== null &&
    typeof draftUseCase.notes.behavior === 'string'
      ? draftUseCase.notes.behavior.trim()
      : '';
  const nextLabel =
    typeof normalized.label === 'string' && normalized.label.trim()
      ? normalized.label.trim().slice(0, 160)
      : draftLabel.slice(0, 160);
  const nextPayoff =
    typeof normalized.payoff === 'string' && normalized.payoff.trim()
      ? normalized.payoff.trim().slice(0, 8000)
      : draftBehavior.slice(0, 8000);
  return { ...normalized, label: nextLabel, payoff: nextPayoff };
}

module.exports = { mergeCreateUseCaseWithDraft };
