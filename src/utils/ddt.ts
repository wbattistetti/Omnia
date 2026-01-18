export function isDDTEmpty(ddt?: any): boolean {
  try {
    if (!ddt || typeof ddt !== 'object') return true;
    const mains: any[] = Array.isArray(ddt?.mainData)
      ? ddt.mainData
      : (Array.isArray(ddt?.mains) ? ddt.mains : []);
    // Se esiste la struttura (mainData/mains), non è vuoto
    return mains.length === 0;
  } catch {
    return true;
  }
}

/**
 * Verifica se il DDT ha mainData ma senza stepPrompts completi
 * Questo indica che la struttura esiste ma i messaggi devono ancora essere generati
 */
export function hasMainDataButNoStepPrompts(ddt?: any): boolean {
  try {
    if (!ddt || typeof ddt !== 'object') return false;
    const mains: any[] = Array.isArray(ddt?.mainData)
      ? ddt.mainData
      : (Array.isArray(ddt?.mains) ? ddt.mains : []);

    if (mains.length === 0) return false;

    // Verifica se almeno un mainData non ha stepPrompts completi
    return mains.some((main: any) => {
      // Se non ha stepPrompts, o ha stepPrompts ma sono vuoti
      if (!main.stepPrompts || typeof main.stepPrompts !== 'object') {
        return true;
      }

      // Verifica se ha almeno un tipo di stepPrompts (start, noMatch, noInput, ecc.)
      const stepPromptsKeys = Object.keys(main.stepPrompts);
      if (stepPromptsKeys.length === 0) {
        return true;
      }

      // Verifica se almeno un tipo di stepPrompts ha messaggi
      const hasMessages = stepPromptsKeys.some((key: string) => {
        const stepPrompt = main.stepPrompts[key];
        // stepPrompt può essere array di stringhe o oggetto con keys/values
        if (Array.isArray(stepPrompt)) {
          return stepPrompt.length > 0;
        }
        if (stepPrompt && typeof stepPrompt === 'object') {
          // Se è un oggetto con keys/values (formato nuovo)
          return (stepPrompt.keys && Array.isArray(stepPrompt.keys) && stepPrompt.keys.length > 0) ||
                 (stepPrompt.values && Array.isArray(stepPrompt.values) && stepPrompt.values.length > 0);
        }
        return false;
      });

      return !hasMessages;
    });
  } catch {
    return false;
  }
}


