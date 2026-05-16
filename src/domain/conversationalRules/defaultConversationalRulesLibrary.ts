/**
 * Default conversational rules library — shared seed for new AI Agent tasks.
 */

import type { ConversationalRuleLibraryEntry } from './types';

export const DEFAULT_CONVERSATIONAL_RULES_LIBRARY: readonly ConversationalRuleLibraryEntry[] = [
  {
    id: 'lib-dati-mancanti',
    label: 'Dati mancanti',
    scenario:
      "Quando l'utente non fornisce tutte le informazioni necessarie, il sistema deve chiedere solo la parte mancante, senza ripetere ciò che è già stato raccolto.",
    exampleMessage:
      'Per completare la richiesta mi serve ancora [dato mancante]; il resto l\'ho già registrato.',
    sort_order: 0,
  },
  {
    id: 'lib-dati-da-confermare',
    label: 'Dati da confermare',
    scenario:
      "Dopo aver raccolto i dati, il sistema deve confermarli in modo colloquiale e naturale, così l'utente percepisce che l'informazione è stata compresa correttamente.",
    exampleMessage:
      'Quindi [riepilogo dati], è corretto?',
    sort_order: 1,
  },
  {
    id: 'lib-utente-corregge',
    label: 'Utente corregge',
    scenario:
      "Se l'utente modifica o corregge un dato già fornito, il sistema deve aggiornare l'informazione e confermare nuovamente la versione corretta.",
    exampleMessage:
      'Ho aggiornato [dato]; conferma che ora è corretto.',
    sort_order: 2,
  },
  {
    id: 'lib-dati-da-validare',
    label: 'Dati da validare',
    scenario:
      "Se il formato dei dati inseriti dall'utente non è standard o appare ambiguo, il sistema deve chiedere conferma senza bloccare il flusso della conversazione.",
    exampleMessage:
      'Ho capito [valore]; è questo che intendeva?',
    sort_order: 3,
  },
  {
    id: 'lib-frase-non-chiara',
    label: 'Frase utente non chiara',
    scenario:
      "Se l'input dell'utente non è comprensibile, il sistema deve chiedere un chiarimento con tono naturale e non rigido.",
    exampleMessage:
      'Non sono sicuro di aver capito; può spiegarmi meglio?',
    sort_order: 4,
  },
] as const;
