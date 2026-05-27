/**
 * Builds verbatim reference text for backend analysis excerpt validation.
 */

import { TaskType, type Task } from '@types/taskTypes';
import type { ManualCatalogEntry } from '@domain/backendCatalog/catalogTypes';
import {
  findBackendCallTaskForManualCatalogEntry,
  findGraphBackendTaskForManualCatalogEntry,
} from '@domain/backendCatalog/matchBackendCallTask';

type ParamRow = {
  direction: 'input' | 'output';
  apiName: string;
  internalName?: string;
  description?: string;
};

function paramRowsFromTask(task: Task): ParamRow[] {
  const rows: ParamRow[] = [];
  const t = task as Task & {
    inputs?: Array<{ internalName?: string; apiName?: string; fieldDescription?: string }>;
    outputs?: Array<{ internalName?: string; apiName?: string; fieldDescription?: string }>;
  };
  for (const inp of t.inputs ?? []) {
    const apiName = String(inp.apiName ?? inp.internalName ?? '').trim();
    if (!apiName) continue;
    rows.push({
      direction: 'input',
      apiName,
      internalName: inp.internalName,
      description: inp.fieldDescription?.trim(),
    });
  }
  for (const out of t.outputs ?? []) {
    const apiName = String(out.apiName ?? out.internalName ?? '').trim();
    if (!apiName) continue;
    rows.push({
      direction: 'output',
      apiName,
      internalName: out.internalName,
      description: out.fieldDescription?.trim(),
    });
  }
  return rows;
}

function resolveBackendTask(
  entry: ManualCatalogEntry,
  tasks: readonly Task[],
  allManual: readonly ManualCatalogEntry[]
): Task | null {
  return (
    findGraphBackendTaskForManualCatalogEntry(tasks, allManual, entry.id) ??
    findBackendCallTaskForManualCatalogEntry(tasks, entry)
  );
}

/** Verbatim corpus: backend labels, notes, param descriptions (+ optional KB/task context). */
export function buildBackendReferenceCorpus(params: {
  manualEntries: readonly ManualCatalogEntry[];
  tasks: readonly Task[];
  agentTaskSummary?: string;
  kbContextMarkdown?: string;
}): string {
  const parts: string[] = [];
  const summary = String(params.agentTaskSummary ?? '').trim();
  if (summary) {
    parts.push('--- Agent task ---', summary.slice(0, 8_000));
  }
  const kb = String(params.kbContextMarkdown ?? '').trim();
  if (kb) {
    parts.push('', '--- Knowledge base context ---', kb.slice(0, 12_000));
  }

  for (const entry of params.manualEntries) {
    const label = entry.label?.trim() || entry.id;
    parts.push('', `--- Backend: ${label} ---`);
    parts.push(`URL: ${entry.endpointUrl}`);
    parts.push(`Method: ${entry.method ?? 'GET'}`);
    if (entry.notes?.trim()) parts.push(`Notes: ${entry.notes.trim()}`);
    if (entry.operationId?.trim()) parts.push(`OperationId: ${entry.operationId.trim()}`);

    const task = resolveBackendTask(entry, params.tasks, params.manualEntries);
    if (!task || task.type !== TaskType.BackendCall) {
      parts.push('(Nessun task Backend Call collegato — parametri non disponibili.)');
      continue;
    }
    const meta = (task as Task & { backendCallSpecMeta?: { openapiDescriptionSnapshots?: { inputs: Record<string, string>; outputs: Record<string, string> } } })
      .backendCallSpecMeta;
    const snapIn = meta?.openapiDescriptionSnapshots?.inputs ?? {};
    const snapOut = meta?.openapiDescriptionSnapshots?.outputs ?? {};

    for (const row of paramRowsFromTask(task)) {
      const snap =
        row.direction === 'input' ? snapIn[row.apiName] : snapOut[row.apiName];
      const desc = row.description || snap || '';
      parts.push(
        `[${row.direction.toUpperCase()}] ${row.apiName}` +
          (row.internalName ? ` (internal: ${row.internalName})` : '') +
          (desc ? `: ${desc}` : '')
      );
    }
  }

  return parts.join('\n').trim();
}
