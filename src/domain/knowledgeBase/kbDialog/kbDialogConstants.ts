/**
 * Costanti condivise per dialogo KB deterministico (UC + runtime index).
 */

export const KB_DIALOG_CATEGORY_ACQUISITION = 'cat_kb_acquisizione' as const;
export const KB_DIALOG_CATEGORY_CORRECTION = 'cat_kb_correzione' as const;
export const KB_DIALOG_CATEGORY_COMPLETE = 'cat_kb_complete' as const;

export const KB_DIALOG_RUNTIME_INDEX_SCHEMA_VERSION = 1 as const;

/** Soglia elenco esplicito valori in frase acquisition (regola b). */
export const KB_DIALOG_EXPLICIT_LIST_MAX = 3;

export const DEFAULT_KB_DIALOG_COMPLETE_TEMPLATE =
  'Perfetto, prenoto {tipo_visita_nat} {specialita_nat}{esame_suffix}.';

export const DEFAULT_KB_DIALOG_CORRECTION_TEMPLATE =
  '{trigger_nat} non ammette {incompatible_label} {incompatible_value_nat}; {alternativa_messaggio}';

export const KB_DIALOG_CATEGORIES = [
  {
    id: KB_DIALOG_CATEGORY_ACQUISITION,
    label: 'Acquisizione dati',
    sort_order: 0,
    description:
      'Use case legati ai selettori KB: ogni UC chiede un dato mancante nel binding parziale.',
  },
  {
    id: KB_DIALOG_CATEGORY_CORRECTION,
    label: 'Correzione dati',
    sort_order: 1,
    description:
      'Use case di transizione quando la correzione di uno slot rende incompatibili i dipendenti.',
  },
  {
    id: KB_DIALOG_CATEGORY_COMPLETE,
    label: 'Complete / conferma',
    sort_order: 2,
    description: 'Template parametrico unico per la conferma a binding completo.',
  },
] as const;
