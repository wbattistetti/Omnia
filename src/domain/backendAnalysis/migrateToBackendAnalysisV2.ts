/**
 * Migrazione markdown legacy → BackendAnalysisDocumentV2.
 */

import type { ManualCatalogEntry } from '@domain/backendCatalog/catalogTypes';
import type { Task } from '@types/taskTypes';
import { buildBackendAnalysisDocument } from './buildBackendAnalysisDocument';
import type { BackendAnalysisDocument } from './backendAnalysisDocumentTypes';
import { parseBackendAnalysisDocument } from './parseBackendAnalysisDocument';
import {
  createEmptyBackendAnalysisDocumentV2,
  type BackendAnalysisDocumentV2,
  type BackendAnalysisBackendRecord,
  type BackendParameterAnalysisRecord,
} from './backendAnalysisDocumentV2';
import { collectBackendAnalysisStructureContext } from './collectBackendAnalysisStructureContext';
import {
  assignHowToUseFromGeneralRules,
  normalizeBackendAnalysisUxDocument,
} from './backendAnalysisUxNormalize';

function resolveEntryForSection(
  sectionName: string,
  entries: readonly ManualCatalogEntry[]
): ManualCatalogEntry | undefined {
  const lower = sectionName.toLowerCase();
  return (
    entries.find((e) => e.id.toLowerCase() === lower) ??
    entries.find((e) => (e.label?.trim() || '').toLowerCase() === lower)
  );
}

function sectionsToBackendRecords(
  sections: Array<{
    name: string;
    parameters: Array<{
      name: string;
      direction: 'input' | 'output';
      kind: BackendParameterAnalysisRecord['kind'];
      role: string;
      description: string;
    }>;
    payoffEntries: Array<{
      parameter: string;
      payoffSummary: string;
      payoffDetail: string;
    }>;
  }>,
  entries: readonly ManualCatalogEntry[]
): Record<string, BackendAnalysisBackendRecord> {
  const backends: Record<string, BackendAnalysisBackendRecord> = {};
  for (const section of sections) {
    const entry = resolveEntryForSection(section.name, entries);
    const catalogEntryId = entry?.id ?? section.name;
    const parameters: Record<string, BackendParameterAnalysisRecord> = {};
    for (const row of section.parameters) {
      const payoff = section.payoffEntries.find((p) => p.parameter === row.name);
      parameters[row.name] = {
        paramKey: row.name,
        direction: row.direction,
        kind: row.kind,
        role: row.role,
        descriptionShort: row.description,
        analysisSummary: payoff?.payoffSummary ?? row.description,
        analysisDetailMarkdown: payoff?.payoffDetail ?? row.description,
      };
    }
    backends[catalogEntryId] = {
      catalogEntryId,
      displayLabel: entry?.label?.trim() || section.name,
      howToUseMarkdown: '',
      parameters,
    };
  }
  return backends;
}

function v1DocumentToV2(
  v1: BackendAnalysisDocument,
  entries: readonly ManualCatalogEntry[]
): BackendAnalysisDocumentV2 {
  const backends = sectionsToBackendRecords(
    v1.backends.map((b) => ({
      name: b.name,
      parameters: b.parameters.map((p) => ({
        name: p.name,
        direction: p.direction,
        kind: p.kind,
        role: p.role,
        description: p.description,
      })),
      payoffEntries: b.payoffData.entries,
    })),
    entries
  );
  return normalizeBackendAnalysisUxDocument(
    {
      schemaVersion: 2,
      global: {
        proposedBackends: [],
        agentSystemPromptMarkdown: v1.systemPromptLines.join('\n'),
        missingBackends: v1.missingBackends.map((m) => ({
          name: m.name,
          reason: m.reason,
        })),
        systemPromptBullets: [...v1.systemPromptLines],
      } as BackendAnalysisDocumentV2['global'] & {
        missingBackends: Array<{ name: string; reason: string }>;
        systemPromptBullets: string[];
      },
      backends,
    },
    { sourceMarkdown: '' }
  );
}

