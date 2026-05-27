/**
 * Costruisce {@link BackendAnalysisDocument} da testo grezzo o normalizza un documento già strutturato.
 */

import { parseBackendAnalysisDocument } from './parseBackendAnalysisDocument';
import { renderBackendAnalysisDocument } from './renderBackendAnalysisDocument';
import type {
  BackendAnalysisDocument,
  BackendAnalysisBackendSection,
  BackendAnalysisParameterRow,
  BackendAnalysisPayoffEntry,
  BackendAnalysisStructureContext,
  BackendParameterDirection,
  BackendParameterKind,
  StructureBackendAnalysisInput,
} from './backendAnalysisDocumentTypes';

const PARAM_KINDS: readonly BackendParameterKind[] = [
  'required',
  'optional',
  'derived',
  'unused',
  'missing',
];

const PARAM_TAG_RE = /\[param:([^|\]]+)\|([^\]]+)\]/gi;
const IDENT_RE = /\b([a-z][a-zA-Z0-9_]{1,48}|[A-Z][a-zA-Z0-9]{1,48})\b/g;

const STOPWORDS = new Set([
  'backend',
  'parametro',
  'parametri',
  'analisi',
  'sintesi',
  'regole',
  'tagging',
  'input',
  'output',
  'required',
  'optional',
]);

type RawParam = {
  name: string;
  backend: string;
  direction: BackendParameterDirection;
  kind: BackendParameterKind;
  role: string;
  description: string;
  notes: string;
};

function normalizeWhitespace(text: string): string {
  return text.replace(/\r\n/g, '\n').trim();
}

