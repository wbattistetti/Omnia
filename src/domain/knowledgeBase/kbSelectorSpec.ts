/**
 * Metadati selettori dialogo per tabella KB riformattata (design time).
 */

import type { KbTabularGrid } from './parseKbTabularText';
import { isPendingColumnHeader } from './kbRestructuredGridEdit';

export const KB_DOCUMENT_SELECTOR_SPEC_SCHEMA_VERSION = 1 as const;

export type SelectorPromptType = 'closed_list' | 'open_question';
export type SelectorColumnRole = 'selector' | 'data';
export type SelectorAskPolicy = 'required' | 'optional';

export type SelectorColumnSpec = {
  columnId: string;
  headerLabel: string;
  role: SelectorColumnRole;
  promptType: SelectorPromptType;
  sortOrder: number;
  /** Etichetta discorsiva mostrata al designer (es. «il tipo di visita»). */
  promptTemplate: string;
  /** Obbligatoria vs da chiedere solo se necessario. */
  askPolicy?: SelectorAskPolicy;
  /** Se nella tabella resta un solo valore distinto dopo filtro, Omnia lo imposta senza chiedere. */
  autoFillSingleValue?: boolean;
};

export type SelectorInvalidationTemplate = {
  id: string;
  template: string;
  approved: boolean;
};

export type KbDocumentSelectorSpec = {
  schemaVersion: typeof KB_DOCUMENT_SELECTOR_SPEC_SCHEMA_VERSION;
  columns: SelectorColumnSpec[];
  invalidationTemplates: SelectorInvalidationTemplate[];
};

const META_COLUMN_IDS = new Set([
  'entity_id',
  'code',
  'codice',
  'id',
  'confidence',
  'entity_type',
  'label',
  'etichetta',
]);

/** Colonne tabella: metadato riga, mai domanda al paziente. */
const NON_ASKABLE_COLUMN_IDS = new Set([
  ...META_COLUMN_IDS,
  'esame_obbligatorio',
  'exam_status',
  'exam_mandatory',
  'age_group',
  'fascia_eta',
  'tipo_entita',
  'id_entita',
  'confidenza',
]);

const EMPTY_CELL_VALUES = new Set([
  '-',
  '—',
  '–',
  'n/a',
  'n.a.',
  'na',
  'non applicabile',
  'non_applicable',
  'not_applicable',
  'not applicable',
  'unknown',
  'sconosciuto',
  'unspecified',
  'non specificato',
]);

const CLOSED_LIST_MAX_DISTINCT = 5;

/** True se la cella non ha valore selezionabile (vuota, trattino, non applicabile, …). */
export function isEmptySelectorCellValue(value: string): boolean {
  const v = String(value ?? '').trim();
  if (!v) return true;
  const norm = v
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return EMPTY_CELL_VALUES.has(norm);
}

function normalizeCell(value: string): string {
  if (isEmptySelectorCellValue(value)) return '';
  return String(value ?? '').trim();
}

function isNonAskableColumn(header: string): boolean {
  return NON_ASKABLE_COLUMN_IDS.has(slugifySelectorColumnId(header));
}

function domainSortPriority(header: string): number {
  const id = slugifySelectorColumnId(header);
  if (id === 'specialita' || id === 'specialty') return 0;
  if (id === 'tipo_visita' || id === 'visit_type') return 10;
  if (id === 'esame_associato' || id === 'associated_exam') return 20;
  return 50;
}

function domainAskPolicy(header: string): SelectorAskPolicy | undefined {
  const id = slugifySelectorColumnId(header);
  if (id === 'specialita' || id === 'specialty') return 'required';
  if (
    id === 'tipo_visita' ||
    id === 'visit_type' ||
    id === 'esame_associato' ||
    id === 'associated_exam'
  ) {
    return 'optional';
  }
  return undefined;
}

type ApplySelectorDomainRulesOptions = {
  /** True dopo riordino manuale designer — non risortare per priorità dominio. */
  preserveSortOrder?: boolean;
};

