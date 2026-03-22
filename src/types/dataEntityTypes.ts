/**
 * Canonical semantic data types for AI Agent proposed variables and alignment with SemanticContract-style entity.type.
 * Used by the AI Agent design-time editor (combobox) and for normalizing LLM output.
 */

export const DATA_ENTITY_TYPES: ReadonlyArray<{ id: string; labelIt: string }> = [
  { id: 'text', labelIt: 'Testo' },
  { id: 'freeform', labelIt: 'Testo libero (lungo)' },
  { id: 'number', labelIt: 'Numero' },
  { id: 'integer', labelIt: 'Numero intero' },
  { id: 'boolean', labelIt: 'Sì / No' },
  { id: 'date', labelIt: 'Data' },
  { id: 'time', labelIt: 'Ora' },
  { id: 'datetime', labelIt: 'Data e ora' },
  { id: 'email', labelIt: 'Email' },
  { id: 'phone', labelIt: 'Telefono' },
  { id: 'address', labelIt: 'Indirizzo' },
  { id: 'postal_code', labelIt: 'CAP / Codice postale' },
  { id: 'url', labelIt: 'URL' },
  { id: 'currency', labelIt: 'Importo / Valuta' },
  { id: 'percent', labelIt: 'Percentuale' },
  { id: 'identifier', labelIt: 'Identificativo (ID)' },
  { id: 'full_name', labelIt: 'Nome completo' },
  { id: 'country', labelIt: 'Paese' },
  { id: 'language', labelIt: 'Lingua' },
];

const ALLOWED_IDS = new Set(DATA_ENTITY_TYPES.map((t) => t.id));

/** Maps LLM / legacy strings to a canonical id. */
const TYPE_ALIASES: Record<string, string> = {
  string: 'text',
  str: 'text',
  int: 'integer',
  double: 'number',
  float: 'number',
  bool: 'boolean',
  mail: 'email',
  e_mail: 'email',
  tel: 'phone',
  mobile: 'phone',
  cap: 'postal_code',
  zip: 'postal_code',
  postcode: 'postal_code',
  money: 'currency',
  euro: 'currency',
  amount: 'currency',
  uri: 'url',
  link: 'url',
  id: 'identifier',
  uuid: 'identifier',
  nome: 'full_name',
  cognome: 'text',
};

/**
 * Returns a canonical entity type id; defaults to "text" if unknown.
 */
export function normalizeEntityType(raw: string | undefined | null): string {
  const s = String(raw ?? '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_');
  if (!s) return 'text';
  if (ALLOWED_IDS.has(s)) return s;
  const viaAlias = TYPE_ALIASES[s];
  if (viaAlias && ALLOWED_IDS.has(viaAlias)) return viaAlias;
  return 'text';
}

export function isKnownEntityType(id: string): boolean {
  return ALLOWED_IDS.has(id);
}
