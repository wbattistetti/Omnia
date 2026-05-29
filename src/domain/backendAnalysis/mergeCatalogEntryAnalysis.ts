/**
 * Unisce l'output IA di analisi backend nel documento V2, solo per una voce catalogo.
 */

import type { ManualCatalogEntry } from '@domain/backendCatalog/catalogTypes';
import type { Task } from '@types/taskTypes';
import type {
  BackendAnalysisBackendRecord,
  BackendAnalysisDocumentV2,
  BackendParameterAnalysisRecord,
} from './backendAnalysisDocumentV2';
import { exportBackendAnalysisV2Markdown } from './exportBackendAnalysisV2Markdown';
import { markdownToBackendAnalysisV2 } from './migrateToBackendAnalysisV2';
import { normalizeBackendAnalysisUxDocument } from './backendAnalysisUxNormalize';
import { parseBackendAnalysisDocument } from './parseBackendAnalysisDocument';
import { debugTextPreview, logBackendAnalysis } from './backendAnalysisDebug';

function normalizeBackendKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function endpointSlugFromUrl(url: string | undefined): string {
  const raw = String(url ?? '').trim();
  if (!raw) return '';
  try {
    const parts = new URL(raw).pathname.split('/').filter(Boolean);
    return (parts[parts.length - 1] ?? '').toLowerCase();
  } catch {
    const tail = raw.split('/').filter(Boolean).pop() ?? '';
    return tail.toLowerCase();
  }
}

function summaryBulletsToHowTo(markdown: string): string {
  const parsed = parseBackendAnalysisDocument(markdown);
  if (!parsed?.summary.length) return '';
  return parsed.summary.map((line) => (line.startsWith('-') ? line : `- ${line}`)).join('\n');
}

function mergeParameterRecords(
  existing: Record<string, BackendParameterAnalysisRecord>,
  incoming: Record<string, BackendParameterAnalysisRecord>
): Record<string, BackendParameterAnalysisRecord> {
  const next = { ...existing };
  for (const [key, row] of Object.entries(incoming)) {
    const existingKey =
      Object.keys(next).find((k) => k.toLowerCase() === key.toLowerCase()) ?? key;
    const prev = next[existingKey];
    if (!prev) {
      next[existingKey] = { ...row, paramKey: existingKey };
      continue;
    }
    next[existingKey] = {
      ...prev,
      ...row,
      paramKey: prev.paramKey,
      direction: row.direction || prev.direction,
      analysisSummary: row.analysisSummary.trim() || prev.analysisSummary,
      analysisDetailMarkdown:
        row.analysisDetailMarkdown.trim() || prev.analysisDetailMarkdown,
      descriptionShort: row.descriptionShort.trim() || prev.descriptionShort,
      role: row.role.trim() || prev.role,
      kind: row.kind || prev.kind,
    };
  }
  return next;
}

function resolveIncomingBackend(
  parsed: BackendAnalysisDocumentV2,
  catalogEntryId: string,
  entry: ManualCatalogEntry | undefined
): BackendAnalysisBackendRecord | undefined {
  const direct = parsed.backends[catalogEntryId];
  if (direct) return direct;

  const label = entry?.label?.trim() ?? '';
  const labelNorm = normalizeBackendKey(label);
  const idNorm = normalizeBackendKey(catalogEntryId);
  const urlSlug = endpointSlugFromUrl(entry?.endpointUrl);

  const candidates = Object.values(parsed.backends);
  const byLabel = label
    ? candidates.find((b) => {
        const display = b.displayLabel.trim().toLowerCase();
        const displayNorm = normalizeBackendKey(b.displayLabel);
        return (
          display === label.toLowerCase() ||
          displayNorm === labelNorm ||
          (urlSlug && (display.includes(urlSlug) || displayNorm.includes(normalizeBackendKey(urlSlug)))) ||
          (labelNorm && displayNorm.includes(labelNorm)) ||
          (labelNorm && labelNorm.includes(displayNorm))
        );
      })
    : undefined;
  if (byLabel) return byLabel;

  const byCatalogId = candidates.find(
    (b) =>
      b.catalogEntryId === catalogEntryId ||
      normalizeBackendKey(b.catalogEntryId) === idNorm
  );
  if (byCatalogId) return byCatalogId;

  if (candidates.length === 1) return candidates[0];
  return undefined;
}

