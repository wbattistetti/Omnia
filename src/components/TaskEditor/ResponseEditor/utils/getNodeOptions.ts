/**
 * Helper per ottenere le opzioni di un nodo DDT
 *
 * @deprecated Usa getNodeValues() invece per valori predefiniti (values[])
 *
 * IMPORTANTE: Non confondere:
 * - values[] = opzioni predefinite (valori tra cui scegliere) → usa getNodeValues()
 * - subData[] = parti composite (struttura del dato) → NON sono opzioni!
 *
 * Questa funzione è mantenuta per backward compatibility ma dovrebbe essere deprecata.
 */

export interface NodeOption {
  id: string;
  label: string;
  [key: string]: any; // Allow additional properties
}

/**
 * Ottiene le opzioni di un nodo DDT
 * @param node - Nodo DDT (data o subData)
 * @returns Array di opzioni, o array vuoto se non ci sono opzioni
 */
export function getNodeOptions(node: any): NodeOption[] {
  if (!node) return [];

  // ✅ Opzione 1: subData[] come opzioni (per dati compositi o scelte)
  if (node.subData && Array.isArray(node.subData) && node.subData.length > 0) {
    return node.subData.map((sub: any) => ({
      id: sub.id || sub.label || '',
      label: sub.label || sub.id || '',
      ...sub, // Include all sub properties
    }));
  }

  // ✅ Opzione 2: options[] diretto (futuro, per semplicità)
  if (node.options && Array.isArray(node.options) && node.options.length > 0) {
    return node.options.map((opt: any) => ({
      id: typeof opt === 'string' ? opt : (opt.id || opt.label || ''),
      label: typeof opt === 'string' ? opt : (opt.label || opt.id || ''),
      ...(typeof opt === 'object' ? opt : {}),
    }));
  }

  return [];
}

/**
 * Verifica se un nodo ha opzioni
 */
export function hasNodeOptions(node: any): boolean {
  return getNodeOptions(node).length > 0;
}
