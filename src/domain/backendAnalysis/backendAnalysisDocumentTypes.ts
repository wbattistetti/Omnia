/**
 * Modello documento analisi backend (markdown + PayoffData per UI).
 */

export type BackendParameterKind =
  | 'required'
  | 'optional'
  | 'derived'
  | 'unused'
  | 'missing';

export type BackendParameterDirection = 'input' | 'output';

/** Riga tabella parametri per un backend. */
export type BackendAnalysisParameterRow = {
  name: string;
  direction: BackendParameterDirection;
  kind: BackendParameterKind;
  role: string;
  description: string;
};

/** Payoff per cerchiolino «A» e pannello espandibile (solo dati, non UI). */
export type BackendAnalysisPayoffEntry = {
  parameter: string;
  /** Testo breve (badge / anteprima). */
  payoffSummary: string;
  /** Corpo espandibile sotto la riga. */
  payoffDetail: string;
};

export type BackendAnalysisPayoffDataV1 = {
  version: 1;
  backend: string;
  entries: BackendAnalysisPayoffEntry[];
};

export type BackendAnalysisBackendSection = {
  name: string;
  parameters: BackendAnalysisParameterRow[];
  payoffData: BackendAnalysisPayoffDataV1;
};

export type BackendAnalysisMissingBackend = {
  name: string;
  reason: string;
};

/** Documento analisi completo (sorgente di verità oltre al markdown). */
export type BackendAnalysisDocument = {
  summary: string[];
  backends: BackendAnalysisBackendSection[];
  generalRules: string[];
  missingBackends: BackendAnalysisMissingBackend[];
  monacoTags: Array<{ name: string; kind: BackendParameterKind }>;
  systemPromptLines: string[];
};

export type BackendAnalysisStructureContext = {
  knownBackends: readonly { id: string; label: string }[];
  knownParameters: readonly {
    name: string;
    backendLabel: string;
    direction: 'input' | 'output';
  }[];
};

export type StructureBackendAnalysisInput = {
  rawText: string;
  context?: BackendAnalysisStructureContext;
  title?: string;
};

export type StructuredBackendAnalysisResult = {
  document: BackendAnalysisDocument;
  markdown: string;
  ambiguities: string[];
};
