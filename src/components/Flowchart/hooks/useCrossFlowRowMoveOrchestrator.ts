/**
 * Capture-phase handler: must be registered **before** {@link useCrossNodeSubflowPortalMove} in
 * {@link FlowEditor} so it runs first on `crossNodeRowMove`. Resolves source/target flow ids from the
 * workspace graph (node membership), not the active canvas under the pointer. Sets `detail._state.handled`
 * so bubble listeners and {@link useNodeDragDrop} skip legacy local updates.
 *
 * **Coordination:** {@link useNodeDragDrop} dispatches `crossNodeRowMove` **synchronously** (capture
 * handlers run first), then **always** removes the row from the source node via `updateNode` so the
 * UI cannot stay out of sync when store commits are delayed or partial.
 */

import { useEffect } from 'react';
import { normalizeFlowCanvasId } from '@components/FlowMappingPanel/flowInterfaceDragTypes';
import { resolveFlowIdForNodeWithCanvasHint } from '@domain/taskSubflowMove/findFlowIdForNode';
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

      if (fromResolved === toResolved) return;

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

      runStructuralCommandSync(ctx, {
        type: 'moveTaskRow',
        commandId: newCommandId(),
        source: 'dnd',
        rowId,
        fromFlowId: fromResolved,
        toFlowId: toResolved,
        fromNodeId: fromNode,
        toNodeId: toNode,
      });

      d._state.handled = true;
      logTaskSubflowMove('orchestrator:crossFlowRowMoveHandled', {
        rowId,
        fromFlowId: fromResolved,
        toFlowId: toResolved,
      });
    };

    window.addEventListener('crossNodeRowMove', handler, true);
    return () => window.removeEventListener('crossNodeRowMove', handler, true);
  }, [projectId, projectData]);
}
