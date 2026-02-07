// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useCallback } from 'react';
import { getIsTesting } from '@responseEditor/testingState';

export interface UseProfileUpdateParams {
  updateSelectedNode: (updater: (node: any) => any, notifyProvider?: boolean) => void;
}

/**
 * Hook that provides handleProfileUpdate function for updating NLP profile.
 */
export function useProfileUpdate(params: UseProfileUpdateParams) {
  const { updateSelectedNode } = params;

  const handleProfileUpdate = useCallback((partialProfile: any) => {
    // CRITICAL: Blocca aggiornamenti durante batch testing per prevenire re-render infiniti
    if (getIsTesting()) {
      console.log('[handleProfileUpdate] Blocked: batch testing active');
      return;
    }

    // Usa updateSelectedNode per aggiornare il node e salvare l'override
    updateSelectedNode((prev: any) => {
      if (!prev) {
        return prev;
      }

      const updated = {
        ...prev,
        nlpProfile: {
          ...(prev.nlpProfile || {}),
          ...partialProfile
        }
      };

      // Aggiorna anche nlpContract per salvare l'override
      if (!updated.nlpContract) {
        updated.nlpContract = {};
      }

      // Salva tutte le proprietà del profile nel nlpContract come override
      updated.nlpContract = {
        ...updated.nlpContract,
        ...partialProfile,
        // Assicura che regex, synonyms, ecc. siano salvati
        regex: partialProfile.regex !== undefined ? partialProfile.regex : updated.nlpContract.regex,
        synonyms: partialProfile.synonyms !== undefined ? partialProfile.synonyms : updated.nlpContract.synonyms,
        kind: partialProfile.kind !== undefined ? partialProfile.kind : updated.nlpContract.kind,
        examples: partialProfile.examples !== undefined ? partialProfile.examples : updated.nlpContract.examples,
        testCases: partialProfile.testCases !== undefined ? partialProfile.testCases : updated.nlpContract.testCases,
        formatHints: partialProfile.formatHints !== undefined ? partialProfile.formatHints : updated.nlpContract.formatHints,
        minConfidence: partialProfile.minConfidence !== undefined ? partialProfile.minConfidence : updated.nlpContract.minConfidence,
        postProcess: partialProfile.postProcess !== undefined ? partialProfile.postProcess : updated.nlpContract.postProcess,
        waitingEsc1: partialProfile.waitingEsc1 !== undefined ? partialProfile.waitingEsc1 : updated.nlpContract.waitingEsc1,
        waitingEsc2: partialProfile.waitingEsc2 !== undefined ? partialProfile.waitingEsc2 : updated.nlpContract.waitingEsc2,
      };

      return updated;
    }, true);
  }, [updateSelectedNode]);

  return handleProfileUpdate;
}
