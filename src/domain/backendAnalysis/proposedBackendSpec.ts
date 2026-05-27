/**
 * Specifiche backend proposti: parametri SEND/RECEIVE con nomi, tipi e descrizioni.
 */

import type {
  BackendParameterDirection,
  BackendParameterKind,
} from './backendAnalysisDocumentV2';

export type ProposedBackendParameterSpec = {
  paramKey: string;
  direction: BackendParameterDirection;
  kind: BackendParameterKind;
  /** Tipo dato OpenAPI-style (string, number, object, object[], …). */
  dataType: string;
  role: string;
  descriptionShort: string;
};

export type ProposedBackendRecord = {
  id: string;
  suggestedName: string;
  purposeMarkdown: string;
  parameters: Record<string, ProposedBackendParameterSpec>;
  /** Export / baseline Monaco (derivato da purpose + parameters). */
  specMarkdown: string;
};

function param(
  paramKey: string,
  direction: BackendParameterDirection,
  kind: BackendParameterKind,
  dataType: string,
  role: string,
  descriptionShort: string
): ProposedBackendParameterSpec {
  return { paramKey, direction, kind, dataType, role, descriptionShort };
}

/** Parametri plausibili per backend mancante (euristica + contesto purpose). */
export function inferProposedParameters(
  suggestedName: string,
  purpose: string
): ProposedBackendParameterSpec[] {
  const text = `${suggestedName} ${purpose}`.toLowerCase();

  if (/knowledge|kb|ricerca|prestazion|search/.test(text)) {
    return [
      param(
        'searchQuery',
        'input',
        'required',
        'string',
        'Testo / filtri ricerca',
        'Query testuale o filtri per cercare prestazioni nella knowledge base del progetto (SEND).'
      ),
      param(
        'prestazioneKey',
        'input',
        'optional',
        'string',
        'Chiave prestazione',
        'Identificativo univoco se già noto dal flow; restringe la ricerca (SEND).'
      ),
      param(
        'maxResults',
        'input',
        'optional',
        'number',
        'Limite risultati',
        'Numero massimo di righe restituite (SEND, opzionale).'
      ),
      param(
        'results',
        'output',
        'required',
        'object[]',
        'Elenco prestazioni',
        'Array strutturato di prestazioni trovate, pronto per variabili del flow (RECEIVE).'
      ),
    ];
  }

  if (/salva|save|persist|store/.test(text)) {
    return [
      param(
        'payload',
        'input',
        'required',
        'object',
        'Dati da persistere',
        'Oggetto con i campi da salvare lato servizio (SEND).'
      ),
      param(
        'serviceId',
        'output',
        'required',
        'string',
        'Id salvato',
        'Identificativo restituito dopo il salvataggio (RECEIVE).'
      ),
    ];
  }

  if (/slot|agenda|prenot/.test(text)) {
    return [
      param(
        'agendaContext',
        'input',
        'required',
        'object',
        'Contesto appuntamento',
        'Parametri di contesto (agenda, tipo, url, conversationId, …) inviati al backend (SEND).'
      ),
      param(
        'slot',
        'output',
        'required',
        'object',
        'Dettaglio slot',
        'Disponibilità o slot selezionato restituito al flow (RECEIVE).'
      ),
    ];
  }

  if (purpose.length > 40) {
    return [
      param(
        'requestBody',
        'input',
        'required',
        'object',
        'Corpo richiesta',
        'Payload SEND allineato al contratto API da definire in catalogo.'
      ),
      param(
        'responseBody',
        'output',
        'required',
        'object',
        'Risposta API',
        'Payload RECEIVE atteso dal flow dopo la chiamata.'
      ),
    ];
  }

  return [];
}

export function parametersRecordFromList(
  list: readonly ProposedBackendParameterSpec[]
): Record<string, ProposedBackendParameterSpec> {
  const out: Record<string, ProposedBackendParameterSpec> = {};
  for (const p of list) {
    out[p.paramKey] = p;
  }
  return out;
}

function directionLabel(direction: BackendParameterDirection): string {
  return direction === 'input' ? '→ input' : '← output';
}

