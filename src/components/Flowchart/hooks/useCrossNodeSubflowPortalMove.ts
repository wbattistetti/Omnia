/**
 * When a row is dropped on a node that contains a Subflow task, routes the move into the child
 * flow and runs applyTaskMoveToSubflow (variables, interface, bindings) instead of adding the row
 * as a sibling on the parent canvas.
 */

import { useEffect, useRef } from 'react';
import type { Node } from 'reactflow';
import { useFlowActions, useFlowWorkspace } from '@flows/FlowStore';
import { useProjectData, useProjectDataUpdate } from '@context/ProjectDataContext';
import { applyTaskMoveToSubflow } from '@domain/taskSubflowMove/applyTaskMoveToSubflow';
import type { ProjectConditionLike } from '@domain/taskSubflowMove/collectReferencedVarIds';
import { findFirstSubflowPortalInNode } from '@domain/taskSubflowMove/findSubflowPortal';
import {
  findParentFlowIdContainingSubflowRow,
  parseSubflowTaskRowIdFromChildCanvasId,
} from '@domain/taskSubflowMove/subflowParentLookup';
import type { ApplyTaskMoveToSubflowResult } from '@domain/taskSubflowMove/applyTaskMoveToSubflow';
import { registerSubflowWiringSecondPass } from '@domain/taskSubflowMove/subflowWiringAfterVariableStore';
import { variableCreationService } from '@services/VariableCreationService';
import { logTaskSubflowMove } from '@utils/taskSubflowMoveDebug';
import { logS2Diag } from '@utils/s2WiringDiagnostic';
import { logSubflowCanvasDebug, summarizeFlowSlice } from '@utils/subflowCanvasDebug';
import type { FlowNode } from '../types/flowTypes';
import type { NodeRowData } from '@types/project';

function flattenProjectConditions(projectData: unknown): ProjectConditionLike[] {
  const conditions = (projectData as { conditions?: Array<{ items?: unknown[] }> })?.conditions || [];
  const out: ProjectConditionLike[] = [];
  for (const cat of conditions) {
    for (const item of (cat.items || []) as Array<{ id?: string; _id?: string; expression?: ProjectConditionLike['expression'] }>) {
      const cid = String(item.id || item._id || '').trim();
      if (!cid) continue;
      out.push({ id: cid, expression: item.expression });
    }
  }
  return out;
}

