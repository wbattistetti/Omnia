/**
 * Unisce il contract stile catalogo (preset use case) con le note di apprendimento
 * persistite dal designer (`agentUseCaseStyleLearningNotes`). Una sola stringa viene
 * passata alle API come `globalStyleContract`. Le note sono normalizzate con `trim()`:
 * stringa vuota o solo whitespace non aggiunge blocco.
 */

/** Prefisso interno: note contengono l’intero contratto sostitutivo (wizard DX). */
export const USE_CASE_FULL_STYLE_NOTES_PREFIX = '__FULL_STYLE__\n';

const LEARNING_NOTES_HEADING = '### Stile da apprendimento (note designer)';

export function mergeUseCaseGlobalStyleContract(
  baseContract: string,
  learningNotes: string
): string {
  const notes = learningNotes.trim();
  if (!notes) return baseContract.trimEnd();
  if (notes.startsWith(USE_CASE_FULL_STYLE_NOTES_PREFIX)) {
    return notes.slice(USE_CASE_FULL_STYLE_NOTES_PREFIX.length).trim();
  }
  const base = baseContract.trimEnd();
  return `${base}\n\n${LEARNING_NOTES_HEADING}\n\n${notes}`;
}

/**
 * Converte il testo mostrato/modificato nel pannello DX in `agentUseCaseStyleLearningNotes`.
 */
export function parseStyleContractToLearningNotes(
  editedContract: string,
  baseContract: string
): string {
  const base = baseContract.trimEnd();
  const text = editedContract.trim();
  if (!text || text === base) return '';
  const sep = `\n\n${LEARNING_NOTES_HEADING}\n\n`;
  if (text.startsWith(base + sep)) {
    return text.slice(base.length + sep.length).trim();
  }
  return `${USE_CASE_FULL_STYLE_NOTES_PREFIX}${text}`;
}
