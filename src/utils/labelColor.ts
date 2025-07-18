import { LABEL_COLORS } from '../components/Flowchart/labelColors';

/**
 * Restituisce il colore di background e testo per una label in base al tipo e alla presenza di userActs.
 * - backendActions: azzurro
 * - agentActs interattivo (userActs): arancione
 * - agentActs informativo: verde
 * - fallback: verde oliva
 *
 * @param categoryType Tipo di categoria (es. 'agentActs', 'backendActions')
 * @param userActs Array di userActs associati (se presente)
 * @returns Oggetto { bg, text } con i colori da usare
 */
export function getLabelColor(categoryType: string, userActs?: string[]) {
  if (categoryType === 'backendActions') {
    return LABEL_COLORS.backendActions;
  }
  if (categoryType === 'agentActs') {
    if (Array.isArray(userActs) && userActs.length > 0) {
      return LABEL_COLORS.agentActs.interactive;
    }
    return LABEL_COLORS.agentActs.informative;
  }
  // fallback
  return { bg: '#7a9c59', text: '#2F6D3E' };
} 