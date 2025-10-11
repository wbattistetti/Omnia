import { RuleSet } from '../types';

export const IT_RULES: RuleSet = {
  MESSAGE: [
    /^(di|comunica|informa|mostra|avvisa|spiega|annuncia)\b/i,
    /^(dice|comunica|informa|mostra|avvisa|spiega|annuncia)\b/i,
  ],
  REQUEST_DATA: [
    /^(chiedi|richiedi|domanda|acquisisci|raccogli|invita)\b/i,
    /^(chiede|richiede|domanda|acquisisce|raccoglie)\b/i,
  ],
  PROBLEM: /\b(problema|errore|guasto|bug|sintom[oi])\b/i,
  PROBLEM_SPEC_DIRECT: [
    /^(descrivi|spiega|indica|racconta)\s+(il\s+)?(problema|errore|guasto|bug|sintom[oi])\b/i,
    /^(descrive|spiega|indica|racconta)\s+(il\s+)?(problema|errore|guasto|bug|sintom[oi])\b/i,
  ],
  PROBLEM_REASON: [
    /^(chiedi|richiedi|domanda)\s+(il\s+)?(problema|motivo\s+della\s+(chiamata|telefonata|richiesta|segnalazione))\b/i,
    /^(chiede|richiede|domanda)\s+(il\s+)?(problema|motivo\s+della\s+(chiamata|telefonata|richiesta|segnalazione))\b/i,
  ],
  CONFIRM_DATA: [
    /^(conferma|verifica|accertati)\b/i,
    /\b(giusto|corretto)\??$/i,
    /\b[eè]\s+corretto\b/i,
    /^(conferma|verifica|si\s+accerta)\b/i,
  ],
  SUMMARY: [
    /^(riassumi|riepiloga|ricapitola|recap)\b/i,
    /^(riassume|riepiloga|ricapitola)\b/i,
    /\b(in sintesi|in breve)\b/i,
  ],
  BACKEND_CALL: [
    /\b(api|webhook|endpoint|crm|erp|token)\b/i,
    /\b(get|post|put|patch|delete)\b/i,
    /^(chiama|invoca|esegui|effettua|recupera|aggiorna|elimina|crea)\b/i,
    /^(chiama|invoca|esegue|recupera|aggiorna|elimina|crea)\b/i,
  ],
};


