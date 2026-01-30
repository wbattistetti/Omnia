/**
 * Helper per ottenere i valori predefiniti di un nodo DDT
 *
 * Distingue tra:
 * - values[] = opzioni predefinite (valori tra cui scegliere)
 * - subData[] = parti composite (struttura del dato)
 *
 * IMPORTANTE: Non confondere values[] con subData[]
 * - values[] = "cosa può essere" (scelta tra opzioni)
 * - subData[] = "di cosa è fatto" (composizione strutturale)
 */

export interface NodeValue {
  id: string;
  label: string;
  value?: string; // Valore da usare nella condizione
  [key: string]: any; // Allow additional properties
}

/**
 * Ottiene i valori predefiniti (values[]) di un nodo
 * NON confondere con subData[] che sono parti composite
 *
 * @param node - Nodo DDT (data o subData)
 * @returns Array di valori predefiniti, o array vuoto se non ci sono
 */
export function getNodeValues(node: any): NodeValue[] {
  if (!node) return [];

  // ✅ Legge da values[] (opzioni predefinite)
  if (node.values && Array.isArray(node.values) && node.values.length > 0) {
    return node.values.map((val: any) => ({
      id: typeof val === 'string' ? val : (val.id || val.label || ''),
      label: typeof val === 'string' ? val : (val.label || val.id || ''),
      value: typeof val === 'string' ? val : (val.value || val.label || val.id),
      ...(typeof val === 'object' ? val : {}),
    }));
  }

  return [];
}

/**
 * Verifica se un nodo ha valori predefiniti
 */
export function hasNodeValues(node: any): boolean {
  return getNodeValues(node).length > 0;
}

/**
 * Costruisce il nome della condizione: nomeDato === 'valore'
 *
 * @param dataLabel - Label del dato (es: "Motivo della chiamata")
 * @param valueLabel - Label del valore (es: "prenotazione")
 * @returns Nome della condizione (es: "motivo_della_chiamata === 'prenotazione'")
 */
export function buildConditionName(dataLabel: string, valueLabel: string): string {
  const varName = dataLabel.replace(/\s+/g, '_').toLowerCase();
  return `${varName} === '${valueLabel}'`;
}

/**
 * Estrae values[] da un task
 * Cerca nel primo data con values[] definiti
 *
 * @param task - Task da cui estrarre i valori
 * @returns Array di valori predefiniti, o array vuoto se non ci sono
 */
// ✅ NUOVO MODELLO: Task non ha più .data[], usa TaskTree.nodes[] costruito runtime
// Questa funzione deve ricevere TaskTree invece di Task
export function getValuesFromTask(taskTree: any): NodeValue[] {
  if (!taskTree?.nodes || !Array.isArray(taskTree.nodes)) return [];

  // Cerca il primo node con values[]
  for (const main of taskTree.nodes) {
    const values = getNodeValues(main);
    if (values.length > 0) {
      return values;
    }
  }

  return [];
}