export function useCrossNodeSubflowPortalMove(params: { flowId: string | undefined; nodes: Node<FlowNode>[] }) {
  const { flows } = useFlowWorkspace();
  const { upsertFlow } = useFlowActions();
  const { data: projectData } = useProjectData();
  const { getCurrentProjectId } = useProjectDataUpdate();
  const flowsRef = useRef(flows);
  flowsRef.current = flows;
  const nodesRef = useRef(params.nodes);
  nodesRef.current = params.nodes;

  useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{
        toNodeId: string;
        rowData: NodeRowData;
        _state?: { handled: boolean };
      }>;
      const d = ev.detail;
      if (!d?._state || d._state.handled) return;

      logSubflowCanvasDebug('portal:crossNodeRowMove received', {
        canvasFlowId: params.flowId?.trim() || 'main',
        toNodeId: d.toNodeId,
        rowId: d.rowData?.id,
      });
      logS2Diag('crossNodePortal', 'event crossNodeRowMove', {
        canvasFlowId: params.flowId?.trim() || 'main',
        toNodeId: d.toNodeId,
        rowId: d.rowData?.id,
      });

      const canvasFlowId = params.flowId?.trim() || 'main';
      const toNode = nodesRef.current.find((n) => n.id === d.toNodeId);
      const portal = findFirstSubflowPortalInNode(toNode as { data?: { rows?: unknown[] } });

      /** Shell node inside child subflow canvas (no Subflow-type portal row) — same wiring as portal path. */
      const trySubflowShellPath = (): boolean => {
        if (portal || !toNode) return false;
        if (!canvasFlowId.startsWith('subflow_')) return false;
        const childFlowId = canvasFlowId;
        const portalRowId = parseSubflowTaskRowIdFromChildCanvasId(childFlowId);
        if (!portalRowId) return false;
        const parentFlowId = findParentFlowIdContainingSubflowRow(flowsRef.current, portalRowId) || 'main';
        const pid = String(getCurrentProjectId() || (projectData as { id?: string } | null)?.id || '').trim();
        if (!pid) {
          logTaskSubflowMove('portal:skip', { reason: 'noProjectId', canvasFlowId });
          return false;
        }
        const childSlice = flowsRef.current[childFlowId];
        const subflowDisplayTitle = String(childSlice?.title || '').trim() || 'Subflow';
        const targetNodeId = String(d.toNodeId || '').trim();
        if (!targetNodeId) return false;

        logTaskSubflowMove('portal:dragIntoSubflowShell', {
          canvasFlowId,
          toNodeId: targetNodeId,
          taskInstanceId: d.rowData.id,
          childFlowId,
          parentFlowId,
          parentSubflowTaskRowId: portalRowId,
        });
        logS2Diag('crossNodePortal', 'PATH: subflow shell (già su canvas subflow) — structuralAppend', {
          childFlowId,
          parentFlowId,
          targetNodeId,
          rowId: d.rowData.id,
          portalRowId,
        });

        const conditions = flattenProjectConditions(projectData);

        let result = applyTaskMoveToSubflow({
          projectId: pid,
          parentFlowId,
          childFlowId,
          taskInstanceId: d.rowData.id,
          subflowDisplayTitle,
          parentSubflowTaskRowId: portalRowId,
          flows: flowsRef.current,
          conditions,
          projectData,
          structuralAppend: {
            targetFlowId: childFlowId,
            targetNodeId,
            row: d.rowData,
          },
          deleteUnreferencedTaskVariableRows: true,
        });

        const taskRowId = d.rowData.id;
        let flushed: ApplyTaskMoveToSubflowResult | null = null;
        if (variableCreationService.getVariablesByTaskInstanceId(pid, taskRowId).length === 0) {
          flushed = registerSubflowWiringSecondPass({
            projectId: pid,
            parentFlowId,
            childFlowId,
            taskInstanceId: taskRowId,
            subflowDisplayTitle,
            parentSubflowTaskRowId: portalRowId,
            conditions,
            projectData,
          });
        }
        if (flushed) {
          result = flushed;
          logTaskSubflowMove('portal:secondPassFromVariableStore', { taskInstanceId: taskRowId });
        }

        logTaskSubflowMove('portal:applyResult', {
          referencedCount: result.referencedVarIdsForMovedTask.length,
          unreferencedCount: result.unreferencedVarIdsForMovedTask.length,
          materializationOk: result.taskMaterialization.ok,
          removedUnreferencedRows: result.removedUnreferencedVariableRows,
        });

        const parentNext = result.flowsNext[parentFlowId];
        const childNext = result.flowsNext[childFlowId];

        logSubflowCanvasDebug('portal:flowsNext after applyTaskMoveToSubflow shell (before upsert)', {
          childFlowId,
          ...summarizeFlowSlice(childNext as any, { rowIdsSample: true }),
          parentFlowId,
          parentSummary: summarizeFlowSlice(parentNext as any, { rowIdsSample: true }),
        });

        if (parentNext) upsertFlow(parentNext as any);
        if (childNext) upsertFlow(childNext as any);

        logTaskSubflowMove('portal:upsertFlows', {
          updatedParent: !!parentNext,
          updatedChild: !!childNext,
        });

        setTimeout(() => {
          logSubflowCanvasDebug('portal:workspace snapshot after upsert (shell path)', {
            childFlowId,
            ...summarizeFlowSlice(flowsRef.current[childFlowId] as any, { rowIdsSample: true }),
          });
        }, 0);

        d._state.handled = true;
        return true;
      };

      if (!portal) {
        if (trySubflowShellPath()) {
          return;
        }
        logTaskSubflowMove('portal:skip', { reason: 'noSubflowPortalOnTargetNode', toNodeId: d.toNodeId, canvasFlowId });
        logSubflowCanvasDebug('portal:skip (no subflow portal on target node)', {
          toNodeId: d.toNodeId,
          canvasFlowId,
        });
        return;
      }

      const childSlice = flowsRef.current[portal.childFlowId];
      const childNodes = (childSlice?.nodes as Array<{ id?: string }>) || [];
      const targetNodeId = childNodes.length
        ? String(childNodes[0]?.id || '').trim()
        : '';
      if (childNodes.length && !targetNodeId) {
        logTaskSubflowMove('portal:skip', { reason: 'emptyTargetNodeId', childFlowId: portal.childFlowId });
        return;
      }

      const pid = String(getCurrentProjectId() || (projectData as { id?: string } | null)?.id || '').trim();
      if (!pid) {
        logTaskSubflowMove('portal:skip', { reason: 'noProjectId', canvasFlowId });
        return;
      }

      logTaskSubflowMove('portal:dragIntoSubflow', {
        canvasFlowId,
        toNodeId: d.toNodeId,
        taskInstanceId: d.rowData.id,
        childFlowId: portal.childFlowId,
        targetNodeId,
        parentSubflowTaskRowId: portal.subflowTaskRowId,
      });
      logS2Diag('crossNodePortal', 'PATH: drop su nodo con portal Subflow — structuralAppend', {
        parentFlowId: canvasFlowId,
        childFlowId: portal.childFlowId,
        targetNodeId,
        rowId: d.rowData.id,
        portalRowId: portal.subflowTaskRowId,
      });

      logSubflowCanvasDebug('portal:preApply child slice (workspace)', {
        childFlowId: portal.childFlowId,
        childSliceExists: !!childSlice,
        ...summarizeFlowSlice(childSlice as any, { rowIdsSample: true }),
      });
      logSubflowCanvasDebug('portal:preApply parent slice (workspace)', {
        parentFlowId: canvasFlowId,
        ...summarizeFlowSlice(flowsRef.current[canvasFlowId] as any, { rowIdsSample: true }),
      });

      const conditions = flattenProjectConditions(projectData);
      const subflowDisplayTitle =
        String(childSlice?.title || '').trim() || portal.subflowRowLabel || 'Subflow';

      let result = applyTaskMoveToSubflow({
        projectId: pid,
        parentFlowId: canvasFlowId,
        childFlowId: portal.childFlowId,
        taskInstanceId: d.rowData.id,
        subflowDisplayTitle,
        parentSubflowTaskRowId: portal.subflowTaskRowId,
        flows: flowsRef.current,
        conditions,
        projectData,
        structuralAppend: {
          targetFlowId: portal.childFlowId,
          targetNodeId,
          row: d.rowData,
        },
        deleteUnreferencedTaskVariableRows: true,
      });

      const taskRowId = d.rowData.id;
      let flushed: ApplyTaskMoveToSubflowResult | null = null;
      if (variableCreationService.getVariablesByTaskInstanceId(pid, taskRowId).length === 0) {
        flushed = registerSubflowWiringSecondPass({
          projectId: pid,
          parentFlowId: canvasFlowId,
          childFlowId: portal.childFlowId,
          taskInstanceId: taskRowId,
          subflowDisplayTitle,
          parentSubflowTaskRowId: portal.subflowTaskRowId,
          conditions,
          projectData,
        });
      }
      if (flushed) {
        result = flushed;
        logTaskSubflowMove('portal:secondPassFromVariableStore', { taskInstanceId: taskRowId });
      }

      logTaskSubflowMove('portal:applyResult', {
        referencedCount: result.referencedVarIdsForMovedTask.length,
        unreferencedCount: result.unreferencedVarIdsForMovedTask.length,
        materializationOk: result.taskMaterialization.ok,
        removedUnreferencedRows: result.removedUnreferencedVariableRows,
      });

      const parentNext = result.flowsNext[canvasFlowId];
      const childNext = result.flowsNext[portal.childFlowId];

      logSubflowCanvasDebug('portal:flowsNext after applyTaskMoveToSubflow (before upsert)', {
        childFlowId: portal.childFlowId,
        ...summarizeFlowSlice(childNext as any, { rowIdsSample: true }),
        parentFlowId: canvasFlowId,
        parentSummary: summarizeFlowSlice(parentNext as any, { rowIdsSample: true }),
      });

      if (parentNext) upsertFlow(parentNext as any);
      if (childNext) upsertFlow(childNext as any);

      logTaskSubflowMove('portal:upsertFlows', {
        updatedParent: !!parentNext,
        updatedChild: !!childNext,
      });

      const childFid = portal.childFlowId;
      setTimeout(() => {
        logSubflowCanvasDebug('portal:workspace snapshot after upsert (next task; React may have committed)', {
          childFlowId: childFid,
          ...summarizeFlowSlice(flowsRef.current[childFid] as any, { rowIdsSample: true }),
        });
      }, 0);

      d._state.handled = true;
    };

    window.addEventListener('crossNodeRowMove', handler, true);
    return () => window.removeEventListener('crossNodeRowMove', handler, true);
  }, [params.flowId, projectData, getCurrentProjectId, upsertFlow]);
}
