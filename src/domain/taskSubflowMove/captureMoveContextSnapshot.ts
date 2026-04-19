/**
 * Read-only snapshot of parent + subflow canvas state for roundtrip verification (task move 1→2→1).
 */

import { isDeepStrictEqual } from 'node:util';

import type { Flow, WorkspaceState } from '@flows/FlowTypes';
import { taskRepository } from '@services/TaskRepository';
import { variableCreationService } from '@services/VariableCreationService';
import { parseSubflowTaskRowIdFromChildCanvasId } from './subflowParentLookup';
import { getVariableLabel } from '@utils/getVariableLabel';

export type WorkspaceFlowSlice = Flow;

export type MoveContextSnapshot = {
  flows: {
    parent: WorkspaceFlowSlice;
    child: WorkspaceFlowSlice;
  };
  task: {
    id: string;
    authoringFlowCanvasId: string | null;
  };
  variableStore: {
    varIds: string[];
    byId: Record<string, { scopeFlowId: string; name: string }>;
  };
  subflowBindings: {
    portalRowId: string;
    bindingVarIds: string[];
  };
  childInterface: {
    inputVarIds: string[];
    outputVarIds: string[];
  };
};

function sortedUnique(ids: Iterable<string>): string[] {
  return [...new Set([...ids].map((x) => String(x || '').trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );
}

/** Flatten flowInterface rows to sorted variableRefId lists. */
function collectInterfaceVarIds(slice: Flow | undefined, io: 'input' | 'output'): string[] {
  const fi = slice?.meta?.flowInterface;
  const rows = io === 'input' ? fi?.input : fi?.output;
  const ids: string[] = [];
  if (!Array.isArray(rows)) return ids;
  for (const r of rows) {
    const id = String((r as { variableRefId?: string }).variableRefId || '').trim();
    if (id) ids.push(id);
  }
  return sortedUnique(ids);
}

function flattenStringTranslations(meta: Flow['meta']): Record<string, string> {
  const tr =
    meta && typeof meta.translations === 'object' && meta.translations
      ? (meta.translations as Record<string, unknown>)
      : {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(tr)) {
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

/**
 * Canonical flow slice for deterministic equality: drops volatile authoring flags and sorts nested arrays.
 */
export function canonicalWorkspaceFlowSlice(slice: Flow | undefined): Flow {
  if (!slice) {
    return { id: '', title: '', nodes: [], edges: [] } as Flow;
  }
  const cloned =
    typeof structuredClone !== 'undefined'
      ? structuredClone(slice)
      : (JSON.parse(JSON.stringify(slice)) as Flow);
  const loose = cloned as Record<string, unknown>;
  delete loose.hasLocalChanges;
  delete loose.variablesReady;
  delete loose.hydrated;
  delete loose.serverHydrationApplied;

  const meta =
    loose.meta && typeof loose.meta === 'object'
      ? ({ ...(loose.meta as Record<string, unknown>) } as Record<string, unknown>)
      : {};
  delete meta.updatedAt;
  delete meta.createdAt;

  const trIn = meta.translations && typeof meta.translations === 'object' ? meta.translations : {};
  const trFlat: Record<string, string> = {};
  for (const k of Object.keys(trIn as object).sort()) {
    const v = (trIn as Record<string, unknown>)[k];
    if (typeof v === 'string') trFlat[k] = v;
  }
  meta.translations = trFlat;

  const fi = meta.flowInterface && typeof meta.flowInterface === 'object' ? meta.flowInterface : {};
  const sortRows = (rows: unknown): unknown[] => {
    if (!Array.isArray(rows)) return [];
    return [...rows].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  };
  meta.flowInterface = {
    input: sortRows((fi as { input?: unknown }).input),
    output: sortRows((fi as { output?: unknown }).output),
  };
  loose.meta = meta;

  const nodes = Array.isArray(loose.nodes) ? [...(loose.nodes as unknown[])] : [];
  loose.nodes = nodes
    .map((node) => {
      const n = typeof node === 'object' && node ? ({ ...(node as object) } as Record<string, unknown>) : {};
      const data =
        n.data && typeof n.data === 'object'
          ? ({ ...(n.data as Record<string, unknown>) } as Record<string, unknown>)
          : {};
      const rows = Array.isArray(data.rows) ? [...(data.rows as unknown[])] : [];
      data.rows = rows.sort((a, b) =>
        String((a as { id?: string }).id || '').localeCompare(String((b as { id?: string }).id || ''))
      );
      n.data = data;
      return n;
    })
    .sort((a, b) =>
      String((a as Record<string, unknown>).id || '').localeCompare(
        String((b as Record<string, unknown>).id || '')
      )
    );

  const edges = Array.isArray(loose.edges) ? [...(loose.edges as unknown[])] : [];
  loose.edges = edges.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));

  return loose as unknown as Flow;
}

/**
 * Subflow canvas has no authoring rows iff every node has no included rows — matches post-prune empty shells.
 */
function childSliceHasAnyIncludedTaskRow(slice: Flow | undefined): boolean {
  if (!slice?.nodes) return false;
  for (const node of slice.nodes as Array<{ data?: { rows?: unknown[] } }>) {
    const rows = Array.isArray(node?.data?.rows) ? node.data.rows : [];
    for (const r of rows) {
      if ((r as { included?: boolean }).included === false) continue;
      const id = String((r as { id?: string }).id || '').trim();
      if (id) return true;
    }
  }
  return false;
}

function bindingVarIdsFromPortal(portalRowId: string): string[] {
  const task = portalRowId ? taskRepository.getTask(portalRowId) : undefined;
  const raw = Array.isArray(task?.subflowBindings) ? task!.subflowBindings! : [];
  const ids: string[] = [];
  for (const b of raw) {
    const p = String((b as { parentVariableId?: string }).parentVariableId || '').trim();
    const i = String((b as { interfaceParameterId?: string }).interfaceParameterId || '').trim();
    if (p) ids.push(p);
    if (i) ids.push(i);
  }
  return sortedUnique(ids);
}

/**
 * Logs structured diffs when roundtrip snapshots disagree (test / debug aid).
 */
export function logMoveContextSnapshotDiff(a: MoveContextSnapshot, b: MoveContextSnapshot): void {
  if (isDeepStrictEqual(a, b)) return;
  if (!isDeepStrictEqual(a.flows, b.flows)) {
    // eslint-disable-next-line no-console
    console.log('DIFF_FLOWS', { before: a.flows, after: b.flows });
  }
  if (!isDeepStrictEqual(a.task, b.task)) {
    // eslint-disable-next-line no-console
    console.log('DIFF_TASK', { before: a.task, after: b.task });
  }
  if (!isDeepStrictEqual(a.variableStore, b.variableStore)) {
    // eslint-disable-next-line no-console
    console.log('DIFF_VARS', { before: a.variableStore, after: b.variableStore });
  }
  if (!isDeepStrictEqual(a.subflowBindings, b.subflowBindings)) {
    // eslint-disable-next-line no-console
    console.log('DIFF_BINDINGS', { before: a.subflowBindings, after: b.subflowBindings });
  }
  if (!isDeepStrictEqual(a.childInterface, b.childInterface)) {
    // eslint-disable-next-line no-console
    console.log('DIFF_INTERFACE', { before: a.childInterface, after: b.childInterface });
  }
}

/**
 * Reads workspace slices, repository, and variable store — does not mutate domain state.
 */
export function captureMoveContextSnapshot(args: {
  projectId: string;
  parentFlowId: string;
  childFlowId: string;
  taskInstanceId: string;
  flows: WorkspaceState['flows'];
}): MoveContextSnapshot {
  const pid = String(args.projectId || '').trim();
  const parentFlowId = String(args.parentFlowId || '').trim();
  const childFlowId = String(args.childFlowId || '').trim();
  const taskInstanceId = String(args.taskInstanceId || '').trim();

  const parentRaw = args.flows[parentFlowId] as Flow | undefined;
  const childRaw = args.flows[childFlowId] as Flow | undefined;

  const parent = canonicalWorkspaceFlowSlice(parentRaw);
  let child = canonicalWorkspaceFlowSlice(childRaw);
  if (!childSliceHasAnyIncludedTaskRow(childRaw)) {
    child = {
      ...child,
      nodes: [],
      edges: [],
    };
  }

  const taskDoc = taskRepository.getTask(taskInstanceId);
  const task = {
    id: taskInstanceId,
    authoringFlowCanvasId: taskDoc?.authoringFlowCanvasId != null ? String(taskDoc.authoringFlowCanvasId) : null,
  };

  const vars = variableCreationService.getVariablesByTaskInstanceId(pid, taskInstanceId);
  const varIds = sortedUnique(vars.map((v) => v.id));

  const mergedTranslations = {
    ...flattenStringTranslations(parentRaw),
    ...flattenStringTranslations(childRaw),
  };

  const byId: Record<string, { scopeFlowId: string; name: string }> = {};
  for (const v of vars) {
    const id = String(v.id || '').trim();
    if (!id) continue;
    byId[id] = {
      scopeFlowId: String(v.scopeFlowId ?? ''),
      name: getVariableLabel(id, mergedTranslations),
    };
  }

  const portalRowId = parseSubflowTaskRowIdFromChildCanvasId(childFlowId) ?? '';

  return {
    flows: { parent, child },
    task,
    variableStore: { varIds, byId },
    subflowBindings: {
      portalRowId,
      bindingVarIds: portalRowId ? bindingVarIdsFromPortal(portalRowId) : [],
    },
    childInterface: {
      inputVarIds: collectInterfaceVarIds(childRaw, 'input'),
      outputVarIds: collectInterfaceVarIds(childRaw, 'output'),
    },
  };
}