/** Allinea backends del documento alle voci catalogo e parametri noti dai task. */
export function ensureCatalogBackendsOnDocument(
  doc: BackendAnalysisDocumentV2,
  manualEntries: readonly ManualCatalogEntry[],
  tasks: readonly Task[]
): BackendAnalysisDocumentV2 {
  const ctx = collectBackendAnalysisStructureContext(manualEntries, tasks);
  const next: BackendAnalysisDocumentV2 = {
    ...doc,
    global: { ...doc.global },
    backends: { ...doc.backends },
  };

  for (const entry of manualEntries) {
    const id = entry.id;
    const existing = next.backends[id];
    const displayLabel = entry.label?.trim() || id;
    const parameters: Record<string, BackendParameterAnalysisRecord> = {
      ...(existing?.parameters ?? {}),
    };

    for (const kp of ctx.knownParameters) {
      const matches =
        kp.backendLabel === displayLabel ||
        kp.backendLabel.toLowerCase() === id.toLowerCase();
      if (!matches || parameters[kp.name]) continue;
      parameters[kp.name] = {
        paramKey: kp.name,
        direction: kp.direction,
        kind: 'required',
        role: '',
        descriptionShort: '',
        analysisSummary: '',
        analysisDetailMarkdown: '',
      };
    }

    const legacyBackend = existing as
      | (BackendAnalysisBackendRecord & { generalNotesMarkdown?: string })
      | undefined;
    next.backends[id] = {
      catalogEntryId: id,
      displayLabel,
      howToUseMarkdown:
        legacyBackend?.howToUseMarkdown?.trim() ||
        legacyBackend?.generalNotesMarkdown?.trim() ||
        '',
      parameters,
    };
  }

  return normalizeBackendAnalysisUxDocument(next);
}

/** Converte markdown analisi (qualsiasi formato supportato) in documento V2. */
export function markdownToBackendAnalysisV2(
  markdown: string,
  manualEntries: readonly ManualCatalogEntry[],
  tasks: readonly Task[]
): BackendAnalysisDocumentV2 {
  const trimmed = markdown.trim();
  if (!trimmed) {
    return ensureCatalogBackendsOnDocument(
      createEmptyBackendAnalysisDocumentV2(),
      manualEntries,
      tasks
    );
  }

  const parsed = parseBackendAnalysisDocument(trimmed);
  if (parsed?.backends.length) {
    const doc = createEmptyBackendAnalysisDocumentV2();
    const backends = sectionsToBackendRecords(
      parsed.backends.map((b) => ({
        name: b.name,
        parameters: b.parameters,
        payoffEntries: b.payoffData.entries,
      })),
      manualEntries
    );
    const pre = normalizeBackendAnalysisUxDocument(
      {
        schemaVersion: 2,
        global: {
          proposedBackends: [],
          agentSystemPromptMarkdown: parsed.systemPromptLines.join('\n'),
          missingBackends: parsed.missingBackends.map((m) => ({
            name: m.name,
            reason: m.reason,
          })),
          systemPromptBullets: [...parsed.systemPromptLines],
        } as BackendAnalysisDocumentV2['global'] & {
          missingBackends: Array<{ name: string; reason: string }>;
          systemPromptBullets: string[];
        },
        backends,
      },
      { sourceMarkdown: trimmed }
    );
    const withHowTo = assignHowToUseFromGeneralRules(pre, parsed.generalRules);
    return ensureCatalogBackendsOnDocument(withHowTo, manualEntries, tasks);
  }

  const built = buildBackendAnalysisDocument({
    rawText: trimmed,
    context: collectBackendAnalysisStructureContext(manualEntries, tasks),
  });
  const doc = v1DocumentToV2(built.document, manualEntries);
  const withHowTo = assignHowToUseFromGeneralRules(doc, built.document.generalRules);
  return ensureCatalogBackendsOnDocument(
    normalizeBackendAnalysisUxDocument(withHowTo, { sourceMarkdown: trimmed }),
    manualEntries,
    tasks
  );
}
