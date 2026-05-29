/**
 * Sezione compatta «USE OF BACKENDS» per prompt runtime / deploy (ElevenLabs e altre piattaforme).
 * Per ogni parametro: type/format OpenAPI oppure MISSING (validator deterministico).
 */

import type { ProjectBackendCatalogBlob } from '@domain/backendCatalog/catalogTypes';
import { deriveExportedToolName } from '@domain/iaAgentTools/backendToolDerivation';
import {
  buildOpenApiParamContractLines,
  type OpenApiParamContractLine,
} from '@domain/openApi/buildOpenApiParamContractLines';
import { TaskType, type Task } from '@types/taskTypes';
import { taskRepository } from '@services/TaskRepository';
import { readAgentBackendAnalysisBundle } from './agentBackendAnalysisBundle';
import type {
  BackendAnalysisBackendRecord,
  BackendAnalysisDocumentV2,
} from './backendAnalysisDocumentV2';
import { catalogEntryHasSubstantiveAnalysis } from './mergeCatalogEntryAnalysis';
import { markdownToBackendAnalysisV2 } from './migrateToBackendAnalysisV2';
import { filterBackendAnalysisDocumentToManualCatalog } from './pruneBackendAnalysisToCatalog';
import type { ManualCatalogEntry } from '@domain/backendCatalog/catalogTypes';

export const USE_OF_BACKENDS_SECTION_HEADER = '## USE OF BACKENDS:';

const DEFAULT_MAX_CHARS = 4_200;
const MAX_BACKENDS = 10;
const MAX_PARAMS_PER_DIRECTION = 14;
const MAX_HOW_TO = 220;
const MAX_GLOBAL_NOTE = 320;
const MAX_TOOL_DESC = 140;
/** Regex: sezione USE OF BACKENDS fino al prossimo H2 o fine file. */
const USE_OF_BACKENDS_SECTION_RE =
  /## USE OF BACKENDS:\s*\n[\s\S]*?(?=\n## [^\n#]|$)/;

function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function resolveToolName(catalogEntryId: string): string | undefined {
  const task = taskRepository.getTask(catalogEntryId);
  if (!task || task.type !== TaskType.BackendCall) return undefined;
  const name = deriveExportedToolName(task).trim();
  return name || undefined;
}

/** URL operativa pubblica e metodo HTTP per il backend (task o voce catalogo). */
function resolveBackendEndpoint(
  task: Task,
  manualEntry?: ManualCatalogEntry
): { url: string; method: string } {
  const ep = (task as Task & { endpoint?: { url?: string; method?: string } }).endpoint;
  const url = String(ep?.url ?? manualEntry?.endpointUrl ?? '').trim();
  const method = String(ep?.method ?? manualEntry?.method ?? 'POST')
    .trim()
    .toUpperCase();
  return { url, method: method || 'POST' };
}

function formatContractDirectionBlock(
  contractLines: readonly OpenApiParamContractLine[],
  direction: 'input' | 'output',
  arrow: '→' | '←'
): string[] {
  const rows = contractLines
    .filter((l) => l.direction === direction)
    .sort((a, b) => a.paramKey.localeCompare(b.paramKey))
    .slice(0, MAX_PARAMS_PER_DIRECTION);
  if (rows.length === 0) return [];
  const out: string[] = [direction === 'input' ? 'SEND:' : 'RECEIVE:'];
  for (const row of rows) {
    out.push(`  ${arrow} ${row.paramKey}: ${row.contractText}`);
    for (const nested of row.nestedLines) {
      out.push(`     · ${nested.path}: ${nested.text}`);
    }
  }
  return out;
}

