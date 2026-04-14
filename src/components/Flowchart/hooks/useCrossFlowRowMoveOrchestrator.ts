/**
 * Capture-phase handler: must be registered **before** {@link useCrossNodeSubflowPortalMove} in
 * {@link FlowEditor} so it runs first on `crossNodeRowMove`. Resolves source/target flow ids from the
 * workspace graph (node membership), not the active canvas under the pointer. Same-flow cross-node
 * moves also run here (structural `moveTaskRow`) except when the target node is a Subflow portal —
 * then {@link useCrossNodeSubflowPortalMove} handles the event. Sets `detail._state.handled` so
 * {@link CustomNode} skips duplicate row merge when the store was already updated.
 *
 * **Coordination:** {@link useNodeDragDrop} dispatches `crossNodeRowMove` **synchronously** (capture
 * handlers run first), then updates local source rows; `updateNode` on the source is skipped when
 * `flowStoreCommitOk` so the store remains authoritative after a successful upsert.
 */

import { useEffect } from 'react';
import type { ApplyTaskMoveToSubflowResult } from '@domain/taskSubflowMove/applyTaskMoveToSubflow';
import { normalizeFlowCanvasId } from '@components/FlowMappingPanel/flowInterfaceDragTypes';
import { resolveFlowIdForNodeWithCanvasHint } from '@domain/taskSubflowMove/findFlowIdForNode';
import { findFirstSubflowPortalInNode } from '@domain/taskSubflowMove/findSubflowPortal';
import { getSubflowSyncFlows } from '@domain/taskSubflowMove/subflowSyncFlowsRef';
import {
  createDefaultStructuralOrchestratorContext,
  runStructuralCommandSync,
} from '@domain/structural/StructuralOrchestrator';
import { newCommandId } from '@domain/structural/commands';
import { resolveStructuralProjectId } from '@domain/structural/resolveStructuralProjectId';
import { logTaskSubflowMove } from '@utils/taskSubflowMoveDebug';

type CrossNodeDetail = {
  fromNodeId?: string;
  toNodeId?: string;
  rowData?: { id?: string };
  fromFlowId?: string;
  toFlowId?: string;
  fromFlowCanvasId?: string;
  toFlowCanvasId?: string;
  _state?: { handled: boolean };
};

export function useCrossFlowRowMoveOrchestrator(params: {
  projectId?: string | undefined;
  projectData?: unknown;
}) {
  const { projectId, projectData } = params;
  useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<CrossNodeDetail>;
      const d = ev.detail;
      if (!d?._state || d._state.handled) return;

      const fromNode = String(d.fromNodeId || '').trim();
      const toNode = String(d.toNodeId || '').trim();
      const rowId = String(d.rowData?.id || '').trim();
      if (!fromNode || !toNode || !rowId) return;

      const flows = getSubflowSyncFlows();
      const fromHint =
        normalizeFlowCanvasId(d.fromFlowId ?? d.fromFlowCanvasId ?? '').trim() || 'main';
      const toHint = normalizeFlowCanvasId(d.toFlowId ?? d.toFlowCanvasId ?? '').trim() || 'main';

      let fromResolved =
        resolveFlowIdForNodeWithCanvasHint(flows, fromNode, d.fromFlowCanvasId ?? d.fromFlowId) ??
        fromHint;
      let toResolved =
        resolveFlowIdForNodeWithCanvasHint(flows, toNode, d.toFlowCanvasId ?? d.toFlowId) ?? toHint;

      /** Same canvas id on graph (e.g. duplicate node id in two slices) — trust drag hints. */
      if (fromResolved === toResolved && fromHint !== toHint) {
        fromResolved = fromHint;
        toResolved = toHint;
      }

      logTaskSubflowMove('crossFlow:detected', { fromFlowId: fromHint, toFlowId: toHint });
      logTaskSubflowMove('crossFlow:normalized', { fromFlowId: fromResolved, toFlowId: toResolved });

      /** Same flow: cross-node row move must use structural graph mutation (not only CustomNode merge). */
      if (fromResolved === toResolved) {
        if (fromNode === toNode) return;
        const flowSlice = flows[fromResolved];
        const targetRfNode = flowSlice?.nodes?.find((n: { id?: string }) => String(n?.id || '').trim() === toNode);
        if (targetRfNode && findFirstSubflowPortalInNode(targetRfNode as { data?: { rows?: unknown[] } })) {
          logTaskSubflowMove('orchestrator:sameFlowSkipForSubflowPortal', { toNodeId: toNode });
          return;
        }
      }

      if (fromResolved === toResolved) {
        const pid = resolveStructuralProjectId(projectId, projectData);
        if (!pid) {
          logTaskSubflowMove('orchestrator:crossFlowRowMoveSkipped', { reason: 'noProjectId' });
          return;
        }

        const base = createDefaultStructuralOrchestratorContext(pid);
        const ctx = {
          ...base,
          projectData: projectData !== undefined ? projectData : base.projectData,
        };

        const out = runStructuralCommandSync(ctx, {
          type: 'moveTaskRow',
          commandId: newCommandId(),
          source: 'dnd',
          rowId,
          fromFlowId: fromResolved,
          toFlowId: toResolved,
          fromNodeId: fromNode,
          toNodeId: toNode,
        }) as ApplyTaskMoveToSubflowResult | void;

        if (out?.flowStoreCommitOk === true) {
          d._state.handled = true;
          logTaskSubflowMove('orchestrator:sameFlowCrossNodeHandled', {
            rowId,
            flowId: fromResolved,
            fromNodeId: fromNode,
            toNodeId: toNode,
          });
        } else {
          logTaskSubflowMove('orchestrator:sameFlowCrossNodeNotHandled', {
            reason: 'flowStoreCommitMissing',
            rowId,
            flowId: fromResolved,
          });
        }
        return;
      }

      const pid = resolveStructuralProjectId(projectId, projectData);
      if (!pid) {
        logTaskSubflowMove('orchestrator:crossFlowRowMoveSkipped', { reason: 'noProjectId' });
        return;
      }

      const base = createDefaultStructuralOrchestratorContext(pid);
      const ctx = {
        ...base,
        projectData: projectData !== undefined ? projectData : base.projectData,
      };

      const out = runStructuralCommandSync(ctx, {
        type: 'moveTaskRow',
        commandId: newCommandId(),
        source: 'dnd',
        rowId,
        fromFlowId: fromResolved,
        toFlowId: toResolved,
        fromNodeId: fromNode,
        toNodeId: toNode,
      }) as ApplyTaskMoveToSubflowResult | void;

      if (out?.flowStoreCommitOk === true) {
        d._state.handled = true;
        logTaskSubflowMove('orchestrator:crossFlowRowMoveHandled', {
          rowId,
          fromFlowId: fromResolved,
          toFlowId: toResolved,
        });
      } else {
        logTaskSubflowMove('orchestrator:crossFlowRowMoveNotHandled', {
          reason: 'flowStoreCommitMissing',
          rowId,
          fromFlowId: fromResolved,
          toFlowId: toResolved,
        });
      }
    };

    window.addEventListener('crossNodeRowMove', handler, true);
    return () => window.removeEventListener('crossNodeRowMove', handler, true);
  }, [projectId, projectData]);
}
