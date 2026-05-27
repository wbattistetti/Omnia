/**
 * Sintesi analisi documento KB per contesto use case / runtime (no dump tabelle intere).
 */

const MAX_MAPPING_TABLE_ROWS = 5;

/** True se esiste un'analisi utilizzabile (concordata o almeno proposta). */
export function kbDocumentHasUsableAnalysis(doc: {
  documentAnalysisMarkdown?: string;
  agentAnalysisBaselineMarkdown?: string;
}): boolean {
  const analysis = String(doc.documentAnalysisMarkdown ?? '').trim();
  const baseline = String(doc.agentAnalysisBaselineMarkdown ?? '').trim();
  if (!analysis) return false;
  if (/(da definire\)|_Nessuna sintesi)/i.test(analysis) && analysis.length < 120) {
    return false;
  }
  if (baseline && analysis.length >= 24) return true;
  return analysis.length >= 80;
}

/**
 * Riduce mapping tabellari; mantiene sezioni operative (regole, sinonimi, domande, output).
 */
export function distillKbDocumentAnalysisForRuntime(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const out: string[] = [];
  let inMappingSection = false;
  let tableDataRows = 0;

  const flushMappingNote = () => {
    if (tableDataRows > MAX_MAPPING_TABLE_ROWS) {
      out.push('', '_…altre righe nel documento KB originale._', '');
    }
    tableDataRows = 0;
    inMappingSection = false;
  };

  for (const line of lines) {
    if (/^###\s+(Schema mapping|Value\s*→\s*Code)/i.test(line)) {
      flushMappingNote();
      inMappingSection = true;
      out.push(line, '', '_Esempio (dettaglio nel file KB):_', '');
      continue;
    }

    if (inMappingSection) {
      if (/^###\s+/.test(line)) {
        flushMappingNote();
        out.push(line);
        continue;
      }
      if (line.trim().startsWith('|')) {
        if (/^\|\s*---/.test(line)) {
          out.push(line);
          continue;
        }
        if (tableDataRows < MAX_MAPPING_TABLE_ROWS) {
          out.push(line);
          tableDataRows++;
        }
        continue;
      }
      if (!line.trim()) continue;
      flushMappingNote();
      out.push(line);
      continue;
    }

    out.push(line);
  }

  flushMappingNote();
  return out.join('\n').trim();
}