/** Applica regole dominio: esclusioni, obbligatorietà; ordine solo se non preservato. */
export function applySelectorSpecDomainRules(
  spec: KbDocumentSelectorSpec,
  options?: ApplySelectorDomainRulesOptions
): KbDocumentSelectorSpec {
  const columns = spec.columns.map((col) => {
    if (isNonAskableColumn(col.headerLabel)) {
      return { ...col, role: 'data' as const };
    }
    const policy = domainAskPolicy(col.headerLabel);
    return policy ? { ...col, askPolicy: policy } : col;
  });

  const askable = columns
    .filter((c) => c.role === 'selector' && !c.autoFillSingleValue)
    .sort((a, b) =>
      options?.preserveSortOrder
        ? a.sortOrder - b.sortOrder || a.headerLabel.localeCompare(b.headerLabel, 'it')
        : domainSortPriority(a.headerLabel) - domainSortPriority(b.headerLabel) ||
          a.sortOrder - b.sortOrder ||
          a.headerLabel.localeCompare(b.headerLabel, 'it')
    );

  const orderById = new Map(askable.map((c, i) => [c.columnId, i]));
  const reindexed = columns.map((c) => {
    const order = orderById.get(c.columnId);
    if (order === undefined) return c;
    const policy = domainAskPolicy(c.headerLabel) ?? c.askPolicy ?? (order === 0 ? 'required' : 'optional');
    return { ...c, sortOrder: order, askPolicy: policy };
  });

  return { ...spec, columns: reindexed };
}

/** Id stabile colonna da intestazione tabella. */
export function slugifySelectorColumnId(header: string): string {
  const slug = String(header ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return slug || 'column';
}

export function distinctColumnValues(rows: readonly (readonly string[])[], colIndex: number): string[] {
  const seen = new Set<string>();
  for (const row of rows) {
    const v = normalizeCell(row[colIndex] ?? '');
    if (v) seen.add(v);
  }
  return [...seen].sort((a, b) => a.localeCompare(b, 'it'));
}

function headerIndex(headers: readonly string[], headerLabel: string): number {
  const target = headerLabel.trim().toLowerCase();
  return headers.findIndex((h) => String(h ?? '').trim().toLowerCase() === target);
}

/** Valori distinti colonna dalla griglia (sola lettura in UX). */
export function distinctValuesForSelectorColumn(
  grid: KbTabularGrid | null | undefined,
  headerLabel: string
): string[] {
  if (!grid) return [];
  const idx = headerIndex(grid.headers, headerLabel);
  if (idx < 0) return [];
  return distinctColumnValues(grid.rows, idx);
}

/** Etichetta discorsiva di default da intestazione tabella. */
export function humanizeSelectorAskLabel(header: string): string {
  const raw = String(header ?? '')
    .trim()
    .replace(/_/g, ' ')
    .toLowerCase();
  if (!raw) return 'informazione';
  if (/^(il|la|lo|i|gli|le|un|una)\s/.test(raw)) return raw;
  if (raw.includes('visita')) return 'il tipo di visita';
  if (raw.includes('special')) return 'la specialità';
  if (raw.includes('esame')) return "l'esame associato";
  return `la ${raw}`;
}

export function formatSelectorAskPolicyLabel(policy: SelectorAskPolicy | undefined): string {
  return policy === 'required' ? 'obbligatoria' : 'se necessario';
}

export function formatSelectorValuesPreview(
  values: readonly string[],
  promptType: SelectorPromptType
): string {
  if (promptType === 'open_question' || values.length === 0) return 'domanda libera';
  if (values.length <= 6) return values.join(', ');
  return `${values.slice(0, 5).join(', ')}… (+${values.length - 5})`;
}

function defaultPromptTemplate(header: string, _promptType: SelectorPromptType): string {
  return humanizeSelectorAskLabel(header);
}

function defaultAskPolicy(sortOrder: number): SelectorAskPolicy {
  return sortOrder === 0 ? 'required' : 'optional';
}

function parseSelectorColumn(raw: unknown): SelectorColumnSpec | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const columnId =
    typeof o.columnId === 'string' && o.columnId.trim()
      ? slugifySelectorColumnId(o.columnId)
      : '';
  const headerLabel = typeof o.headerLabel === 'string' ? o.headerLabel.trim() : '';
  if (!columnId || !headerLabel) return null;
  const role: SelectorColumnRole = o.role === 'data' ? 'data' : 'selector';
  const promptType: SelectorPromptType =
    o.promptType === 'open_question' ? 'open_question' : 'closed_list';
  const sortOrder = typeof o.sortOrder === 'number' && Number.isFinite(o.sortOrder) ? o.sortOrder : 0;
  const promptTemplate =
    typeof o.promptTemplate === 'string' ? o.promptTemplate.trim() : '';
  if (role === 'selector' && !promptTemplate) return null;
  const askPolicy: SelectorAskPolicy =
    o.askPolicy === 'required' || o.askPolicy === 'optional'
      ? o.askPolicy
      : defaultAskPolicy(sortOrder);
  return {
    columnId,
    headerLabel,
    role,
    promptType,
    sortOrder,
    promptTemplate: promptTemplate || defaultPromptTemplate(headerLabel, promptType),
    askPolicy,
    ...(o.autoFillSingleValue === true ? { autoFillSingleValue: true } : {}),
  };
}