function normalizeParamName(raw: string): string {
  return raw
    .trim()
    .replace(/^[`'"\[\]]+|[`'"\[\]]+$/g, '')
    .replace(/\s+/g, '')
    .replace(/^\W+|\W+$/g, '');
}

function isPlausibleParamName(name: string): boolean {
  if (!name || name.length < 2 || name.length > 64) return false;
  if (STOPWORDS.has(name.toLowerCase())) return false;
  if (/^\d+$/.test(name)) return false;
  return /^[a-zA-Z][a-zA-Z0-9_.]*$/.test(name);
}

function parseKind(raw: string | undefined): BackendParameterKind | null {
  const k = String(raw ?? '')
    .replace(/[\[\]]/g, '')
    .trim()
    .toLowerCase();
  return PARAM_KINDS.includes(k as BackendParameterKind) ? (k as BackendParameterKind) : null;
}

function contextSnippet(text: string, needle: string, radius = 220): string {
  const lower = text.toLowerCase();
  const idx = lower.indexOf(needle.toLowerCase());
  if (idx < 0) return '';
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + needle.length + radius);
  return text.slice(start, end);
}

function scoreKindFromContext(snippet: string): BackendParameterKind {
  const s = snippet.toLowerCase();
  if (/mancante|manca |missing|non esiste|servirebbe|assente/.test(s)) return 'missing';
  if (/opzional|facoltativ|optional|alcuni casi/.test(s)) return 'optional';
  if (/derivat|calcolat|computed/.test(s)) return 'derived';
  if (/non usato|unused|non necessario/.test(s)) return 'unused';
  if (/obbligatori|indispensabile|required|necessario/.test(s)) return 'required';
  return 'required';
}

function extractSummaryBullets(text: string): string[] {
  const match = text.match(/##\s+Sintesi\s*\n([\s\S]*?)(?=\n##\s+|$)/i);
  if (!match?.[1]) {
    const legacy = text.match(/##\s+Sintesi\s*\n+((?:-\s+.+\n?)+)/i);
    if (!legacy) return [];
    return legacy[1]
      .split('\n')
      .map((l) => l.replace(/^-\s+/, '').trim())
      .filter(Boolean);
  }
  const bullets: string[] = [];
  for (const line of match[1].split('\n')) {
    const m = line.match(/^-\s+(.+)$/);
    if (m?.[1]?.trim()) bullets.push(m[1].trim());
  }
  return bullets.slice(0, 6);
}

function extractLegacyTableRows(text: string): RawParam[] {
  const out: RawParam[] = [];
  const lines = text.split('\n');
  let inLegacy = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) {
      inLegacy = false;
      continue;
    }
    if (/parametro/i.test(trimmed) && /backend/i.test(trimmed) && !/direzione/i.test(trimmed)) {
      inLegacy = true;
      continue;
    }
    if (!inLegacy || /^[\|\s\-:]+$/.test(trimmed)) continue;
    const cells = trimmed
      .split('|')
      .map((c) => c.trim())
      .filter(Boolean);
    if (cells.length < 2) continue;
    const name = normalizeParamName(cells[0]);
    if (!isPlausibleParamName(name)) continue;
    const backend = cells[1]?.trim() || '';
    const role = cells[2] ?? '';
    const motivation = cells[3] ?? '';
    const rowCtx = `${role} ${motivation}`.toLowerCase();
    const kind = /obbligatori|indispensabile|required|necessario/.test(rowCtx)
      ? 'required'
      : /opzional|facoltativ|optional/.test(rowCtx)
        ? 'optional'
        : /derivat|calcolat|computed/.test(rowCtx)
          ? 'derived'
          : /non\s+usato|unused/.test(rowCtx)
            ? 'unused'
            : scoreKindFromContext(motivation || role);
    out.push({
      name,
      backend,
      direction: /output|←|receive/i.test(role + motivation) ? 'output' : 'input',
      kind,
      role: role || '—',
      description:
        motivation ||
        contextSnippet(text, name).replace(/\s+/g, ' ').trim().slice(0, 120) ||
        '—',
      notes: '',
    });
  }
  return out;
}

function extractModernTableRows(text: string): RawParam[] {
  const out: RawParam[] = [];
  const sections = text.split(/^##\s+Backend:\s*/im).slice(1);
  for (const chunk of sections) {
    const nameLine = chunk.split('\n')[0] ?? '';
    const backendName = nameLine.replace(/\s+\[chip\]\s*$/i, '').trim();
    const tableStart = chunk.search(/\|\s*Parametro\s*\|/i);
    if (tableStart < 0) continue;
    const tablePart = chunk.slice(tableStart);
    const payoffIdx = tablePart.indexOf('### PayoffData');
    const tableBody = payoffIdx >= 0 ? tablePart.slice(0, payoffIdx) : tablePart;
    for (const line of tableBody.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('|') || /^[\|\s\-:]+$/.test(trimmed)) continue;
      if (/parametro/i.test(trimmed) && /direzione/i.test(trimmed)) continue;
      const cells = trimmed
        .split('|')
        .map((c) => c.trim())
        .filter(Boolean);
      if (cells.length < 5) continue;
      const name = normalizeParamName(cells[0]);
      if (!isPlausibleParamName(name)) continue;
      const dir = /output|←/i.test(cells[1]) ? 'output' : 'input';
      out.push({
        name,
        backend: backendName,
        direction: dir,
        kind: parseKind(cells[2]) ?? scoreKindFromContext(contextSnippet(text, name)),
        role: cells[3] === '—' ? '' : cells[3],
        description: cells[4] === '—' ? '' : cells[4],
        notes: '',
      });
    }
  }
  return out;
}

function extractParamTags(text: string): Array<{ name: string; kind: BackendParameterKind }> {
  const out: Array<{ name: string; kind: BackendParameterKind }> = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(PARAM_TAG_RE.source, 'gi');
  while ((m = re.exec(text)) !== null) {
    const name = normalizeParamName(m[1]);
    const kind = parseKind(m[2]);
    if (isPlausibleParamName(name) && kind) out.push({ name, kind });
  }
  return out;
}

function extractMissingBackends(
  text: string,
  knownLabels: Set<string>
): BackendAnalysisDocument['missingBackends'] {
  const out: BackendAnalysisDocument['missingBackends'] = [];
  const section = text.match(/##\s+Backend\s+mancanti\s*\n([\s\S]*?)(?=\n##\s+|$)/i);
  const body = section?.[1] ?? text;
  const patterns = [
    /manca(?:\s+il)?\s+backend\s+([A-Za-z][A-Za-z0-9_]*)/gi,
    /servirebbe\s+(?:un\s+)?backend\s+([A-Za-z][A-Za-z0-9_]*)/gi,
  ];
  const seen = new Set<string>();
  for (const line of body.split('\n')) {
    const m = line.match(/^-\s*(.+?)\s*(?:—|--|-)\s*(.+)$/);
    if (m) {
      out.push({ name: m[1].trim(), reason: m[2].trim() });
      seen.add(m[1].trim().toLowerCase());
    }
  }
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const name = m[1].trim();
      if (!name || seen.has(name.toLowerCase()) || knownLabels.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      out.push({
        name,
        reason: contextSnippet(text, name).replace(/\s+/g, ' ').trim().slice(0, 160),
      });
    }
  }
  return out;
}

function buildGeneralRules(
  text: string,
  missing: BackendAnalysisDocument['missingBackends']
): string[] {
  const rules: string[] = [];
  const lower = text.toLowerCase();
  if (/esami\s+associat/i.test(lower)) {
    rules.push(
      'KB con esami associati → variabili dedicate per ogni esame collegato alla prestazione.'
    );
  }
  if (
    /esami\s+associat/i.test(lower) &&
    (/non\s+distingue/i.test(lower) || (!/obbligatori/i.test(lower) && !/opzionali/i.test(lower)))
  ) {
    rules.push('KB senza distinzione obbligatori/opzionali → richiedere specifica al business.');
  }
  for (const mb of missing) {
    rules.push(`Backend mancante «${mb.name}»: ${mb.reason || 'necessario al flusso.'}`);
  }
  const parsed = text.match(/##\s+Regole\s+generali\s*\n([\s\S]*?)(?=\n##\s+|$)/i);
  if (parsed?.[1]) {
    for (const line of parsed[1].split('\n')) {
      const m = line.match(/^-\s+(.+)$/);
      if (m?.[1]?.trim() && !m[1].startsWith('_')) rules.push(m[1].trim());
    }
  }
  return [...new Set(rules)];
}

function buildPayoffEntry(row: RawParam, text: string): BackendAnalysisPayoffEntry {
  const summary =
    row.description && row.description !== '—'
      ? row.description.slice(0, 120)
      : row.role && row.role !== '—'
        ? row.role.slice(0, 100)
        : row.name;
  const detailParts = [
    row.description && row.description !== '—' ? row.description : '',
    row.role && row.role !== '—' && row.role !== row.description ? `Ruolo: ${row.role}` : '',
    row.notes,
  ].filter(Boolean);
  return {
    parameter: row.name,
    payoffSummary: summary,
    payoffDetail: detailParts.join('\n\n') || summary,
  };
}

function buildSystemPromptLines(doc: BackendAnalysisDocument): string[] {
  const lines: string[] = [];
  for (const section of doc.backends) {
    const ins = section.parameters.filter((p) => p.direction === 'input' && p.kind !== 'unused');
    const outs = section.parameters.filter((p) => p.direction === 'output');
    if (ins.length) {
      lines.push(
        `${section.name}: SEND ${ins.map((p) => p.name).join(', ')} (${ins.map((p) => p.kind).join('/')}).`
      );
    }
    if (outs.length) {
      lines.push(`${section.name}: RECEIVE ${outs.map((p) => p.name).join(', ')}.`);
    }
  }
  for (const mb of doc.missingBackends) {
    lines.push(`Integrare backend mancante: ${mb.name}.`);
  }
  if (doc.generalRules.length) {
    lines.push(doc.generalRules[0].slice(0, 120));
  }
  return lines.slice(0, 12);
}

function resolveBackendLabel(
  raw: string,
  context?: BackendAnalysisStructureContext
): string {
  const t = raw.trim();
  if (!t && context?.knownBackends.length === 1) {
    return context.knownBackends[0].label;
  }
  if (!t) return 'Backend';
  const hit = context?.knownBackends.find(
    (b) => b.label.toLowerCase() === t.toLowerCase()
  );
  return hit?.label ?? t;
}

function groupRawParams(
  rawParams: RawParam[],
  context?: BackendAnalysisStructureContext
): Map<string, RawParam[]> {
  const byBackend = new Map<string, RawParam[]>();
  const knownByParam = new Map<string, string>();
  for (const kp of context?.knownParameters ?? []) {
    knownByParam.set(kp.name.toLowerCase(), kp.backendLabel);
  }

  for (const row of rawParams) {
    const backend = resolveBackendLabel(
      row.backend || knownByParam.get(row.name.toLowerCase()) || '',
      context
    );
    const list = byBackend.get(backend) ?? [];
    const existing = list.find((p) => p.name.toLowerCase() === row.name.toLowerCase());
    if (!existing) list.push(row);
    else if (row.description.length > existing.description.length) {
      Object.assign(existing, row);
    }
    byBackend.set(backend, list);
  }

  if (byBackend.size === 0 && context?.knownBackends.length) {
    for (const b of context.knownBackends) {
      byBackend.set(b.label, []);
    }
  }

  return byBackend;
}

function collectRawParams(
  text: string,
  context?: BackendAnalysisStructureContext,
  ambiguities: string[] = []
): RawParam[] {
  const modern = extractModernTableRows(text);
  if (modern.length) return modern;

  const legacy = extractLegacyTableRows(text);
  const raw = [...legacy];
  const knownNames = new Set(
    (context?.knownParameters ?? []).map((p) => p.name.toLowerCase())
  );

  for (const kp of context?.knownParameters ?? []) {
    if (!text.toLowerCase().includes(kp.name.toLowerCase())) continue;
    if (raw.some((r) => r.name.toLowerCase() === kp.name.toLowerCase())) continue;
    raw.push({
      name: kp.name,
      backend: kp.backendLabel,
      direction: kp.direction,
      kind: scoreKindFromContext(contextSnippet(text, kp.name)),
      role: kp.direction === 'input' ? 'Input API' : 'Output API',
      description: `Parametro ${kp.direction} da catalogo.`,
      notes: '',
    });
  }

  if (raw.length === 0 && knownNames.size === 0) {
    let m: RegExpExecArray | null;
    const re = new RegExp(IDENT_RE.source, 'g');
    while ((m = re.exec(text)) !== null) {
      const name = normalizeParamName(m[1]);
      if (!isPlausibleParamName(name)) continue;
      raw.push({
        name,
        backend: '',
        direction: 'input',
        kind: scoreKindFromContext(contextSnippet(text, name)),
        role: '—',
        description: '—',
        notes: 'Dedotto dal testo — verificare.',
      });
    }
    if (raw.length) {
      ambiguities.push('Parametri dedotti senza catalogo — possibili falsi positivi.');
    }
  }

  return raw;
}

export function buildBackendAnalysisDocument(
  input: StructureBackendAnalysisInput
): { document: BackendAnalysisDocument; ambiguities: string[] } {
  const text = normalizeWhitespace(input.rawText);
  const ambiguities: string[] = [];

  if (!text) {
    return {
      document: {
        summary: ['Testo sorgente vuoto.'],
        backends: [],
        generalRules: [],
        missingBackends: [],
        monacoTags: [],
        systemPromptLines: [],
      },
      ambiguities: ['Testo sorgente vuoto.'],
    };
  }

  const parsed = parseBackendAnalysisDocument(text);
  if (parsed?.backends.length) {
    return { document: parsed, ambiguities };
  }

  const summary =
    extractSummaryBullets(text).length > 0
      ? extractSummaryBullets(text)
      : input.title
        ? [input.title.trim()]
        : ['Analisi uso backend agente.'];

  const rawParams = collectRawParams(text, input.context, ambiguities);
  const byBackend = groupRawParams(rawParams, input.context);

  const backends: BackendAnalysisBackendSection[] = [];
  for (const [backendName, params] of byBackend) {
    const parameters: BackendAnalysisParameterRow[] = params.map((p) => ({
      name: p.name,
      direction: p.direction,
      kind: p.kind,
      role: p.role || '—',
      description: p.description || '—',
    }));
    const entries = params.map((p) => buildPayoffEntry(p, text));
    backends.push({
      name: backendName,
      parameters,
      payoffData: { version: 1, backend: backendName, entries },
    });
  }

  const knownLabels = new Set(
    (input.context?.knownBackends ?? []).map((b) => b.label.toLowerCase())
  );
  const missingBackends = extractMissingBackends(text, knownLabels);
  const generalRules = buildGeneralRules(text, missingBackends);
  const tags =
    extractParamTags(text).length > 0
      ? extractParamTags(text)
      : backends.flatMap((b) =>
          b.parameters.map((p) => ({ name: p.name, kind: p.kind }))
        );

  const document: BackendAnalysisDocument = {
    summary,
    backends,
    generalRules,
    missingBackends,
    monacoTags: tags,
    systemPromptLines: [],
  };
  document.systemPromptLines = buildSystemPromptLines(document);

  return { document, ambiguities };
}

/** Costruisce e serializza in un unico passaggio. */
export function buildBackendAnalysisMarkdown(
  input: StructureBackendAnalysisInput
): { document: BackendAnalysisDocument; markdown: string; ambiguities: string[] } {
  const { document, ambiguities } = buildBackendAnalysisDocument(input);
  return {
    document,
    markdown: renderBackendAnalysisDocument(document),
    ambiguities,
  };
}
