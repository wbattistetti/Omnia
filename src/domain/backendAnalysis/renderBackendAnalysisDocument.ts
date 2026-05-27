/**
 * Serializza {@link BackendAnalysisDocument} in markdown standard Omnia.
 */

import type {
  BackendAnalysisDocument,
  BackendAnalysisPayoffDataV1,
  BackendParameterKind,
} from './backendAnalysisDocumentTypes';

const PAYOFF_DATA_HEADING = '### PayoffData (per la UI)';

function paramChip(name: string): string {
  return `[${name}]`;
}

function directionChip(direction: 'input' | 'output'): string {
  return direction === 'input' ? '[→ input]' : '[← output]';
}

function kindChip(kind: BackendParameterKind): string {
  return `[${kind}]`;
}

function renderPayoffDataBlock(data: BackendAnalysisPayoffDataV1): string[] {
  const lines: string[] = [PAYOFF_DATA_HEADING, '', '```json', JSON.stringify(data, null, 2), '```', ''];
  return lines;
}

function renderBackendSection(
  backendName: string,
  parameters: BackendAnalysisDocument['backends'][0]['parameters'],
  payoffData: BackendAnalysisPayoffDataV1
): string[] {
  const lines: string[] = [
    `## Backend: ${backendName} [chip]`,
    '',
    '| Parametro | Direzione | Tipo | Ruolo | Descrizione |',
    '| --- | --- | --- | --- | --- |',
  ];
  for (const row of parameters) {
    lines.push(
      `| ${paramChip(row.name)} | ${directionChip(row.direction)} | ${kindChip(row.kind)} | ${row.role || '—'} | ${row.description || '—'} |`
    );
  }
  lines.push('', ...renderPayoffDataBlock(payoffData));
  return lines;
}

/** Markdown leggibile + PayoffData per la UI. */
export function renderBackendAnalysisDocument(doc: BackendAnalysisDocument): string {
  const lines: string[] = ['# Analisi backend', '', '## Sintesi', ''];

  if (doc.summary.length === 0) {
    lines.push('- _Nessuna sintesi disponibile._', '');
  } else {
    for (const bullet of doc.summary) {
      lines.push(`- ${bullet}`);
    }
    lines.push('');
  }

  for (const section of doc.backends) {
    lines.push(...renderBackendSection(section.name, section.parameters, section.payoffData));
  }

  lines.push('## Regole generali', '');
  if (doc.generalRules.length === 0) {
    lines.push('- _Nessuna regola dedotta._', '');
  } else {
    for (const rule of doc.generalRules) {
      lines.push(`- ${rule}`);
    }
    lines.push('');
  }

  lines.push('## Backend mancanti', '');
  if (doc.missingBackends.length === 0) {
    lines.push('- _Nessun backend mancante indicato._', '');
  } else {
    for (const mb of doc.missingBackends) {
      lines.push(`- ${mb.name} — ${mb.reason}`);
    }
    lines.push('');
  }

  lines.push('## Tagging sintetico per Monaco', '');
  if (doc.monacoTags.length === 0) {
    lines.push('_Nessun tag param._', '');
  } else {
    for (const tag of doc.monacoTags) {
      lines.push(`[param:${tag.name}|${tag.kind}]`);
    }
    lines.push('');
  }

  lines.push('## System Prompt sintetico per l\'agente virtuale', '');
  if (doc.systemPromptLines.length === 0) {
    lines.push('- _Definire istruzioni operative dopo l\'analisi._', '');
  } else {
    for (const line of doc.systemPromptLines) {
      lines.push(`- ${line}`);
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd() + '\n';
}

export { PAYOFF_DATA_HEADING };