function parseInvalidationTemplate(raw: unknown): SelectorInvalidationTemplate | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === 'string' && o.id.trim() ? o.id.trim() : '';
  const template = typeof o.template === 'string' ? o.template.trim() : '';
  if (!id || !template) return null;
  return {
    id,
    template,
    approved: o.approved === true,
  };
}

/** Parse JSON persistito o risposta IA. */
export function parseKbDocumentSelectorSpec(raw: unknown): KbDocumentSelectorSpec | null {
  let v: unknown = raw;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      v = JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  }
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const columns: SelectorColumnSpec[] = [];
  for (const c of Array.isArray(o.columns) ? o.columns : []) {
    const parsed = parseSelectorColumn(c);
    if (parsed) columns.push(parsed);
  }
  const invalidationTemplates: SelectorInvalidationTemplate[] = [];
  for (const t of Array.isArray(o.invalidationTemplates) ? o.invalidationTemplates : []) {
    const parsed = parseInvalidationTemplate(t);
    if (parsed) invalidationTemplates.push(parsed);
  }
  if (columns.length === 0) return null;
  return applySelectorSpecDomainRules({
    schemaVersion: KB_DOCUMENT_SELECTOR_SPEC_SCHEMA_VERSION,
    columns: columns.sort((a, b) => a.sortOrder - b.sortOrder || a.headerLabel.localeCompare(b.headerLabel, 'it')),
    invalidationTemplates,
  });
}

export function serializeKbDocumentSelectorSpec(spec: KbDocumentSelectorSpec): string {
  return JSON.stringify(spec);
}

export function emptyKbDocumentSelectorSpec(): KbDocumentSelectorSpec {
  return {
    schemaVersion: KB_DOCUMENT_SELECTOR_SPEC_SCHEMA_VERSION,
    columns: [],
    invalidationTemplates: [],
  };
}

const DEFAULT_INVALIDATION_TEMPLATE: SelectorInvalidationTemplate = {
  id: 'combo_not_available',
  template:
    'Per {colonna} non è disponibile {valore_rifiutato}. {alternativa_suggerita}',
  approved: false,
};

