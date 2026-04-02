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

      const canvasFlowId = params.flowId?.trim() || 'main';
      const toNode = nodesRef.current.find((n) => n.id === d.toNodeId);
      const portal = findFirstSubflowPortalInNode(toNode as { data?: { rows?: unknown[] } });
      if (!portal) return;

      const childSlice = flowsRef.current[portal.childFlowId];
      const childNodes = (childSlice?.nodes as Array<{ id?: string }>) || [];
      if (!childNodes.length) return;

      const targetNodeId = String(childNodes[0]?.id || '').trim();
      if (!targetNodeId) return;

      const pid = String(getCurrentProjectId() || (projectData as { id?: string } | null)?.id || '').trim();
      if (!pid) return;

      const conditions = flattenProjectConditions(projectData);

      const result = applyTaskMoveToSubflow({
        projectId: pid,
        parentFlowId: canvasFlowId,
        childFlowId: portal.childFlowId,
        taskInstanceId: d.rowData.id,
        subflowDisplayTitle: String(childSlice?.title || '').trim() || portal.subflowRowLabel || 'Subflow',
        parentSubflowTaskRowId: portal.subflowTaskRowId,
        flows: flowsRef.current,
        conditions,
        projectData,
        structuralAppend: {
          targetFlowId: portal.childFlowId,
          targetNodeId,
          row: d.rowData,
        },
      });

      const parentNext = result.flowsNext[canvasFlowId];
      const childNext = result.flowsNext[portal.childFlowId];
      if (parentNext) upsertFlow(parentNext as any);
      if (childNext) upsertFlow(childNext as any);

      d._state.handled = true;
    };

    window.addEventListener('crossNodeRowMove', handler, true);
    return () => window.removeEventListener('crossNodeRowMove', handler, true);
  }, [params.flowId, projectData, getCurrentProjectId, upsertFlow]);
}
