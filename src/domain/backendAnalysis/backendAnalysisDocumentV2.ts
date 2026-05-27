/**

 * Modello analisi backend V2 — fonte di verità strutturata (non markdown).

 */



import {
  parseParametersFromSpecMarkdown,
  parsePurposeFromSpecMarkdown,
  syncProposedBackendRecord,
  type ProposedBackendRecord,
} from './proposedBackendSpec';



export type BackendParameterKind =

  | 'required'

  | 'optional'

  | 'derived'

  | 'unused'

  | 'missing';



export type BackendParameterDirection = 'input' | 'output';



/** Analisi di un parametro (chiave dot-notation, es. agenda.type). */

export type BackendParameterAnalysisRecord = {

  paramKey: string;

  direction: BackendParameterDirection;

  kind: BackendParameterKind;

  role: string;

  descriptionShort: string;

  analysisDetailMarkdown: string;

  analysisSummary: string;

};



export type BackendAnalysisBackendRecord = {

  catalogEntryId: string;

  displayLabel: string;

  /** Come usare (o non usare) questo backend nel task. */

  howToUseMarkdown: string;

  parameters: Record<string, BackendParameterAnalysisRecord>;

};



export type BackendAnalysisDocumentV2 = {

  schemaVersion: 2;

  global: {

    /** Backend suggeriti non ancora in catalogo. */

    proposedBackends: ProposedBackendRecord[];

    /** System prompt sintetico per l'agente runtime (o messaggio incompleto). */

    agentSystemPromptMarkdown: string;

  };

  backends: Record<string, BackendAnalysisBackendRecord>;

};



export function createEmptyBackendAnalysisDocumentV2(): BackendAnalysisDocumentV2 {

  return {

    schemaVersion: 2,

    global: {

      proposedBackends: [],

      agentSystemPromptMarkdown: '',

    },

    backends: {},

  };

}



export function normalizeBackendAnalysisDocumentV2(raw: unknown): BackendAnalysisDocumentV2 {

  if (!raw || typeof raw !== 'object') return createEmptyBackendAnalysisDocumentV2();

  const r = raw as Record<string, unknown>;

  if (r.schemaVersion !== 2) return createEmptyBackendAnalysisDocumentV2();



  const globalRaw = (r.global as Record<string, unknown>) ?? {};

  const backendsRaw = (r.backends as Record<string, unknown>) ?? {};

  const backends: Record<string, BackendAnalysisBackendRecord> = {};



  for (const [id, bRaw] of Object.entries(backendsRaw)) {

    if (!bRaw || typeof bRaw !== 'object') continue;

    const b = bRaw as Record<string, unknown>;

    const paramsRaw = (b.parameters as Record<string, unknown>) ?? {};

    const parameters: Record<string, BackendParameterAnalysisRecord> = {};

    for (const [pk, pRaw] of Object.entries(paramsRaw)) {

      if (!pRaw || typeof pRaw !== 'object') continue;

      const p = pRaw as Record<string, unknown>;

      const paramKey = String(p.paramKey ?? pk).trim();

      if (!paramKey) continue;

      parameters[paramKey] = {

        paramKey,

        direction: p.direction === 'output' ? 'output' : 'input',

        kind: parseKind(p.kind),

        role: String(p.role ?? ''),

        descriptionShort: String(p.descriptionShort ?? ''),

        analysisDetailMarkdown: String(p.analysisDetailMarkdown ?? ''),

        analysisSummary: String(p.analysisSummary ?? ''),

      };

    }

    const howToUse =

      String(b.howToUseMarkdown ?? '').trim() ||

      String(b.generalNotesMarkdown ?? '').trim();

    backends[id] = {

      catalogEntryId: String(b.catalogEntryId ?? id),

      displayLabel: String(b.displayLabel ?? id),

      howToUseMarkdown: howToUse,

      parameters,

    };

  }



  const proposedRaw = globalRaw.proposedBackends;

  let proposedBackends: ProposedBackendRecord[] = [];

  if (Array.isArray(proposedRaw)) {

    proposedBackends = proposedRaw

      .map((item, index) => {

        if (!item || typeof item !== 'object') return null;

        const o = item as Record<string, unknown>;

        const suggestedName = String(o.suggestedName ?? o.name ?? '').trim();

        if (!suggestedName) return null;

        const specMarkdown = String(o.specMarkdown ?? '');
        const purposeMarkdown =
          String(o.purposeMarkdown ?? '').trim() ||
          parsePurposeFromSpecMarkdown(specMarkdown);
        const paramsRaw = o.parameters;
        let parameters: ProposedBackendRecord['parameters'] = {};
        if (paramsRaw && typeof paramsRaw === 'object') {
          for (const [pk, pr] of Object.entries(paramsRaw as Record<string, unknown>)) {
            if (!pr || typeof pr !== 'object') continue;
            const p = pr as Record<string, unknown>;
            const paramKey = String(p.paramKey ?? pk).trim();
            if (!paramKey) continue;
            parameters[paramKey] = {
              paramKey,
              direction: p.direction === 'output' ? 'output' : 'input',
              kind: parseKind(p.kind),
              dataType: String(p.dataType ?? 'string'),
              role: String(p.role ?? ''),
              descriptionShort: String(p.descriptionShort ?? ''),
            };
          }
        } else if (specMarkdown.trim()) {
          const parsed = parseParametersFromSpecMarkdown(specMarkdown);
          for (const p of parsed) parameters[p.paramKey] = p;
        }
        return syncProposedBackendRecord({
          id: String(o.id ?? `proposed_${index}`).trim(),
          suggestedName,
          purposeMarkdown,
          parameters,
          specMarkdown,
        });

      })

      .filter((x): x is ProposedBackendRecord => x !== null);

  }



  const doc: BackendAnalysisDocumentV2 = {

    schemaVersion: 2,

    global: {

      proposedBackends,

      agentSystemPromptMarkdown: String(globalRaw.agentSystemPromptMarkdown ?? ''),

    },

    backends,

  };



  return doc;

}



function parseKind(v: unknown): BackendParameterKind {

  const k = String(v ?? '').toLowerCase();

  if (k === 'optional' || k === 'derived' || k === 'unused' || k === 'missing') return k;

  return 'required';

}