/** Inferisce bozza selettori da griglia tabella (cardinalità colonne). */
export function inferSelectorSpecFromGrid(grid: KbTabularGrid): KbDocumentSelectorSpec {
  const candidates: Array<{
    colIndex: number;
    header: string;
    distinctCount: number;
    promptType: SelectorPromptType;
    autoFill: boolean;
    asData: boolean;
  }> = [];

  for (let i = 0; i < grid.headers.length; i += 1) {
    const header = String(grid.headers[i] ?? '').trim();
    if (!header || isPendingColumnHeader(header)) continue;
    const nonAskable = isNonAskableColumn(header);
    const distinct = distinctColumnValues(grid.rows, i);
    const distinctCount = distinct.length;

    if (nonAskable || distinctCount === 0) {
      if (distinctCount > 0 || nonAskable) {
        candidates.push({
          colIndex: i,
          header,
          distinctCount: Math.max(distinctCount, 1),
          promptType: 'closed_list',
          autoFill: true,
          asData: true,
        });
      }
      continue;
    }

    if (distinctCount === 1) {
      candidates.push({
        colIndex: i,
        header,
        distinctCount,
        promptType: 'closed_list',
        autoFill: true,
        asData: false,
      });
      continue;
    }

    const promptType: SelectorPromptType =
      distinctCount <= CLOSED_LIST_MAX_DISTINCT ? 'closed_list' : 'open_question';
    candidates.push({
      colIndex: i,
      header,
      distinctCount,
      promptType,
      autoFill: false,
      asData: false,
    });
  }

  const askableCandidates = candidates.filter((c) => !c.asData);
  askableCandidates.sort(
    (a, b) =>
      domainSortPriority(a.header) - domainSortPriority(b.header) ||
      a.distinctCount - b.distinctCount ||
      a.colIndex - b.colIndex
  );

  const askOrderByHeader = new Map(askableCandidates.map((c, order) => [c.header.toLowerCase(), order]));

  const columns: SelectorColumnSpec[] = candidates.map((c) => {
    const askOrder = askOrderByHeader.get(c.header.toLowerCase());
    const isAskable = !c.asData && askOrder !== undefined;
    return {
      columnId: slugifySelectorColumnId(c.header),
      headerLabel: c.header,
      role: isAskable ? ('selector' as const) : ('data' as const),
      promptType: c.promptType,
      sortOrder: isAskable ? askOrder! : 999,
      promptTemplate: defaultPromptTemplate(c.header, c.promptType),
      askPolicy: isAskable
        ? (domainAskPolicy(c.header) ?? defaultAskPolicy(askOrder!))
        : undefined,
      ...(c.autoFill ? { autoFillSingleValue: true } : {}),
    };
  });

  return applySelectorSpecDomainRules({
    schemaVersion: KB_DOCUMENT_SELECTOR_SPEC_SCHEMA_VERSION,
    columns,
    invalidationTemplates: [{ ...DEFAULT_INVALIDATION_TEMPLATE }],
  });
}

/** Allinea spec a intestazioni tabella correnti (dopo edit griglia). */
export function mergeSelectorSpecWithGrid(
  spec: KbDocumentSelectorSpec,
  grid: KbTabularGrid
): KbDocumentSelectorSpec {
  const byHeader = new Map(spec.columns.map((c) => [c.headerLabel.toLowerCase(), c]));
  const byId = new Map(spec.columns.map((c) => [c.columnId, c]));
  const columns: SelectorColumnSpec[] = [];

  for (let i = 0; i < grid.headers.length; i += 1) {
    const header = String(grid.headers[i] ?? '').trim();
    if (!header || isPendingColumnHeader(header)) continue;
    const existing =
      byHeader.get(header.toLowerCase()) ??
      byId.get(slugifySelectorColumnId(header));
    if (existing) {
      columns.push({
        ...existing,
        columnId: slugifySelectorColumnId(header),
        headerLabel: header,
      });
    }
  }

  const inferred = inferSelectorSpecFromGrid(grid);
  const seenIds = new Set(columns.map((c) => c.columnId));
  for (const col of inferred.columns) {
    if (!seenIds.has(col.columnId)) {
      columns.push({ ...col, sortOrder: columns.length });
      seenIds.add(col.columnId);
    }
  }

  return applySelectorSpecDomainRules({
    ...spec,
    columns: columns.sort((a, b) => a.sortOrder - b.sortOrder),
  });
}

/** Unisce risposta IA con inferenza locale (colonne mancanti). */
export function mergeSelectorSpecFromAiAndGrid(
  aiSpec: KbDocumentSelectorSpec | null | undefined,
  grid: KbTabularGrid
): KbDocumentSelectorSpec {
  const base = aiSpec ?? inferSelectorSpecFromGrid(grid);
  return applySelectorSpecDomainRules(mergeSelectorSpecWithGrid(base, grid));
}

export type SelectorSpecValidationIssue = {
  code: string;
  message: string;
};

