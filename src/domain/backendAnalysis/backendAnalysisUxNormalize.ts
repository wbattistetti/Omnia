/**
 * Normalizza documento V2 al layout UX corrente (per-backend, proposed, system prompt).
 */

import type { BackendAnalysisDocumentV2 } from './backendAnalysisDocumentV2';
import { bulletsToMarkdown } from './backendAnalysisSectionMarkdown';
import {
  isPlaceholderProposedSpec,
  proposedBackendsFromAnalysisMissing,
} from './proposedBackendFromAnalysis';
import {
  proposedBackendHasSubstance,
  syncProposedBackendRecord,
  type ProposedBackendRecord,
} from './proposedBackendSpec';

export type { ProposedBackendRecord } from './proposedBackendSpec';

/** Testo default se mancano backend nel catalogo. */
export function defaultIncompleteAgentSystemPrompt(
  proposed: readonly ProposedBackendRecord[]
): string {
  if (proposed.length === 0) {
    return 'System prompt non completabile: mancano backend necessari per questo task. Completare le specifiche «Backend da aggiungere» prima del runtime.';
  }
  const names = proposed.map((p) => p.suggestedName).join(', ');
  return (
    `System prompt non completabile: mancano backend nel catalogo (${names}). ` +
    'Aggiungere i backend suggeriti e completare l\'analisi prima di implementare l\'agente a runtime.'
  );
}

function legacyGlobal(raw: BackendAnalysisDocumentV2['global']): {
  proposedBackends?: ProposedBackendRecord[];
  agentSystemPromptMarkdown?: string;
  missingBackends?: Array<{ name: string; reason: string }>;
  systemPromptBullets?: string[];
  generalRulesMarkdown?: string;
} {
  return raw as BackendAnalysisDocumentV2['global'] & {
    missingBackends?: Array<{ name: string; reason: string }>;
    systemPromptBullets?: string[];
    generalRulesMarkdown?: string;
    generalRules?: string[];
    summaryBullets?: string[];
    missingBackendsMarkdown?: string;
    whyMissingMarkdown?: string;
    notesMarkdown?: string;
  };
}

/** Allinea record backend: howToUseMarkdown come campo principale. */
function normalizeBackendRecord(
  b: BackendAnalysisDocumentV2['backends'][string]
): BackendAnalysisDocumentV2['backends'][string] {
  const legacy = b as BackendAnalysisDocumentV2['backends'][string] & {
    generalNotesMarkdown?: string;
    summaryBullets?: string[];
    constraintsBullets?: string[];
  };
  const howToUse =
    String(legacy.howToUseMarkdown ?? '').trim() ||
    String(legacy.generalNotesMarkdown ?? '').trim() ||
    bulletsToMarkdown(legacy.summaryBullets ?? []) ||
    bulletsToMarkdown(legacy.constraintsBullets ?? []);
  return {
    catalogEntryId: b.catalogEntryId,
    displayLabel: b.displayLabel,
    howToUseMarkdown: howToUse,
    parameters: b.parameters,
  };
}

/** Distribuisce regole generali AI nei backend citati (es. bookfromagenda). */
export function assignHowToUseFromGeneralRules(
  doc: BackendAnalysisDocumentV2,
  generalRules: readonly string[]
): BackendAnalysisDocumentV2 {
  if (!generalRules.length) return doc;
  const backends = { ...doc.backends };
  for (const [id, b] of Object.entries(backends)) {
    if (b.howToUseMarkdown.trim()) continue;
    const label = b.displayLabel.trim().toLowerCase();
    const idLower = id.toLowerCase();
    const matching = generalRules.filter((rule) => {
      const r = rule.toLowerCase();
      return (
        (label && r.includes(label)) ||
        (idLower && r.includes(idLower)) ||
        rule.includes(b.displayLabel)
      );
    });
    if (!matching.length) continue;
    backends[id] = {
      ...b,
      howToUseMarkdown: matching.map((line) => (line.startsWith('-') ? line : `- ${line}`)).join('\n'),
    };
  }
  return { ...doc, backends };
}

function mergeProposedRecords(
  existing: ProposedBackendRecord[],
  fromMissing: ProposedBackendRecord[]
): ProposedBackendRecord[] {
  const byName = new Map<string, ProposedBackendRecord>();
  for (const p of existing) {
    if (!isPlaceholderProposedSpec(p.specMarkdown)) {
      byName.set(p.suggestedName.toLowerCase(), p);
    }
  }
  for (const p of fromMissing) {
    const key = p.suggestedName.toLowerCase();
    if (!byName.has(key)) byName.set(key, p);
  }
  return [...byName.values()];
}

export type NormalizeBackendAnalysisUxOptions = {
  /** Markdown sorgente analisi (per estrarre specifiche backend mancanti). */
  sourceMarkdown?: string;
};

/** Normalizza global + backends dopo load o import AI. */
export function normalizeBackendAnalysisUxDocument(
  doc: BackendAnalysisDocumentV2,
  options: NormalizeBackendAnalysisUxOptions = {}
): BackendAnalysisDocumentV2 {
  const g = legacyGlobal(doc.global);
  const existingProposed = (g.proposedBackends ?? [])
    .map((p) => syncProposedBackendRecord(p))
    .filter((p) => proposedBackendHasSubstance(p) && !isPlaceholderProposedSpec(p.specMarkdown));
  const fromMissing =
    (g.missingBackends?.length ?? 0) > 0
      ? proposedBackendsFromAnalysisMissing(g.missingBackends!, options.sourceMarkdown)
      : [];
  let proposedBackends = mergeProposedRecords(existingProposed, fromMissing);

  let agentSystemPromptMarkdown = String(g.agentSystemPromptMarkdown ?? '').trim();
  if (!agentSystemPromptMarkdown && (g.systemPromptBullets?.length ?? 0) > 0) {
    agentSystemPromptMarkdown = g.systemPromptBullets!.map((l) => `- ${l}`).join('\n');
  }
  if (!agentSystemPromptMarkdown && proposedBackends.length > 0) {
    agentSystemPromptMarkdown = defaultIncompleteAgentSystemPrompt(proposedBackends);
  }

  const backends: BackendAnalysisDocumentV2['backends'] = {};
  for (const [id, b] of Object.entries(doc.backends)) {
    backends[id] = normalizeBackendRecord(b);
  }

  return {
    schemaVersion: 2,
    global: {
      proposedBackends: proposedBackends.map((p) => syncProposedBackendRecord(p)),
      agentSystemPromptMarkdown,
    },
    backends,
  };
}