/** Markdown specifica (purpose + tabella interfaccia). */
export function renderProposedBackendSpecMarkdown(
  purposeMarkdown: string,
  parameters: readonly ProposedBackendParameterSpec[]
): string {
  const purpose = purposeMarkdown.trim();
  if (!purpose && parameters.length === 0) return '';

  const lines: string[] = ['## A cosa serve questo backend', '', purpose || '_Da definire_', ''];

  if (parameters.length > 0) {
    lines.push(
      '## Interfaccia proposta',
      '',
      '| Parametro | Direzione | Tipo dato | Obbligo | Ruolo | Descrizione |',
      '| --- | --- | --- | --- | --- | --- |'
    );
    const sorted = [...parameters].sort((a, b) => {
      if (a.direction !== b.direction) return a.direction === 'input' ? -1 : 1;
      return a.paramKey.localeCompare(b.paramKey);
    });
    for (const p of sorted) {
      const oblig = p.kind === 'optional' ? 'optional' : 'required';
      lines.push(
        `| \`${p.paramKey}\` | ${directionLabel(p.direction)} | ${p.dataType} | ${oblig} | ${p.role || '—'} | ${p.descriptionShort || '—'} |`
      );
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

function parseDirection(cell: string): BackendParameterDirection {
  const c = cell.toLowerCase();
  if (c.includes('output') || c.includes('←') || c.includes('receive')) return 'output';
  return 'input';
}

function parseKind(cell: string): BackendParameterKind {
  const c = cell.toLowerCase();
  if (c.includes('optional') || c.includes('opzionale')) return 'optional';
  return 'required';
}

function stripCell(s: string): string {
  return s
    .trim()
    .replace(/^`|`$/g, '')
    .replace(/^\[|\]$/g, '')
    .replace(/^`|`$/g, '')
    .trim();
}

/** Estrae purpose da spec markdown legacy o corrente. */
export function parsePurposeFromSpecMarkdown(specMarkdown: string): string {
  const m = specMarkdown.match(
    /##\s+A cosa serve[^\n]*\n+([\s\S]*?)(?=\n##\s+|\n\| Parametro |\n\| ---|$)/i
  );
  const body = (m?.[1] ?? '').trim();
  if (!body || body === '_Da definire_') return '';
  return body;
}

/** Estrae righe tabella interfaccia da spec markdown. */
export function parseParametersFromSpecMarkdown(
  specMarkdown: string
): ProposedBackendParameterSpec[] {
  const section =
    specMarkdown.match(
      /##\s+(?:Interfaccia proposta|Parametri necessari)[^\n]*\n([\s\S]*?)(?=\n##\s+|$)/i
    )?.[1] ?? specMarkdown;

  const lines = section.split('\n').filter((l) => l.trim().startsWith('|'));
  if (lines.length < 2) return [];

  const out: ProposedBackendParameterSpec[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!;
    if (/^\|\s*---/.test(line)) continue;
    const cells = line.split('|').map(stripCell).filter((_, idx, arr) => {
      if (idx === 0 || idx === arr.length - 1) return false;
      return true;
    });
    if (cells.length < 4) continue;

    const paramKey = cells[0]!.replace(/^\[|\]$/g, '').trim();
    if (!paramKey || paramKey.toLowerCase() === 'parametro') continue;

    if (cells.length >= 6) {
      out.push({
        paramKey,
        direction: parseDirection(cells[1]!),
        dataType: cells[2]! || 'string',
        kind: parseKind(cells[3]!),
        role: cells[4]! === '—' ? '' : cells[4]!,
        descriptionShort: cells[5]! === '—' ? '' : cells[5]!,
      });
    } else {
      out.push({
        paramKey,
        direction: parseDirection(cells[1]!),
        dataType: 'string',
        kind: 'required',
        role: cells[2] === '—' ? '' : (cells[2] ?? ''),
        descriptionShort: cells[3] === '—' ? '' : (cells[3] ?? ''),
      });
    }
  }
  return out;
}

export function syncProposedBackendRecord(record: ProposedBackendRecord): ProposedBackendRecord {
  let purposeMarkdown = record.purposeMarkdown.trim();
  let parameters = { ...record.parameters };

  if (Object.keys(parameters).length === 0 && record.specMarkdown.trim()) {
    purposeMarkdown = purposeMarkdown || parsePurposeFromSpecMarkdown(record.specMarkdown);
    parameters = parametersRecordFromList(
      parseParametersFromSpecMarkdown(record.specMarkdown)
    );
  }

  const specMarkdown = renderProposedBackendSpecMarkdown(
    purposeMarkdown,
    Object.values(parameters)
  );

  return {
    ...record,
    purposeMarkdown,
    parameters,
    specMarkdown,
  };
}

export function proposedBackendHasSubstance(record: ProposedBackendRecord): boolean {
  if (record.purposeMarkdown.trim().length >= 20) return true;
  return Object.values(record.parameters).some(
    (p) => Boolean(p.descriptionShort.trim()) || Boolean(p.role.trim())
  );
}
