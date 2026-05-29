/**
 * Testo precompilato per «Crea nuove specifiche» (input designer prima della chiamata IA).
 */

import type { KbAnalysisObservation } from '@domain/knowledgeBase/kbDocumentAnalysisWorkflow';

/** Brief modificabile dal designer prima di generare la specifica strutturata. */
export function buildDesignerSpecBrief(observation: KbAnalysisObservation): string {
  const lines = [
    '## Osservazione',
    observation.text.trim(),
    '',
    '## Riferimento (risposta analisi)',
    observation.interpretation.trim(),
    '',
    '## Cosa formalizzare nella specifica API',
    'Descrivi parametri SEND/RECEIVE da aggiungere al contratto del backend esistente.',
  ];
  return lines.join('\n');
}
