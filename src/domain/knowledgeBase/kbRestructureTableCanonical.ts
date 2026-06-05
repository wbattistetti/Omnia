/**
 * Canonicalizzazione tabella KB riformattata: intestazioni italiane e celle normalizzate.
 */

import { extractRestructuredDataForRuntime } from './kbDocumentRestructureSplit';
import { parseMarkdownPipeTable, type KbTabularGrid } from './parseKbTabularText';
import { serializeParsedKbTabular } from './kbRestructuredGridMarkdown';
import { isEmptySelectorCellValue, slugifySelectorColumnId } from './kbSelectorSpec';

/** Intestazioni canoniche italiane (snake_case senza accenti). */
export const KB_RESTRUCTURE_CANONICAL_HEADERS = {
  codice: 'codice',
  etichetta: 'etichetta',
  tipo_entita: 'tipo_entita',
  specialita: 'specialita',
  tipo_visita: 'tipo_visita',
  esame_associato: 'esame_associato',
  esame_obbligatorio: 'esame_obbligatorio',
  fascia_eta: 'fascia_eta',
  id_entita: 'id_entita',
  confidenza: 'confidenza',
} as const;

const HEADER_ALIASES: Record<string, keyof typeof KB_RESTRUCTURE_CANONICAL_HEADERS | string> = {
  code: 'codice',
  codice: 'codice',
  label: 'etichetta',
  etichetta: 'etichetta',
  entity_type: 'tipo_entita',
  tipo_entita: 'tipo_entita',
  specialty: 'specialita',
  specialita: 'specialita',
  specialit: 'specialita',
  visit_type: 'tipo_visita',
  tipo_visita: 'tipo_visita',
  tipo_di_visita: 'tipo_visita',
  associated_exam: 'esame_associato',
  esame_associato: 'esame_associato',
  exam_status: 'esame_obbligatorio',
  exam_mandatory: 'esame_obbligatorio',
  esame_obbligatorio: 'esame_obbligatorio',
  age_group: 'fascia_eta',
  fascia_eta: 'fascia_eta',
  entity_id: 'id_entita',
  id_entita: 'id_entita',
  confidence: 'confidenza',
  confidenza: 'confidenza',
};

const VISIT_TYPE_CELL_ALIASES: Record<string, string> = {
  unspecified: 'non_specificato',
  non_specificato: 'non_specificato',
  prima_visita: 'prima_visita',
  first_visit: 'prima_visita',
  controllo: 'controllo',
  checkup: 'controllo',
  check_up: 'controllo',
  unica: 'unica',
  single: 'unica',
};

const EXAM_OBBLIGATORIO_CELL_ALIASES: Record<string, string> = {
  si: 'si',
  yes: 'si',
  mandatory: 'si',
  obbligatorio: 'si',
  no: 'no',
  optional: 'no',
  facoltativo: 'no',
};

function normalizeToken(value: string): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
}

/** Mappa intestazione tabella → nome canonico italiano. */
export function canonicalizeRestructureHeader(header: string): string {
  const slug = slugifySelectorColumnId(header);
  const mapped = HEADER_ALIASES[slug];
  if (mapped) return mapped;
  return slug || header.trim();
}

/** Normalizza valore cella in base alla colonna canonica. */
export function canonicalizeRestructureCell(columnId: string, value: string): string {
  const raw = String(value ?? '').trim();
  const token = normalizeToken(raw);

  if (columnId === 'tipo_visita') {
    const mapped = VISIT_TYPE_CELL_ALIASES[token];
    if (mapped) return mapped;
  }

  if (isEmptySelectorCellValue(raw)) return '-';
  if (token === 'not_applicable' || token === 'non_applicable' || token === 'n_a') return '-';
  if (token === 'unknown' || token === 'sconosciuto') return '-';

  if (columnId === 'tipo_visita') {
    return raw;
  }
  if (columnId === 'esame_obbligatorio') {
    const mapped = EXAM_OBBLIGATORIO_CELL_ALIASES[token];
    if (mapped) return mapped;
    if (isEmptySelectorCellValue(raw)) return '-';
  }
  if (columnId === 'esame_associato' && (token === 'none' || token === 'nessuno')) {
    return 'nessuno';
  }

  return raw;
}

/** True se la griglia usa ancora intestazioni inglesi o celle non normalizzate. */
export function restructureGridNeedsCanonicalization(grid: KbTabularGrid): boolean {
  for (const header of grid.headers) {
    const slug = slugifySelectorColumnId(header);
    const mapped = HEADER_ALIASES[slug];
    if (mapped && mapped !== slug) return true;
    if (canonicalizeRestructureHeader(header) !== String(header ?? '').trim()) return true;
  }
  for (let c = 0; c < grid.headers.length; c += 1) {
    const colId = canonicalizeRestructureHeader(String(grid.headers[c] ?? ''));
    for (const row of grid.rows) {
      const cell = String(row[c] ?? '').trim();
      if (canonicalizeRestructureCell(colId, cell) !== cell) return true;
    }
  }
  return false;
}

/** Applica intestazioni e valori canonici alla griglia. */
export function canonicalizeRestructuredGrid(grid: KbTabularGrid): KbTabularGrid {
  const headers = grid.headers.map((h) => canonicalizeRestructureHeader(String(h ?? '')));
  const rows = grid.rows.map((row) =>
    headers.map((header, colIndex) =>
      canonicalizeRestructureCell(header, String(row[colIndex] ?? ''))
    )
  );
  return { headers, rows };
}

/**
 * Normalizza markdown tabella riformattata (intestazioni IT + celle `-` / enum IT).
 * Ritorna l'input invariato se non parsabile.
 */
export function canonicalizeRestructuredTableMarkdown(markdown: string): string {
  const raw = String(markdown ?? '').trim();
  if (!raw) return raw;

  const { dataMarkdown, notesMarkdown } = (() => {
    const data = extractRestructuredDataForRuntime(raw);
    const notes =
      data !== raw && raw.includes('##')
        ? raw.slice(0, raw.indexOf(data)).trim()
        : '';
    return { dataMarkdown: data, notesMarkdown: notes };
  })();

  const parsed = parseMarkdownPipeTable(dataMarkdown, { maxRows: 500 });
  if (!parsed?.grid) return raw;

  const canonical = canonicalizeRestructuredGrid(parsed.grid);
  if (!restructureGridNeedsCanonicalization(parsed.grid)) return raw;
  const dataOut = serializeParsedKbTabular({
    preamble: parsed.preamble.length > 0 ? parsed.preamble : ['## Dati normalizzati'],
    grid: canonical,
  });

  if (notesMarkdown.trim()) {
    return `${notesMarkdown.trim()}\n\n${dataOut}`;
  }
  return dataOut;
}
