/**
 * Applica la scelta utente su un edge nuovo: label sul grafo, poi nodo temp visibile subito;
 * per testo libero l’I/O condizioni (async) avviene dopo il reveal così la UI non aspetta il server.
 */

import type { EdgeLinkChoice } from './edgeLinkChoice';
import { FlowStateBridge } from '../../services/FlowStateBridge';
import { mergeEdgePatch } from '../Flowchart/utils/mergeEdgePatch';
import type { EdgeData } from '../Flowchart/types/flowTypes';
import type { Edge } from 'reactflow';
import { generateId } from '../../utils/idGenerator';
import { TaskType } from '../../types/taskTypes';

export type ProjectDataConditionsShape = {
  conditions?: Array<{ id?: string; items?: Array<{ id?: string; _id?: string; name?: string; label?: string }> }>;
};

export type ApplyEdgeLinkPipelineDeps = {
  projectData: ProjectDataConditionsShape | undefined;
  addItem: (category: string, categoryId: string, name: string, value: string) => Promise<void>;
  addCategory: (category: string, name: string) => Promise<void>;
};

function buildExtraData(conditionId: string | undefined, isElse: boolean): Record<string, unknown> | undefined {
  const extra: Record<string, unknown> = {};
  if (conditionId) extra.conditionId = conditionId;
  if (isElse) {
    extra.isElse = true;
    extra.conditionId = undefined;
  }
  return Object.keys(extra).length > 0 ? extra : undefined;
}

/** Applica label + data merged sull’edge (schedule o setEdges diretto). */
function applyEdgeLabelToGraph(
  edgeId: string,
  label: string | undefined,
  isElse: boolean,
  conditionId: string | undefined
): void {
  const scheduleApplyLabel = FlowStateBridge.getScheduleApplyLabel();
  const setEdges = FlowStateBridge.getSetEdges();
  const extra = buildExtraData(conditionId, isElse);

  if (scheduleApplyLabel && label !== undefined) {
    scheduleApplyLabel(edgeId, label, extra as any);
  } else if (setEdges) {
    setEdges((eds: any[]) =>
      eds.map((e) => {
        if (e.id !== edgeId) return e;
        return {
          ...e,
          label,
          data: {
            ...(e.data || {}),
            label,
            isElse,
            conditionId: conditionId || (e.data as any)?.conditionId,
          },
        };
      })
    );
  }
}

/** Aggiorna solo `data.conditionId` sull’edge (dopo creazione condizione async). */
function patchEdgeConditionId(edgeId: string, conditionId: string): void {
  const setEdges = FlowStateBridge.getSetEdges();
  if (!setEdges) return;
  setEdges((eds: any[]) =>
    eds.map((e: Edge<EdgeData>) =>
      e.id === edgeId ? mergeEdgePatch(e, { conditionId }) : e
    )
  );
}

/**
 * Cerca o crea una condizione per il testo digitato; ritorna conditionId se disponibile.
 */
async function resolveConditionIdForFreeText(
  customText: string,
  deps: ApplyEdgeLinkPipelineDeps
): Promise<string | undefined> {
  const { projectData, addItem, addCategory } = deps;
  const conditions = projectData?.conditions || [];
  for (const cat of conditions) {
    for (const condItem of cat.items || []) {
      const condName = String(condItem?.name || condItem?.label || '').trim();
      if (condName.toLowerCase() === customText.toLowerCase()) {
        return condItem.id || condItem._id;
      }
    }
  }

  try {
    let categoryId = conditions.length > 0 ? conditions[0].id : '';
    if (!categoryId) {
      await addCategory('conditions', 'Default Conditions');
      const { ProjectDataService } = await import('../../services/ProjectDataService');
      const refreshed = await ProjectDataService.loadProjectData();
      categoryId = (refreshed as ProjectDataConditionsShape)?.conditions?.[0]?.id || '';
    }

    if (categoryId) {
      await addItem('conditions', categoryId, customText, '');
      const { ProjectDataService } = await import('../../services/ProjectDataService');
      const refreshed = await ProjectDataService.loadProjectData();
      const created = (refreshed as ProjectDataConditionsShape)?.conditions?.[0]?.items?.find(
        (i) => i.name === customText
      );
      const id = created?.id || created?._id;
      const { emitSidebarForceRender } = await import('../../ui/events');
      emitSidebarForceRender();
      setTimeout(async () => {
        try {
          (await import('../../ui/events')).emitSidebarHighlightItem('conditions', customText);
        } catch {
          /* ignore */
        }
      }, 100);
      return id;
    }
  } catch (e) {
    console.error('[edgeLinkPipeline] Error creating condition:', e);
  }
  return undefined;
}

/** Mostra il nodo target temporaneo (hidden: false). Deve restare sync per percepire risposta immediata. */
function revealTempTargetNode(targetNodeId: string | null, isUnconditional: boolean): void {
  const setNodes = FlowStateBridge.getSetNodes();
  if (!setNodes || !targetNodeId) return;

  setNodes((nds: any[]) =>
    nds.map((n) => {
      if (n.id !== targetNodeId) return n;
      if (isUnconditional) {
        const newRowId = generateId();
        return {
          ...n,
          data: {
            ...n.data,
            hidden: false,
            rows: [
              ...(n.data?.rows || []),
              {
                id: newRowId,
                text: '',
                included: true,
                heuristics: { type: TaskType.Subflow, templateId: null },
              },
            ],
            focusRowId: newRowId,
          },
        };
      }
      return { ...n, data: { ...n.data, hidden: false } };
    })
  );
}

/**
 * Applica `choice` all’edge `edgeId` e aggiorna il nodo temporaneo se presente.
 */
export async function applyEdgeLinkPipeline(
  edgeId: string,
  choice: EdgeLinkChoice,
  deps: ApplyEdgeLinkPipelineDeps
): Promise<void> {
  const targetNodeId = FlowStateBridge.getLastTempNodeId();
  FlowStateBridge.setLastTempNodeId(null);

  let label: string | undefined;
  let isElse = false;
  let conditionId: string | undefined;
  let isUnconditional = false;

  switch (choice.kind) {
    case 'else':
      label = 'Else';
      isElse = true;
      applyEdgeLabelToGraph(edgeId, label, isElse, undefined);
      break;
    case 'unlinked':
      label = undefined;
      isUnconditional = true;
      applyEdgeLabelToGraph(edgeId, label, false, undefined);
      break;
    case 'catalog':
      label = choice.item.label;
      conditionId = choice.item.taskId || choice.item.id;
      applyEdgeLabelToGraph(edgeId, label, false, conditionId);
      break;
    case 'freeText': {
      const customText = (choice.text || '').trim() || 'Condition';
      label = customText;
      applyEdgeLabelToGraph(edgeId, label, false, undefined);
      revealTempTargetNode(targetNodeId, false);
      const resolved = await resolveConditionIdForFreeText(customText, deps);
      if (resolved) {
        patchEdgeConditionId(edgeId, resolved);
      }
      return;
    }
  }

  revealTempTargetNode(targetNodeId, isUnconditional);
}
