/**
 * Builds a FlowDocument from the current editor state and in-memory stores (authoritative snapshot for save).
 */

import type { FlowId, WorkspaceState } from '@flows/FlowTypes';
import type { Node } from 'reactflow';
import type { FlowNode } from '@components/Flowchart/types/flowTypes';
import { transformNodesToSimplified, transformEdgesToSimplified } from '@flows/flowTransformers';
import { taskRepository } from '@services/TaskRepository';
import { variableCreationService } from '@services/VariableCreationService';
import type { Task } from '@types/taskTypes';
import type { FlowDocument, FlowSubflowBindingPersisted } from './FlowDocument';
import { FLOW_DOCUMENT_VERSION } from './FlowDocument';
import { mappingEntriesToPersistedInput, mappingEntriesToPersistedOutput } from './flowInterfaceAdapters';
import type { MappingEntry } from '@components/FlowMappingPanel/mappingTypes';
import { getTaskInstanceIdsOnFlowCanvasFromFlows } from '@utils/variableScopeUtils';

function collectTasksForFlow(flowId: FlowId, flows: WorkspaceState['flows']): Task[] {
  const ids = getTaskInstanceIdsOnFlowCanvasFromFlows(flowId, flows);
  const out: Task[] = [];
  for (const tid of ids) {
    const t = taskRepository.getTask(tid);
    if (t) out.push(t);
  }
  return out;
}

/** Aggregates `subflowBindings` from Subflow tasks on this canvas for export / persistence. */
function collectSubflowBindingsFromTasks(tasks: Task[]): FlowSubflowBindingPersisted[] {
  const seen = new Set<string>();
  const out: FlowSubflowBindingPersisted[] = [];
  for (const t of tasks) {
    const bindings = t.subflowBindings;
    if (!Array.isArray(bindings)) continue;
    for (const b of bindings) {
      const interfaceParameterId = String(b?.interfaceParameterId ?? '').trim();
      const parentVariableId = String(b?.parentVariableId ?? '').trim();
      if (!interfaceParameterId || !parentVariableId) continue;
      const key = `${interfaceParameterId}\0${parentVariableId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ interfaceParameterId, parentVariableId });
    }
  }
  return out;
}

export function buildFlowDocumentFromFlowSlice(
  projectId: string,
  flowId: FlowId,
  flows: WorkspaceState['flows'],
  reactNodes: Node<FlowNode>[],
  reactEdges: any[]
): FlowDocument {
  const pid = String(projectId || '').trim();
  const fid = String(flowId || '').trim();
  if (!pid || !fid) {
    throw new Error('buildFlowDocumentFromFlowSlice: projectId and flowId required');
  }
  const flow = flows[fid];
  if (!flow) {
    throw new Error(`buildFlowDocumentFromFlowSlice: missing flow slice ${fid}`);
  }

  const nodes = transformNodesToSimplified(reactNodes);
  const edges = transformEdgesToSimplified(reactEdges);
  const tr = flow.meta?.translations ?? {};
  const ifaceIn = (flow.meta?.flowInterface?.input ?? []) as MappingEntry[];
  const ifaceOut = (flow.meta?.flowInterface?.output ?? []) as MappingEntry[];
  const tasks = collectTasksForFlow(fid, flows);
  const variables = variableCreationService.getVariablesForFlowScope(pid, fid, flows);
  const bindings = collectSubflowBindingsFromTasks(tasks);

  return {
    id: fid,
    projectId: pid,
    version: FLOW_DOCUMENT_VERSION,
    nodes,
    edges,
    meta: {
      flowInterface: {
        input: mappingEntriesToPersistedInput(ifaceIn),
        output: mappingEntriesToPersistedOutput(ifaceOut),
      },
      translations: { ...tr },
      settings: flow.meta?.settings,
    },
    tasks,
    variables,
    bindings,
  };
}
