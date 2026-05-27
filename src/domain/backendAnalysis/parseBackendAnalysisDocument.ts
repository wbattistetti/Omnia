/**
 * Parser markdown analisi backend → modello strutturato + PayoffData.
 */

import type {
  BackendAnalysisDocument,
  BackendAnalysisBackendSection,
  BackendAnalysisParameterRow,
  BackendAnalysisPayoffDataV1,
  BackendParameterDirection,
  BackendParameterKind,
} from './backendAnalysisDocumentTypes';
import { PAYOFF_DATA_HEADING } from './renderBackendAnalysisDocument';

const BACKEND_SECTION_RE = /^##\s+Backend:\s*(.+?)(?:\s+\[chip\])?\s*$/im;
const PARAM_TAG_RE = /\[param:([^|\]]+)\|([^\]]+)\]/gi;

function parseKind(raw: string): BackendParameterKind | null {
  const k = raw.replace(/[\[\]]/g, '').trim().toLowerCase();
  if (k === 'required' || k === 'optional' || k === 'derived' || k === 'unused' || k === 'missing') {
    return k;
  }
  return null;
}

function parseDirection(raw: string): BackendParameterDirection {
  const s = raw.toLowerCase();
  if (s.includes('output') || s.includes('←')) return 'output';
  return 'input';
}

function stripCellChips(raw: string): string {
  return raw
    .trim()
    .replace(/^\[|\]$/g, '')
    .replace(/^→\s*/i, '')
    .replace(/^←\s*/i, '')
    .trim();
}

function parseTableRows(tableBody: string): BackendAnalysisParameterRow[] {
  const rows: BackendAnalysisParameterRow[] = [];
  for (const line of tableBody.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|') || /^[\|\s\-:]+$/.test(trimmed)) continue;
    if (/parametro/i.test(trimmed) && /direzione/i.test(trimmed)) continue;
    const cells = trimmed
      .split('|')
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
    if (cells.length < 5) continue;
    const name = stripCellChips(cells[0]);
    if (!name || name === '—') continue;
    rows.push({
      name,
      direction: parseDirection(cells[1]),
      kind: parseKind(cells[2]) ?? 'required',
      role: cells[3] === '—' ? '' : cells[3],
      description: cells[4] === '—' ? '' : cells[4],
    });
  }
  return rows;
}

function parsePayoffJson(block: string): BackendAnalysisPayoffDataV1 | null {
  const trimmed = block.trim();
  if (!trimmed) return null;
  try {
    const data = JSON.parse(trimmed) as BackendAnalysisPayoffDataV1;
    if (data?.version !== 1 || !Array.isArray(data.entries)) return null;
    return {
      version: 1,
      backend: String(data.backend ?? ''),
      entries: data.entries.map((e) => ({
        parameter: String(e.parameter ?? ''),
        payoffSummary: String(e.payoffSummary ?? ''),
        payoffDetail: String(e.payoffDetail ?? ''),
      })),
    };
  } catch {
    return null;
  }
}

function extractPayoffBlock(sectionText: string, backendName: string): BackendAnalysisPayoffDataV1 {
  const idx = sectionText.indexOf(PAYOFF_DATA_HEADING);
  if (idx < 0) {
    return { version: 1, backend: backendName, entries: [] };
  }
  const after = sectionText.slice(idx + PAYOFF_DATA_HEADING.length);
  const jsonMatch = after.match(/```json\s*([\s\S]*?)```/i);
  const parsed = jsonMatch ? parsePayoffJson(jsonMatch[1]) : null;
  return parsed ?? { version: 1, backend: backendName, entries: [] };
}

function extractTableBody(sectionText: string): string {
  const tableStart = sectionText.search(/\|\s*Parametro\s*\|/i);
  if (tableStart < 0) return '';
  const afterTable = sectionText.slice(tableStart);
  const payoffIdx = afterTable.indexOf(PAYOFF_DATA_HEADING);
  return payoffIdx >= 0 ? afterTable.slice(0, payoffIdx) : afterTable;
}