function resolveHowToUseMarkdown(
  incoming: BackendAnalysisBackendRecord,
  existing: BackendAnalysisBackendRecord | undefined,
  sourceMarkdown: string
): string {
  const fromIncoming = incoming.howToUseMarkdown.trim();
  if (fromIncoming) return fromIncoming;
  const fromExisting = existing?.howToUseMarkdown.trim();
  if (fromExisting) return fromExisting;
  return summaryBulletsToHowTo(sourceMarkdown);
}

/** True se il merge ha aggiunto testo IA (how-to o analisi parametri). */
export function catalogEntryMergeChangedContent(
  before: BackendAnalysisBackendRecord | undefined,
  after: BackendAnalysisBackendRecord
): boolean {
  if (!before) {
    return catalogEntryHasSubstantiveAnalysis(after);
  }
  if (after.howToUseMarkdown.trim() && !before.howToUseMarkdown.trim()) return true;
  for (const [key, row] of Object.entries(after.parameters)) {
    const prev =
      Object.entries(before.parameters).find(([k]) => k.toLowerCase() === key.toLowerCase())?.[1] ??
      before.parameters[key];
    if (!prev) {
      if (paramHasSubstantiveAnalysis(row)) return true;
      continue;
    }
    if (
      (row.analysisSummary.trim() && !prev.analysisSummary.trim()) ||
      (row.analysisDetailMarkdown.trim() && !prev.analysisDetailMarkdown.trim()) ||
      (row.role.trim() && !prev.role.trim()) ||
      (row.descriptionShort.trim() && !prev.descriptionShort.trim())
    ) {
      return true;
    }
  }
  return false;
}

function paramHasSubstantiveAnalysis(p: BackendParameterAnalysisRecord): boolean {
  return Boolean(
    p.analysisSummary.trim() ||
      p.analysisDetailMarkdown.trim() ||
      p.role.trim() ||
      p.descriptionShort.trim()
  );
}

export function catalogEntryHasSubstantiveAnalysis(
  backend: BackendAnalysisBackendRecord
): boolean {
  if (backend.howToUseMarkdown.trim()) return true;
  return Object.values(backend.parameters).some(paramHasSubstantiveAnalysis);
}

export type CatalogEntryMergeDiagnostics = {
  catalogEntryId: string;
  markdownChars: number;
  parsedBackendKeys: string[];
  resolvedIncoming: boolean;
  incomingDisplayLabel?: string;
  incomingParamCount: number;
  incomingParamsWithText: number;
  howToUseChars: number;
  mergeNoop: boolean;
};

/** Report merge (per log UI) senza mutare il documento. */
export function diagnoseCatalogEntryMerge(
  current: BackendAnalysisDocumentV2,
  markdown: string,
  catalogEntryId: string,
  manualEntries: readonly ManualCatalogEntry[],
  tasks: readonly Task[]
): CatalogEntryMergeDiagnostics {
  const trimmed = markdown.trim();
  const entry = manualEntries.find((e) => e.id === catalogEntryId);
  const parsed = trimmed
    ? markdownToBackendAnalysisV2(trimmed, manualEntries, tasks)
    : current;
  const incoming = trimmed
    ? resolveIncomingBackend(parsed, catalogEntryId, entry)
    : undefined;
  const existing = current.backends[catalogEntryId];
  const howToUse = incoming
    ? resolveHowToUseMarkdown(incoming, existing, trimmed)
    : '';
  const incomingParams = incoming ? Object.values(incoming.parameters) : [];
  const withText = incomingParams.filter((p) => paramHasSubstantiveAnalysis(p)).length;
  return {
    catalogEntryId,
    markdownChars: trimmed.length,
    parsedBackendKeys: Object.keys(parsed.backends),
    resolvedIncoming: Boolean(incoming),
    incomingDisplayLabel: incoming?.displayLabel,
    incomingParamCount: incomingParams.length,
    incomingParamsWithText: withText,
    howToUseChars: howToUse.length,
    mergeNoop: !trimmed || !incoming,
  };
}