function formatBackendBlock(
  backend: BackendAnalysisBackendRecord | undefined,
  label: string,
  task: Task | null | undefined,
  toolName?: string,
  manualEntry?: ManualCatalogEntry
): string {
  const contractLines = task ? buildOpenApiParamContractLines(task) : [];
  const hasHowTo = Boolean(backend?.howToUseMarkdown.trim());
  const hasContract = contractLines.length > 0;

  if (!hasContract && !hasHowTo) {
    const desc = task
      ? String((task as Task).backendToolDescription ?? '').trim()
      : '';
    if (!desc) return '';
  }

  const lines: string[] = [];
  lines.push(
    toolName ? `### ${label} (tool: \`${toolName}\`)` : `### ${label}`
  );

  if (task) {
    const { url, method } = resolveBackendEndpoint(task, manualEntry);
    if (url) lines.push(`URL: ${url}`);
    if (method) lines.push(`Method: ${method}`);
  }

  if (hasHowTo && backend) {
    lines.push(`Use: ${clip(backend.howToUseMarkdown, MAX_HOW_TO)}`);
  } else if (task) {
    const desc = String((task as Task).backendToolDescription ?? '').trim();
    if (desc) lines.push(`Use: ${clip(desc, MAX_TOOL_DESC)}`);
  }

  if (hasContract) {
    lines.push(
      'Contract (OpenAPI — type/format o MISSING; oggetti espansi sotto):',
      ...formatContractDirectionBlock(contractLines, 'input', '→'),
      ...formatContractDirectionBlock(contractLines, 'output', '←')
    );
  }

  return lines.filter(Boolean).join('\n');
}

/** Costruisce la sezione da documento analisi V2 (senza header). */
export function buildUseOfBackendsBodyFromDocument(
  doc: BackendAnalysisDocumentV2,
  manualEntries?: readonly ManualCatalogEntry[]
): string {
  const scoped =
    manualEntries && manualEntries.length > 0
      ? filterBackendAnalysisDocumentToManualCatalog(doc, manualEntries)
      : doc;
  const parts: string[] = [];

  const globalNote = scoped.global.agentSystemPromptMarkdown.trim();
  if (globalNote) {
    parts.push(`Global: ${clip(globalNote, MAX_GLOBAL_NOTE)}`, '');
  }

  const backends = Object.values(scoped.backends).sort((a, b) =>
    a.displayLabel.localeCompare(b.displayLabel, undefined, { sensitivity: 'base' })
  );

  for (const backend of backends.slice(0, MAX_BACKENDS)) {
    const task = taskRepository.getTask(backend.catalogEntryId);
    const toolName = resolveToolName(backend.catalogEntryId);
    const entry = manualEntries?.find((e) => e.id === backend.catalogEntryId);
    const block = formatBackendBlock(backend, backend.displayLabel, task, toolName, entry);
    if (block) parts.push(block, '');
  }

  const proposed = scoped.global.proposedBackends;
  if (proposed.length > 0) {
    parts.push('Gaps (not in catalog yet):');
    for (const p of proposed.slice(0, 5)) {
      const purpose = (p.purposeMarkdown || p.specMarkdown || '').trim();
      parts.push(`- ${p.suggestedName}: ${clip(purpose, 120) || 'see analysis'}`);
    }
    parts.push('');
  }

  return parts.join('\n').trim();
}

function resolveAnalysisDocument(
  catalog: ProjectBackendCatalogBlob,
  agentTaskId: string
): BackendAnalysisDocumentV2 | null {
  const bundle = readAgentBackendAnalysisBundle(catalog, agentTaskId);
  if (!bundle.agentAnalysisBaselineMarkdown.trim() && !bundle.analysisMarkdown.trim()) {
    return null;
  }
  if (bundle.analysisDocument && Object.keys(bundle.analysisDocument.backends).length > 0) {
    return bundle.analysisDocument;
  }
  const markdown = bundle.analysisMarkdown.trim();
  if (!markdown) return null;
  const manual = catalog.manualEntries ?? [];
  return markdownToBackendAnalysisV2(markdown, manual, taskRepository.getAllTasks());
}

function backendRecordByCatalogId(
  doc: BackendAnalysisDocumentV2 | null,
  catalogEntryId: string
): BackendAnalysisBackendRecord | undefined {
  return doc?.backends[catalogEntryId];
}

/**
 * Sezione markdown «USE OF BACKENDS» per prompt deploy (contratto OpenAPI + uso IA opzionale).
 */
