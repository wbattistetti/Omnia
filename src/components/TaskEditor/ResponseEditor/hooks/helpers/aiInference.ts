// aiInference.ts
// Service per chiamata API AI
// ⚠️ NOTA: Chiamato SOLO se:
// - task.type === DataRequest
// - task.templateId === undefined/null
// - label.length >= 3

/**
 * Chiama l'API AI per inferire il DDT
 *
 * @param label - Label della riga di nodo (es. "chiedi data di nascita")
 * @param provider - Provider AI (es. "openai", "groq")
 * @param model - Modello AI (es. "gpt-4-turbo-preview")
 * @returns Risultato inferenza AI o null se errore
 */
export async function callAIInference(
  label: string,
  provider: string,
  model: string
): Promise<any | null> {
  try {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Inference timeout')), 10000);
    });

    const fetchPromise = fetch('/step2-with-provider', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userDesc: label,
        provider: provider.toLowerCase(),
        model: model
      }),
    });

    const response = await Promise.race([fetchPromise, timeoutPromise]) as Response;

    if (response.ok) {
      return await response.json();
    }

    console.warn('[aiInference] API response not OK:', response.status);
    return null;
  } catch (error) {
    console.error('[aiInference] Errore inferenza API:', error);
    return null;
  }
}