/** Applica il markdown IA al solo backend indicato, preservando il resto del documento. */
export function mergeCatalogEntryAnalysisFromMarkdown(
  current: BackendAnalysisDocumentV2,
  markdown: string,
  catalogEntryId: string,
  manualEntries: readonly ManualCatalogEntry[],
  tasks: readonly Task[]
): BackendAnalysisDocumentV2 {
  const trimmed = markdown.trim();
  if (!trimmed) {
    logBackendAnalysis('merge.skip', { catalogEntryId, reason: 'markdown_vuoto' });
    return current;
  }

  const entry = manualEntries.find((e) => e.id === catalogEntryId);
  const parsed = markdownToBackendAnalysisV2(trimmed, manualEntries, tasks);
  const incoming = resolveIncomingBackend(parsed, catalogEntryId, entry);
  if (!incoming) {
    logBackendAnalysis('merge.skip', {
      catalogEntryId,
      reason: 'backend_non_risolto',
      label: entry?.label,
      endpointSlug: endpointSlugFromUrl(entry?.endpointUrl),
      parsedBackendKeys: Object.keys(parsed.backends),
      markdownPreview: debugTextPreview(trimmed),
    });
    return current;
  }

  const existing = current.backends[catalogEntryId];
  const mergedBackend: BackendAnalysisBackendRecord = {
    catalogEntryId,
    displayLabel: existing?.displayLabel ?? incoming.displayLabel,
    howToUseMarkdown: resolveHowToUseMarkdown(incoming, existing, trimmed),
    parameters: mergeParameterRecords(
      existing?.parameters ?? {},
      incoming.parameters
    ),
    suggestedFeatures: existing?.suggestedFeatures ?? incoming.suggestedFeatures ?? [],
  };

  const next: BackendAnalysisDocumentV2 = {
    ...current,
    global: { ...current.global },
    backends: {
      ...current.backends,
      [catalogEntryId]: mergedBackend,
    },
  };

  const exported = exportBackendAnalysisV2Markdown(next);
  const normalized = normalizeBackendAnalysisUxDocument(next, { sourceMarkdown: exported });
  const merged = normalized.backends[catalogEntryId];
  logBackendAnalysis('merge.ok', {
    catalogEntryId,
    incomingDisplayLabel: incoming.displayLabel,
    howToUseChars: merged?.howToUseMarkdown.trim().length ?? 0,
    paramCount: Object.keys(merged?.parameters ?? {}).length,
    paramsWithSubstance: Object.values(merged?.parameters ?? {}).filter((p) =>
      paramHasSubstantiveAnalysis(p)
    ).length,
    complete: merged ? catalogEntryHasCompleteIaAnalysis(merged) : false,
  });
  return normalized;
}

/** Bozza markdown per refine/propose focalizzato su un backend. */
export function buildCatalogEntryAnalysisDraft(
  doc: BackendAnalysisDocumentV2,
  catalogEntryId: string,
  displayLabel: string
): string {
  const backend = doc.backends[catalogEntryId];
  const focus = [
    `Completa l'analisi d'uso (tabella parametri, PayoffData, note operative) SOLO per il backend «${displayLabel}».`,
    'Non includere altri backend nel markdown di risposta.',
    '',
  ].join('\n');

  if (!backend) {
    return `${focus}# Analisi backend\n\n## Backend: ${displayLabel} [chip]\n`;
  }

  const slice: BackendAnalysisDocumentV2 = {
    ...doc,
    global: {
      ...doc.global,
      proposedBackends: [],
      agentSystemPromptMarkdown: '',
    },
    backends: { [catalogEntryId]: backend },
  };
  return focus + exportBackendAnalysisV2Markdown(slice);
}

/** Analisi IA considerata completa (how-to + payoff/dettaglio parametri). */
export function catalogEntryHasCompleteIaAnalysis(
  backend: BackendAnalysisBackendRecord
): boolean {
  if (!backend.howToUseMarkdown.trim()) return false;
  const params = Object.values(backend.parameters);
  if (params.length === 0) return true;
  return params.every(
    (p) => Boolean(p.analysisSummary.trim() || p.analysisDetailMarkdown.trim())
  );
}

export function catalogEntryNeedsIaAnalysis(
  backend: BackendAnalysisBackendRecord | undefined
): boolean {
  if (!backend) return true;
  return !catalogEntryHasCompleteIaAnalysis(backend);
}