function parseBulletSection(text: string, heading: RegExp): string[] {
  const match = text.match(heading);
  if (!match?.index && match?.index !== 0) return [];
  const start = match.index + match[0].length;
  const rest = text.slice(start);
  const next = rest.search(/\n##\s+/);
  const body = next >= 0 ? rest.slice(0, next) : rest;
  const bullets: string[] = [];
  for (const line of body.split('\n')) {
    const m = line.match(/^-\s+(.+)$/);
    if (!m) continue;
    const t = m[1].trim();
    if (t.startsWith('_') && t.endsWith('_')) continue;
    bullets.push(t);
  }
  return bullets;
}

/**
 * Analizza markdown analisi backend. Restituisce `null` se non riconosciuto.
 */
export function parseBackendAnalysisDocument(markdown: string): BackendAnalysisDocument | null {
  const text = markdown.replace(/\r\n/g, '\n').trim();
  if (!/^#\s+Analisi\s+backend/im.test(text) && !/^#\s+ANALISI\s+BACKEND:/im.test(text)) {
    return null;
  }

  const summary = parseBulletSection(text, /##\s+Sintesi\s*\n/i);
  const generalRules = parseBulletSection(text, /##\s+Regole\s+generali\s*\n/i);
  const systemPromptLines = parseBulletSection(
    text,
    /##\s+System\s+Prompt\s+sintetico\s+per\s+l['']agente\s+virtuale\s*\n/i
  );

  const missingBackends: BackendAnalysisDocument['missingBackends'] = [];
  const missBody = parseBulletSection(text, /##\s+Backend\s+mancanti\s*\n/i);
  for (const line of missBody) {
    const m = line.match(/^(.+?)\s*(?:—|--|-)\s*(.+)$/);
    if (m) missingBackends.push({ name: m[1].trim(), reason: m[2].trim() });
    else if (line.trim()) missingBackends.push({ name: line.trim(), reason: '' });
  }

  const monacoTags: BackendAnalysisDocument['monacoTags'] = [];
  const tagSection = text.match(
    /##\s+Tagging\s+sintetico\s+per\s+Monaco\s*\n([\s\S]*?)(?=\n##\s+|$)/i
  );
  if (tagSection?.[1]) {
    let m: RegExpExecArray | null;
    const re = new RegExp(PARAM_TAG_RE.source, 'gi');
    while ((m = re.exec(tagSection[1])) !== null) {
      const kind = parseKind(m[2]);
      if (kind) monacoTags.push({ name: m[1].trim(), kind });
    }
  }

  const backends: BackendAnalysisBackendSection[] = [];
  const parts = text.split(BACKEND_SECTION_RE);
  for (let i = 1; i < parts.length; i += 2) {
    const name = parts[i]?.trim();
    const body = parts[i + 1] ?? '';
    if (!name) continue;
    const parameters = parseTableRows(extractTableBody(body));
    const payoffData = extractPayoffBlock(body, name);
    backends.push({ name, parameters, payoffData });
  }

  if (backends.length === 0 && summary.length === 0) {
    return null;
  }

  return {
    summary,
    backends,
    generalRules,
    missingBackends,
    monacoTags,
    systemPromptLines,
  };
}

/** Mappa payoff per parametro (chiave `backend::parameter`). */
export function payoffLookupKey(backend: string, parameter: string): string {
  return `${backend.trim().toLowerCase()}::${parameter.trim().toLowerCase()}`;
}

export function buildPayoffLookup(
  doc: BackendAnalysisDocument
): Map<string, { payoffSummary: string; payoffDetail: string }> {
  const map = new Map<string, { payoffSummary: string; payoffDetail: string }>();
  for (const section of doc.backends) {
    for (const entry of section.payoffData.entries) {
      map.set(payoffLookupKey(section.name, entry.parameter), {
        payoffSummary: entry.payoffSummary,
        payoffDetail: entry.payoffDetail,
      });
    }
  }
  return map;
}
