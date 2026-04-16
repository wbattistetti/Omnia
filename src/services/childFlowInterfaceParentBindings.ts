/**
 * Elenco dei punti nel workspace in cui un parametro di interfaccia del flow figlio (sottoflusso)
 * è cablato lato parent tramite S2 `subflowBindings` (interfaceParameterId → parentVariableId).
 */

import type { WorkspaceState } from '../flows/FlowTypes';
import { taskRepository } from './TaskRepository';
import { TaskType } from '../types/taskTypes';

function extractRows(node: { data?: { rows?: unknown[] } }): unknown[] {
  const rows = node?.data?.rows;
  return Array.isArray(rows) ? rows : [];
}

function resolveSubflowId(task: {
  flowId?: string;
  parameters?: Array<{ parameterId?: string; value?: string }>;
}): string | null {
  const direct = String(task?.flowId || '').trim();
  if (direct) return direct;
  const params = Array.isArray(task?.parameters) ? task.parameters : [];
  const fromParam = params.find((p) => String(p?.parameterId || '').trim() === 'flowId');
  return String(fromParam?.value || '').trim() || null;
}

export type ParentInterfaceBindingSite = {
  parentFlowId: string;
  parentFlowTitle: string;
  canvasNodeId: string;
  subflowTaskId: string;
};

/**
 * Ritorna un elemento per ogni task Subflow nel workspace che punta a `childFlowId` e ha un binding S2
 * per `childVariableId` con `parentVariableId` non vuoto.
 */
export function collectParentBindingSitesForChildInterfaceVariable(
  childFlowId: string,
  childVariableId: string,
  flows: WorkspaceState['flows']
): ParentInterfaceBindingSite[] {
  const cf = String(childFlowId || '').trim();
  const cv = String(childVariableId || '').trim();
  if (!cf || !cv) return [];

  const out: ParentInterfaceBindingSite[] = [];
  const seen = new Set<string>();

  for (const [parentFlowId, f] of Object.entries(flows || {})) {
    const flow = f as { title?: string; nodes?: unknown[] };
    const flowTitle = String(flow?.title || parentFlowId).trim() || parentFlowId;
    for (const node of flow.nodes || []) {
      const n = node as { id?: string };
      const canvasNodeId = String(n?.id || '').trim();
      if (!canvasNodeId) continue;
      for (const row of extractRows(node as { data?: { rows?: unknown[] } })) {
        const r = row as { id?: string };
        const tid = String(r?.id || '').trim();
        if (!tid) continue;
        const task = taskRepository.getTask(tid);
        if (!task || task.type !== TaskType.Subflow) continue;
        const fid = resolveSubflowId(task);
        if (fid !== cf) continue;
        const bindings = Array.isArray((task as { subflowBindings?: unknown }).subflowBindings)
          ? (task as { subflowBindings: Array<{ interfaceParameterId?: string; parentVariableId?: string }> })
              .subflowBindings
          : [];
        const b = bindings.find((x) => String(x?.interfaceParameterId || '').trim() === cv);
        const parentVar = b ? String(b?.parentVariableId || '').trim() : '';
        if (!parentVar) continue;
        const dedupe = `${parentFlowId}::${canvasNodeId}::${tid}`;
        if (seen.has(dedupe)) continue;
        seen.add(dedupe);
        out.push({
          parentFlowId,
          parentFlowTitle: flowTitle,
          canvasNodeId,
          subflowTaskId: tid,
        });
      }
    }
  }
  return out;
}
