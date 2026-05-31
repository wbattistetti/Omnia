/**
 * Testi user-facing per blocco deploy / copy quando il mapping non è valido.
 */

/** Step wizard «Prompts» (use case + slot mapping). */
export const AGENT_WIZARD_PROMPTS_STEP_INDEX = 3 as const;

export const SLOT_MAPPING_PAYOFF =
  'Associa ogni esempio a una destinazione (semantica o backend), poi conferma con il pollice.';

/**
 * Riassume il banner tecnico `MAPPING — …` per il menu Deploy (non il dump grezzo).
 */
export function formatMappingBlockedReasonShort(
  technicalBanner: string | null | undefined
): string {
  const raw = String(technicalBanner ?? '').trim();
  if (!raw || raw.startsWith('MAPPED')) {
    return 'Completa Slot mapping e binding backend, poi scegli stile e voce per l’upload.';
  }

  const hints: string[] = [];
  if (/non confermati/i.test(raw)) {
    hints.push('conferma le righe dello Slot mapping (pollice su)');
  }
  if (/non classificata/i.test(raw) || /categoria non classificata/i.test(raw)) {
    hints.push('scegli una destinazione per ogni esempio (non «undefined»)');
  }
  if (/conflitto/i.test(raw)) {
    hints.push('risolvi i conflitti in Slot mapping');
  }
  if (/Nessun binding backend/i.test(raw) || /fillFrom/i.test(raw)) {
    hints.push('collega i backend (Compila catalogo o tab Backend → RECEIVE)');
  }
  if (/hint SEND/i.test(raw)) {
    hints.push('completa i path SEND per date/orari');
  }
  if (/frase/i.test(raw) && /allineare/i.test(raw)) {
    hints.push('ricalcola le frasi (Compila catalogo)');
  }

  if (hints.length === 0) {
    return 'Apri Slot mapping dal passo Prompts, correggi le righe evidenziate, poi riprova.';
  }

  return `${SLOT_MAPPING_PAYOFF} Da fare: ${hints.join('; ')}. Usa «Compila e Copy system prompt» per compilare e aprire il pannello.`;
}
