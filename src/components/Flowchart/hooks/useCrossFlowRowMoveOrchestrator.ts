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
import { scheduleCommittedFlowNodeRowsSync } from '@utils/committedFlowSliceNodeRows';
import { FLOW_GRAPH_MIGRATION } from '@domain/flowGraph/flowGraphMigrationConfig';
import { logTaskSubflowMove } from '@utils/taskSubflowMoveDebug';
import { dropTargetsSubflowPortalRow } from '@components/Flowchart/utils/crossNodeRowDropHitTest';

type CrossNodeDetail = {
  fromNodeId?: string;
  toNodeId?: string;
  rowData?: { id?: string };
  fromFlowId?: string;
  toFlowId?: string;
  fromFlowCanvasId?: string;
  toFlowCanvasId?: string;
  /** Drop position in target node's rows (from DOM hit-test); omit = append. */
  targetRowInsertIndex?: number;
  /**
   * From {@link resolveCrossNodeDropHitTest}: row under pointer, region (portal vs normal row vs chrome).
   * Portal drops defer to {@link useCrossNodeSubflowPortalMove}; other hits use structural move on parent.
   */
  targetRowId?: string | null;
  targetRegion?: 'portal' | 'row' | 'node';
  _state?: { handled: boolean };
};

function parseTargetRowInsertIndex(d: CrossNodeDetail): number | undefined {
  const v = d.targetRowInsertIndex;
  if (typeof v !== 'number' || Number.isNaN(v)) return undefined;
  return Math.floor(v);
}

export function useCrossFlowRowMoveOrchestrator(params: {
  projectId?: string | undefined;
  projectData?: unknown;
}) {
  const { projectId, projectData } = params;
  useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<CrossNodeDetail>;
      const d = ev.detail as CrossNodeDetail;
      if (!d?._state || d._state.handled) return;

      const fromNode = String(d.fromNodeId || '').trim();
      const toNode = String(d.toNodeId || '').trim();
      const rowId = String(d.rowData?.id || '').trim();
      if (!fromNode || !toNode || !rowId) return;

      if (import.meta.env.DEV) {
        console.log('DnD target:', { targetRegion: d.targetRegion, targetRowId: d.targetRowId });
      }

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

      /** Same flow: cross-node row move uses structural graph mutation unless the drop targets the portal row. */
      if (fromResolved === toResolved) {
        if (fromNode === toNode) return;
        const flowSlice = flows[fromResolved];
        const targetRfNode = flowSlice?.nodes?.find(
          (n: { id?: string }) => String(n?.id || '').trim() === toNode
        );
        const portalOnTarget = targetRfNode
          ? findFirstSubflowPortalInNode(targetRfNode as { data?: { rows?: unknown[] } })
          : null;
        if (
          portalOnTarget &&
          dropTargetsSubflowPortalRow({
            targetRegion: d.targetRegion,
            targetRowId: d.targetRowId,
            portalTaskRowId: portalOnTarget.subflowTaskRowId,
          })
        ) {
          logTaskSubflowMove('orchestrator:sameFlowDeferToPortalHandler', { toNodeId: toNode });
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

        const insertIdx = parseTargetRowInsertIndex(d);
        const out = runStructuralCommandSync(ctx, {
          type: 'moveTaskRow',
          commandId: newCommandId(),
          source: 'dnd',
          rowId,
          fromFlowId: fromResolved,
          toFlowId: toResolved,
          fromNodeId: fromNode,
          toNodeId: toNode,
          ...(insertIdx !== undefined ? { targetRowInsertIndex: insertIdx } : {}),
        }) as ApplyTaskMoveToSubflowResult | void;

        if (out?.flowStoreCommitOk === true) {
          d._state.handled = true;
          if (out.flowsNext && !FLOW_GRAPH_MIGRATION.DISABLE_SCHEDULE_COMMITTED_FLOW_NODE_ROWS_SYNC) {
            scheduleCommittedFlowNodeRowsSync(out.flowsNext, fromResolved, rowId);
          }
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

      const insertIdx = parseTargetRowInsertIndex(d);
      const out = runStructuralCommandSync(ctx, {
        type: 'moveTaskRow',
        commandId: newCommandId(),
        source: 'dnd',
        rowId,
        fromFlowId: fromResolved,
        toFlowId: toResolved,
        fromNodeId: fromNode,
        toNodeId: toNode,
        ...(insertIdx !== undefined ? { targetRowInsertIndex: insertIdx } : {}),
      }) as ApplyTaskMoveToSubflowResult | void;

      if (out?.flowStoreCommitOk === true) {
        d._state.handled = true;
        if (out.flowsNext && !FLOW_GRAPH_MIGRATION.DISABLE_SCHEDULE_COMMITTED_FLOW_NODE_ROWS_SYNC) {
          scheduleCommittedFlowNodeRowsSync(out.flowsNext, toResolved, rowId);
        }
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
