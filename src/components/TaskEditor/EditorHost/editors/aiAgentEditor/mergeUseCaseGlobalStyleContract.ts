/**
 * Unisce il contract stile catalogo (preset use case) con le note di apprendimento
 * persistite dal designer (`agentUseCaseStyleLearningNotes`). Una sola stringa viene
 * passata alle API come `globalStyleContract`. Le note sono normalizzate con `trim()`:
 * stringa vuota o solo whitespace non aggiunge blocco.
 */

export function mergeUseCaseGlobalStyleContract(
  baseContract: string,
  learningNotes: string
): string {
  const base = baseContract.trimEnd();
  const notes = learningNotes.trim();
  if (!notes) return base;
  return `${base}\n\n### Stile da apprendimento (note designer)\n\n${notes}`;
}
