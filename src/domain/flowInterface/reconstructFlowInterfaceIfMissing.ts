/**
 * Vista Interfaccia sottoflusso: deriva solo da VariableCreationService (scope flow) + binding S2 sul parent.
 * Nessuna persistenza dedicata; errori espliciti se i dati sono incoerenti.
 */

import type { Flow } from '@flows/FlowTypes';
import type { Task } from '@types/taskTypes';
import type { VariableInstance } from '@types/variableTypes';
import { createMappingEntry, type MappingEntry } from '@components/FlowMappingPanel/mappingTypes';
import { variableCreationService } from '@services/VariableCreationService';
import { getVariableLabel } from '@utils/getVariableLabel';

export type FlowModel = Flow;

export type TaskModel = Pick<Task, 'subflowBindings'>;

export type FlowInterface = {
  input: MappingEntry[];
  output: MappingEntry[];
};

function requireNonEmptyLabel(id: string, label: string, context: string): string {
  const t = String(label || '').trim();
  if (!t) {
    throw new Error(`${context}: missing label for variable ${id}`);
  }
  return t;
}

function mappingEntryForVariable(
  variableRefId: string,
  label: string
): MappingEntry {
  const l = String(label || '').trim() || variableRefId;
  return createMappingEntry({
    internalPath: l,
    variableRefId,
    externalName: l,
    linkedVariable: l,
    apiField: '',
  });
}

/**
 * Variabili nello scope del canvas (allineato a {@link variableCreationService.getVariablesForFlowScope};
 * `workspaceFlows` evita lag tra FlowStore e {@link FlowWorkspaceSnapshot}).
 */
export function getVisibleVariableInstancesForFlow(
  projectId: string,
  flowCanvasId: string,
  workspaceFlows: Record<string, Flow>
): VariableInstance[] {
  const pid = String(projectId || '').trim();
  const fid = String(flowCanvasId || '').trim();
  if (!pid || !fid) return [];
  return variableCreationService.getVariablesForFlowScope(pid, fid, workspaceFlows);
}

/** Gating per UI Interfaccia sottoflusso: nessun build finché load e idratazione variabili non sono completati. */
export function canBuildSubflowInterfaceFromFlowSlice(flow: Flow | undefined | null): boolean {
  return flow?.hydrated === true && flow?.variablesReady === true;
}

/**
 * Solo OUTPUT: stesse righe della vista “output” del sottoflusso (scope child).
 */
export function buildOutputMappingEntriesForChildFlow(
  projectId: string,
  childFlowId: string,
  workspaceFlows: Record<string, Flow>,
  translations: Record<string, string> | null | undefined
): MappingEntry[] {
  const visible = getVisibleVariableInstancesForFlow(projectId, childFlowId, workspaceFlows);
  const out: MappingEntry[] = [];
  for (const inst of visible) {
    const id = String(inst.id || '').trim();
    if (!id) continue;
    const label = requireNonEmptyLabel(
      id,
      getVariableLabel(id, translations, inst.varName),
      'buildOutputMappingEntriesForChildFlow'
    );
    out.push(mappingEntryForVariable(id, label));
  }
  return out;
}

export type BuildSubflowInterfaceViewParams = {
  projectId: string;
  childFlowId: string;
  /** Task Subflow sul parent; se assente, INPUT = [] (solo OUTPUT da scope child). */
  subflowTask?: TaskModel | null;
  translations: Record<string, string> | null | undefined;
  workspaceFlows: Record<string, Flow>;
};

/**
 * INPUT: una riga per ogni binding S2 (ordine preservato). OUTPUT: tutte le variabili visibili sul child.
 * Se un `interfaceParameterId` non è tra le variabili visibili sul child → errore (nessun dato inventato).
 */
export function buildSubflowInterfaceView(params: BuildSubflowInterfaceViewParams): FlowInterface {
  const { projectId, childFlowId, subflowTask, translations, workspaceFlows } = params;
  const pid = String(projectId || '').trim();
  const fid = String(childFlowId || '').trim();
  if (!pid || !fid) {
    throw new Error('buildSubflowInterfaceView: projectId and childFlowId are required');
  }

  const visible = variableCreationService.getVariablesForFlowScope(pid, fid, workspaceFlows);
  const byId = new Map(visible.map((v) => [String(v.id || '').trim(), v]));

  const output: MappingEntry[] = [];
  for (const inst of visible) {
    const id = String(inst.id || '').trim();
    if (!id) continue;
    const label = requireNonEmptyLabel(
      id,
      getVariableLabel(id, translations, inst.varName),
      'buildSubflowInterfaceView.output'
    );
    output.push(mappingEntryForVariable(id, label));
  }

  const bindings = Array.isArray(subflowTask?.subflowBindings) ? subflowTask.subflowBindings : [];
  const input: MappingEntry[] = [];
  for (const b of bindings) {
    const iid = String(b?.interfaceParameterId || '').trim();
    if (!iid) {
      throw new Error('buildSubflowInterfaceView: binding with empty interfaceParameterId');
    }
    const inst = byId.get(iid);
    if (!inst) {
      throw new Error(
        `buildSubflowInterfaceView: interfaceParameterId "${iid}" is not in VariableCreationService.getVariablesForFlowScope for child flow "${fid}"`
      );
    }
    const label = requireNonEmptyLabel(
      iid,
      getVariableLabel(iid, translations, inst.varName),
      'buildSubflowInterfaceView.input'
    );
    input.push(mappingEntryForVariable(iid, label));
  }

  return { input, output };
}
