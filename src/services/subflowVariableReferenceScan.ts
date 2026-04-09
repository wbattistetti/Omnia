/**
 * Detects bracket-token references to a parent variable GUID (Subflow binding target) across the project.
 * Only `[guid]` tokens count (not label-based legacy). Used before removing a Subflow interface output row.
 */

import { taskRepository } from './TaskRepository';
import type { WorkspaceState } from '../flows/FlowTypes';
import { TaskType } from '../types/taskTypes';

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Bracket token whose inner text is exactly the variable GUID. */
function bracketPatternForGuid(varId: string): RegExp {
  return new RegExp(`\\[\\s*${escapeRegExp(String(varId || '').trim())}\\s*\\]`, 'gi');
}

function getTranslationsFromWindow(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const t = (window as unknown as { __projectTranslationsContext?: { translations?: Record<string, string> } })
      .__projectTranslationsContext?.translations;
    return t && typeof t === 'object' ? t : {};
  } catch {
    return {};
  }
}

export type ReferenceLocation = {
  kind: 'translation' | 'task' | 'flow' | 'condition';
  /** Stable id: translation key, task id, flow id, or condition id */
  id: string;
  /** Short label for UI (deduped by kind+id) */
  label: string;
};

export type InterfaceOutputRemovalBlockReason = {
  ok: false;
  references: ReferenceLocation[];
  parentVarId: string;
};

/**
 * Finds all distinct locations (kind+id) where `parentVarId` appears as a `[guid]` token.
 * Scans: translation strings, task JSON, flow JSON, optional condition payloads.
 */
export function findParentVarGuidReferences(
  parentVarId: string,
  flows: WorkspaceState['flows'],
  options?: {
    translations?: Record<string, string>;
    conditionPayloads?: Array<{ id: string; label: string; text: string }>;
  }
): ReferenceLocation[] {
  const vid = String(parentVarId || '').trim();
  if (!vid) return [];
  const re = bracketPatternForGuid(vid);

  const translationsMap =
    options?.translations !== undefined ? options.translations : getTranslationsFromWindow();

  const seen = new Set<string>();
  const out: ReferenceLocation[] = [];

  const push = (kind: ReferenceLocation['kind'], id: string, label: string) => {
    const key = `${kind}:${id}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ kind, id, label });
  };

  for (const [key, text] of Object.entries(translationsMap)) {
    if (!key) continue;
    if (re.test(String(text ?? ''))) {
      push('translation', key, `Traduzione ${key.slice(0, 10)}…`);
    }
    re.lastIndex = 0;
  }

  for (const t of taskRepository.getAllTasks()) {
    if (re.test(JSON.stringify(t))) {
      push('task', t.id, `Task ${String(t.id).slice(0, 12)}…`);
    }
    re.lastIndex = 0;
  }

  for (const fid of Object.keys(flows || {})) {
    const f = flows[fid];
    if (re.test(JSON.stringify(f))) {
      push('flow', fid, `Flow ${fid}`);
    }
    re.lastIndex = 0;
  }

  for (const c of options?.conditionPayloads || []) {
    if (re.test(c.text)) {
      push('condition', c.id, c.label || `Condizione ${c.id.slice(0, 10)}…`);
    }
    re.lastIndex = 0;
  }

  return out;
}

/**
 * @deprecated Use findParentVarGuidReferences; kept for subflowProjectSync orphan removal.
 */
export function projectHasBracketReferenceToVarId(
  _projectId: string,
  varId: string,
  flows: WorkspaceState['flows'],
  translationsMap?: Record<string, string>
): boolean {
  return findParentVarGuidReferences(varId, flows, { translations: translationsMap }).length > 0;
}

/**
 * Collect parent variable ids (S2 subflowBindings parentVariableId) for a child interface output variableRefId.
 */
export function collectParentVariableIdsForChildOutput(
  childFlowId: string,
  childOutputVarId: string,
  flows: WorkspaceState['flows']
): string[] {
  const cf = String(childFlowId || '').trim();
  const childVar = String(childOutputVarId || '').trim();
  if (!cf || !childVar) return [];

  const out: string[] = [];

  for (const f of Object.values(flows || {})) {
    for (const node of (f as any)?.nodes || []) {
      for (const row of node?.data?.rows || []) {
        const tid = String(row?.id || '').trim();
        if (!tid) continue;
        const task = taskRepository.getTask(tid);
        if (!task || task.type !== TaskType.Subflow) continue;
        const direct = String((task as any)?.flowId || '').trim();
        const params = Array.isArray((task as any)?.parameters) ? (task as any).parameters : [];
        const fromParam = params.find((p: any) => String(p?.parameterId || '').trim() === 'flowId');
        const fid = direct || String(fromParam?.value || '').trim();
        if (fid !== cf) continue;
        const bindings = Array.isArray((task as any).subflowBindings) ? (task as any).subflowBindings : [];
        const b = bindings.find(
          (x: any) => String(x?.interfaceParameterId || '').trim() === childVar
        );
        const parentId = b ? String(b?.parentVariableId || '').trim() : '';
        if (parentId) out.push(parentId);
      }
    }
  }
  return out;
}

/**
 * If removing this interface output would leave parent variables (S2 binding targets) referenced as `[guid]` in the project, returns block with locations.
 */
export function validateRemovalOfInterfaceOutputRow(
  projectId: string,
  childFlowId: string,
  childOutputVariableRefId: string,
  flows: WorkspaceState['flows'],
  translationsMap: Record<string, string>,
  conditionPayloads?: Array<{ id: string; label: string; text: string }>
): { ok: true } | InterfaceOutputRemovalBlockReason {
  const pid = String(projectId || '').trim();
  const cid = String(childOutputVariableRefId || '').trim();
  if (!pid || !cid) return { ok: true };

  const parentIds = collectParentVariableIdsForChildOutput(childFlowId, cid, flows);
  if (parentIds.length === 0) return { ok: true };

  const merged = new Map<string, ReferenceLocation>();
  for (const parentVarId of parentIds) {
    for (const r of findParentVarGuidReferences(parentVarId, flows, {
      translations: translationsMap,
      conditionPayloads,
    })) {
      merged.set(`${r.kind}:${r.id}`, r);
    }
  }

  if (merged.size === 0) return { ok: true };

  return {
    ok: false,
    references: [...merged.values()],
    parentVarId: parentIds[0]!,
  };
}
