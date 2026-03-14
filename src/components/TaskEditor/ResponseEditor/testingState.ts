/**
 * ✅ BATCH TESTING MODE - Immutability Contract
 *
 * During batch testing, the following structural mutations are PROHIBITED:
 * - Node structure updates (updateSelectedNode)
 * - Profile updates (handleProfileUpdate, onChange)
 * - Kind/synonyms/format/regex changes (setKind, setSynonymsText, etc.)
 * - Any state updates that trigger re-renders of parent components
 *
 * This is NOT a cosmetic restriction - it prevents feedback loops:
 * - onChange → handleProfileUpdate → updateSelectedNode → re-render → onChange → ...
 *
 * The batch testing worker runs PURE functions that do NOT touch React state.
 * Only AFTER all tests complete, the UI is updated ONCE with all results.
 *
 * All mutation functions MUST check getIsTesting() and return early if true.
 */

let isTesting = false;

export const startTesting = (): void => {
  isTesting = true;
  console.log('[testingState] startTesting called', { isTesting: true });
};

export const stopTesting = (): void => {
  isTesting = false;
  console.log('[testingState] stopTesting called', { isTesting: false });
};

export const getIsTesting = (): boolean => {
  return isTesting;
};

// ✅ Helper per verificare se una mutazione è permessa durante batch
// setNewExample e setExamplesList sono permessi perché non modificano la struttura del nodo
export const isMutationAllowed = (mutationType: 'node' | 'profile' | 'examples' | 'input'): boolean => {
  if (!getIsTesting()) return true; // Sempre permesso se non in batch

  // ✅ Durante batch, permetti solo mutazioni "safe" che non modificano struttura
  if (mutationType === 'examples' || mutationType === 'input') {
    return true; // ✅ Permetti: non modificano struttura del nodo
  }

  // ❌ Blocca mutazioni strutturali
  return false;
};
