/**
 * Carica tabella KB approvata e selectorSpec dal task agente (persist Omnia).
 */

'use strict';

const { parseKbPipeTable } = require('./parseKbPipeTable');

const MIN_USABLE_RESTRUCTURE_CHARS = 80;

function extractDataMarkdown(stored) {
  const raw = String(stored ?? '').trim();
  if (!raw) return '';
  const marker = /^##\s+Dati normalizzati\s*$/im;
  const match = marker.exec(raw);
  if (match && typeof match.index === 'number') {
    return raw.slice(match.index).trim();
  }
  if (raw.startsWith('|')) return raw;
  return raw;
}

function hasUsableRestructure(doc) {
  const text = String(doc.documentRestructuredMarkdown ?? '').trim();
  if (text.length < MIN_USABLE_RESTRUCTURE_CHARS) return false;
  if (/(da definire\)|_Nessuna sintesi)/i.test(text) && text.length < 120) return false;
  return true;
}

function parseKbDocumentsJson(raw) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseSelectorSpec(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const columns = Array.isArray(raw.columns) ? raw.columns : [];
  const invalidationTemplates = Array.isArray(raw.invalidationTemplates)
    ? raw.invalidationTemplates
    : [];
  if (columns.length === 0) return null;
  return {
    schemaVersion: raw.schemaVersion === 1 ? 1 : 1,
    columns,
    invalidationTemplates,
  };
}

/**
 * @param {object} agentTask
 * @param {string} [preferredDocId]
 */
function loadKbDialogRuntime(agentTask, preferredDocId) {
  const docs = parseKbDocumentsJson(agentTask?.agentKnowledgeBaseDocumentsJson);
  const eligible = docs.filter(
    (d) =>
      d &&
      d.documentRestructuredApprovedForRuntime === true &&
      hasUsableRestructure(d) &&
      d.documentSelectorSpec &&
      Array.isArray(d.documentSelectorSpec.columns) &&
      d.documentSelectorSpec.columns.length > 0
  );

  if (eligible.length === 0) {
    return { error: 'no_approved_kb_dialog_config' };
  }

  const pid = String(preferredDocId ?? '').trim();
  const doc = pid ? eligible.find((d) => d.id === pid) ?? eligible[0] : eligible[0];

  const dataMd = extractDataMarkdown(doc.documentRestructuredMarkdown);
  const parsed = parseKbPipeTable(dataMd);
  if (!parsed || parsed.headers.length === 0) {
    return { error: 'kb_table_parse_failed', documentId: doc.id };
  }

  const selectorSpec = parseSelectorSpec(doc.documentSelectorSpec);
  if (!selectorSpec) {
    return { error: 'kb_selector_spec_invalid', documentId: doc.id };
  }

  return {
    documentId: doc.id,
    documentName: doc.name,
    grid: { headers: parsed.headers, rows: parsed.rows },
    selectorSpec,
  };
}

module.exports = {
  loadKbDialogRuntime,
  parseKbDocumentsJson,
  extractDataMarkdown,
};