/** Validazione minima prima di approvazione runtime. */
export function validateSelectorSpecForApproval(
  spec: KbDocumentSelectorSpec | null | undefined,
  grid: KbTabularGrid | null
): SelectorSpecValidationIssue[] {
  const issues: SelectorSpecValidationIssue[] = [];
  if (!spec || spec.columns.length === 0) {
    issues.push({
      code: 'missing_spec',
      message: 'Definire almeno una domanda da fare per la tabella.',
    });
    return issues;
  }

  const selectors = listAskableSelectorColumns(spec);
  if (selectors.length === 0) {
    issues.push({
      code: 'no_selectors',
      message: 'Serve almeno una informazione da chiedere.',
    });
  }

  for (const col of selectors) {
    if (!col.promptTemplate.trim()) {
      issues.push({
        code: 'empty_prompt',
        message: `Testo vuoto per «${col.headerLabel}».`,
      });
    }
  }

  if (grid) {
    const headerSet = new Set(
      grid.headers.map((h) => String(h ?? '').trim().toLowerCase()).filter(Boolean)
    );
    for (const col of spec.columns) {
      if (!headerSet.has(col.headerLabel.toLowerCase())) {
        issues.push({
          code: 'orphan_column',
          message: `Domanda «${col.headerLabel}» non corrisponde a nessuna colonna della tabella.`,
        });
      }
    }
  }

  return issues;
}

/** Colonne da mostrare/chiedere a runtime (esclude data e auto-fill). */
export function listAskableSelectorColumns(spec: KbDocumentSelectorSpec): SelectorColumnSpec[] {
  return spec.columns
    .filter((c) => c.role === 'selector' && !c.autoFillSingleValue)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.headerLabel.localeCompare(b.headerLabel, 'it'));
}

function reindexSortOrders(columns: SelectorColumnSpec[]): SelectorColumnSpec[] {
  const askable = listAskableSelectorColumns({ schemaVersion: 1, columns, invalidationTemplates: [] });
  const orderById = new Map(askable.map((c, i) => [c.columnId, i]));
  return columns.map((c) => {
    const nextOrder = orderById.get(c.columnId);
    if (nextOrder === undefined) return c;
    return { ...c, sortOrder: nextOrder };
  });
}

/** Esclude una domanda (colonna resta in spec come dato). */
export function excludeSelectorColumn(
  spec: KbDocumentSelectorSpec,
  columnId: string
): KbDocumentSelectorSpec {
  const columns = spec.columns.map((c) =>
    c.columnId === columnId ? { ...c, role: 'data' as const } : c
  );
  return applySelectorSpecDomainRules(
    { ...spec, columns: reindexSortOrders(columns) },
    { preserveSortOrder: true }
  );
}

/** Sposta su/giù una domanda attiva. */
export function moveSelectorColumn(
  spec: KbDocumentSelectorSpec,
  columnId: string,
  direction: 'up' | 'down'
): KbDocumentSelectorSpec {
  const askable = listAskableSelectorColumns(spec);
  const idx = askable.findIndex((c) => c.columnId === columnId);
  if (idx < 0) return spec;
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= askable.length) return spec;

  const a = askable[idx]!;
  const b = askable[swapIdx]!;
  const columns = spec.columns.map((c) => {
    if (c.columnId === a.columnId) return { ...c, sortOrder: b.sortOrder };
    if (c.columnId === b.columnId) return { ...c, sortOrder: a.sortOrder };
    return c;
  });
  return applySelectorSpecDomainRules(
    { ...spec, columns: reindexSortOrders(columns) },
    { preserveSortOrder: true }
  );
}

export function formatSelectorSpecForRefine(spec: KbDocumentSelectorSpec | null | undefined): string {
  if (!spec || spec.columns.length === 0) return '';
  const lines = listAskableSelectorColumns(spec).map((c) => {
    const values = '';
    const parts = [
      `${c.promptTemplate} (${formatSelectorAskPolicyLabel(c.askPolicy)})`,
      `colonna=${c.headerLabel}`,
      `ordine=${c.sortOrder}`,
      `promptType=${c.promptType}`,
    ];
    return `- ${parts.join(', ')}${values}`;
  });
  const inv = spec.invalidationTemplates
    .filter((t) => t.template.trim())
    .map((t) => `- [${t.id}] ${t.template}${t.approved ? ' (approvato)' : ''}`);
  const blocks = ['Informazioni da chiedere (designer/IA):', ...lines];
  if (inv.length > 0) {
    blocks.push('', 'Template invalidazione:', ...inv);
  }
  return blocks.join('\n');
}