export function buildUseOfBackendsPromptSection(params: {
  catalog?: ProjectBackendCatalogBlob;
  agentTaskId: string;
  manualCatalogBackendTaskIds?: readonly string[];
  maxChars?: number;
}): string {
  const agentTaskId = String(params.agentTaskId ?? '').trim();
  if (!agentTaskId) return '';

  const maxChars = params.maxChars ?? DEFAULT_MAX_CHARS;
  const catalog = params.catalog;
  const doc = catalog ? resolveAnalysisDocument(catalog, agentTaskId) : null;
  const manual = catalog?.manualEntries ?? [];

  const toolIds = [
    ...new Set(
      (params.manualCatalogBackendTaskIds ?? [])
        .map((x) => String(x ?? '').trim())
        .filter(Boolean)
    ),
  ];

  if (doc && toolIds.length === 0) {
    for (const id of Object.keys(doc.backends)) toolIds.push(id);
  }

  const bodyParts: string[] = [];

  if (doc) {
    const globalNote = doc.global.agentSystemPromptMarkdown.trim();
    if (globalNote) {
      bodyParts.push(`Global: ${clip(globalNote, MAX_GLOBAL_NOTE)}`, '');
    }
  }

  const sortedIds = [...toolIds].sort((a, b) => {
    const la =
      manual.find((e) => e.id === a)?.label?.trim() ||
      taskRepository.getTask(a)?.label?.trim() ||
      a;
    const lb =
      manual.find((e) => e.id === b)?.label?.trim() ||
      taskRepository.getTask(b)?.label?.trim() ||
      b;
    return la.localeCompare(lb, undefined, { sensitivity: 'base' });
  });

  for (const tid of sortedIds.slice(0, MAX_BACKENDS)) {
    const task = taskRepository.getTask(tid);
    if (!task || task.type !== TaskType.BackendCall) continue;
    const entry = manual.find((e) => e.id === tid);
    const label =
      entry?.label?.trim() || String(task.label ?? '').trim() || tid;
    const backend = backendRecordByCatalogId(doc, tid);
    const toolName = resolveToolName(tid);
    const block = formatBackendBlock(backend, label, task, toolName, entry);
    if (block) bodyParts.push(block, '');
  }

  if (doc) {
    const proposed = filterBackendAnalysisDocumentToManualCatalog(doc, manual).global
      .proposedBackends;
    if (proposed.length > 0) {
      bodyParts.push('Gaps (not in catalog yet):');
      for (const p of proposed.slice(0, 5)) {
        const purpose = (p.purposeMarkdown || p.specMarkdown || '').trim();
        bodyParts.push(`- ${p.suggestedName}: ${clip(purpose, 120) || 'see analysis'}`);
      }
      bodyParts.push('');
    }
  }

  const body = bodyParts.join('\n').trim();
  if (!body) return '';

  const section = `${USE_OF_BACKENDS_SECTION_HEADER}\n\n${body}`;
  if (section.length <= maxChars) return section;
  return `${section.slice(0, maxChars - 1)}…`;
}

/** Rimuove una eventuale sezione USE OF BACKENDS dal markdown Context. */
export function stripUseOfBackendsFromContext(contextMarkdown: string): string {
  return contextMarkdown.replace(USE_OF_BACKENDS_SECTION_RE, '').trim();
}

/**
 * Inserisce o **sostituisce** la sezione USE OF BACKENDS nel Context (sempre versione fresca).
 */
export function mergeUseOfBackendsIntoContext(contextMarkdown: string, section: string): string {
  const extra = section.trim();
  if (!extra) return contextMarkdown.trim();
  const base = stripUseOfBackendsFromContext(contextMarkdown.trim());
  return base ? `${base}\n\n${extra}` : extra;
}

/** Backend catalogo con analisi sostanziale (per altri moduli). */
export function catalogEntryIdsWithSubstantiveAnalysis(
  doc: BackendAnalysisDocumentV2
): Set<string> {
  const ids = new Set<string>();
  for (const [id, b] of Object.entries(doc.backends)) {
    if (catalogEntryHasSubstantiveAnalysis(b) || b.howToUseMarkdown.trim()) {
      ids.add(id);
    }
  }
  return ids;
}
