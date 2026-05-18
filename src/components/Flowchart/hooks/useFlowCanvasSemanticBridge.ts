/**
 * Ephemeral RF preview + semantic commits to FlowStore (position, layout, viewport).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Node, NodeChange } from 'reactflow';
import { FlowStateBridge } from '../../../services/FlowStateBridge';
import { commitNodeMeasuredDimensions } from '../nodes/CustomNode/commitNodeMeasuredDimensions';
import {
  subscribeFlowCanvasSemantic,
  type NodePositionUpdate,
} from '../semantic/flowCanvasSemanticEvents';
import { shouldSkipDuplicatePositionCommit } from '../semantic/flowPositionCommitDedupe';
import {
  mergeNodesWithDragOverlay,
  overlayMatchesStorePositions,
  pinOverlayToPositions,
  type EphemeralDragSnapshot,
} from '../semantic/ephemeralNodeDrag';
import {
  flowCanvasDiag,
  flowCanvasDiagPositions,
  flowCanvasDiagSemantic,
  isFlowCanvasDebugVerbose,
  isInterestingNodesChange,
  nextFlowCanvasTraceId,
  summarizeNodePositions,
} from '../utils/flowCanvasDiagnostics';
import {
  applyWorkspaceNodeChangesPreservingPositions,
  filterWorkspaceNodeChanges,
  isDraggingPositionChange,
  isNonDragPositionChange,
} from './flowCanvasNodeChangeFilter';

export type UseFlowCanvasSemanticBridgeArgs = {
  flowId: string;
  nodes: readonly Node[];
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setSelectedNodeIds: (ids: string[]) => void;
  updateNodeInternals: (nodeId: string) => void;
};

export type UseFlowCanvasSemanticBridgeResult = {
  displayNodes: Node[];
  onNodesChange: (changes: NodeChange[]) => void;
};

export function useFlowCanvasSemanticBridge({
  flowId,
  nodes,
  setNodes,
  setSelectedNodeIds,
  updateNodeInternals,
}: UseFlowCanvasSemanticBridgeArgs): UseFlowCanvasSemanticBridgeResult {
  const canvasId = String(flowId || 'main').trim();
  const nodesRef = useRef(nodes);
  const overlayRef = useRef<EphemeralDragSnapshot>(new Map());
  /** Overlay pins held until props.nodes reflect the last NODE_POSITION_COMMITTED. */
  const pendingOverlaySyncRef = useRef<EphemeralDragSnapshot | null>(null);
  const overlaySyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [overlayTick, setOverlayTick] = useState(0);

  const cancelOverlaySyncTimeout = useCallback(() => {
    if (overlaySyncTimeoutRef.current) {
      clearTimeout(overlaySyncTimeoutRef.current);
      overlaySyncTimeoutRef.current = null;
    }
  }, []);

  const bumpOverlay = useCallback(() => {
    setOverlayTick((t) => t + 1);
  }, []);

  const setNodesTraced = useCallback(
    (tag: string, updater: React.SetStateAction<Node[]>, extra?: Record<string, unknown>) => {
      setNodes((prev) => {
        const next = typeof updater === 'function' ? (updater as (p: Node[]) => Node[])(prev) : updater;
        flowCanvasDiagPositions(`setNodes.${tag}`, prev, next, extra);
        try {
          FlowStateBridge.setNodes(next as Node[]);
        } catch {
          /* noop */
        }
        return next;
      });
    },
    [setNodes]
  );

  const applyEphemeralDrag = useCallback(
    (updates: NodePositionUpdate[]) => {
      const map = new Map(overlayRef.current);
      for (const u of updates) {
        map.set(u.nodeId, { x: u.position.x, y: u.position.y });
      }
      overlayRef.current = map;
      if (isFlowCanvasDebugVerbose()) {
        flowCanvasDiag('ephemeral.apply', {
          flowId: canvasId,
          count: updates.length,
          overlay: summarizeNodePositions(
            Array.from(map.entries()).map(([id, p]) => ({ id, position: p }))
          ),
        });
      }
      bumpOverlay();
    },
    [bumpOverlay, canvasId]
  );

  const clearEphemeralDrag = useCallback(
    (reason: string) => {
      if (overlayRef.current.size === 0 && !pendingOverlaySyncRef.current) return;
      flowCanvasDiag('ephemeral.clear', {
        flowId: canvasId,
        reason,
        had: summarizeNodePositions(
          Array.from(overlayRef.current.entries()).map(([id, p]) => ({ id, position: p }))
        ),
      });
      overlayRef.current = new Map();
      pendingOverlaySyncRef.current = null;
      cancelOverlaySyncTimeout();
      bumpOverlay();
    },
    [bumpOverlay, canvasId, cancelOverlaySyncTimeout]
  );

  const tryReleaseOverlayAfterStoreSync = useCallback(
    (storeNodes: readonly Node[], reason: string) => {
      const pending = pendingOverlaySyncRef.current;
      if (!pending || pending.size === 0) return;
      if (!overlayMatchesStorePositions(storeNodes, pending)) return;
      clearEphemeralDrag(reason);
    },
    [clearEphemeralDrag]
  );

  useEffect(() => {
    const prev = nodesRef.current;
    nodesRef.current = nodes;
    tryReleaseOverlayAfterStoreSync(nodes as Node[], 'store_synced');
    const deltas = nodes
      .filter((n) => {
        const p = prev.find((x) => x.id === n.id)?.position;
        const q = n.position;
        if (!p || !q) return false;
        return Math.abs(p.x - q.x) > 0.01 || Math.abs(p.y - q.y) > 0.01;
      })
      .map((n) => n.id);
    if (deltas.length > 0) {
      flowCanvasDiag('props.nodes.changed', {
        flowId: canvasId,
        movedIds: deltas,
        positions: summarizeNodePositions(nodes),
      });
    }
    try {
      FlowStateBridge.setNodes(nodes as Node[]);
    } catch {
      /* noop */
    }
  }, [nodes, canvasId, tryReleaseOverlayAfterStoreSync]);

  useEffect(() => () => cancelOverlaySyncTimeout(), [cancelOverlaySyncTimeout]);

  const applyPositionCommit = useCallback(
    (updates: NodePositionUpdate[], traceId: string) => {
      if (updates.length === 0) return;
      if (shouldSkipDuplicatePositionCommit(canvasId, updates)) {
        flowCanvasDiag('commit.skip_duplicate', { flowId: canvasId, traceId });
        return;
      }
      flowCanvasDiag('commit.applyPosition', {
        flowId: canvasId,
        traceId,
        updates: updates.map((u) => ({
          id: u.nodeId,
          pos: `(${u.position.x.toFixed(1)},${u.position.y.toFixed(1)})`,
        })),
        storeBefore: summarizeNodePositions(nodesRef.current),
      });
      const byId = new Map(updates.map((u) => [u.nodeId, u.position]));
      setNodesTraced('NODE_POSITION_COMMITTED', (nds) =>
        nds.map((n) => {
          const p = byId.get(n.id);
          return p ? { ...n, position: { x: p.x, y: p.y }, dragging: false } : n;
        }),
        { traceId }
      );
    },
    [canvasId, setNodesTraced]
  );

  useEffect(() => {
    FlowStateBridge.setApplyEphemeralDrag(applyEphemeralDrag);
    FlowStateBridge.setClearEphemeralDrag(() => clearEphemeralDrag('bridge.clear'));
    FlowStateBridge.setUpdateNodeInternals(updateNodeInternals);
    return () => {
      FlowStateBridge.setApplyEphemeralDrag(undefined);
      FlowStateBridge.setClearEphemeralDrag(undefined);
      FlowStateBridge.setUpdateNodeInternals(undefined);
    };
  }, [applyEphemeralDrag, clearEphemeralDrag, updateNodeInternals]);

  useEffect(() => {
    return subscribeFlowCanvasSemantic((ev) => {
      if (String(ev.flowId).trim() !== canvasId) return;
      const traceId = nextFlowCanvasTraceId('sem');
      switch (ev.type) {
        case 'NODE_POSITION_COMMITTED': {
          // Keep overlay pinned to committed coords until FlowStore props match.
          // Clearing immediately caused a one-frame flash at the pre-drag store position.
          const pinned = pinOverlayToPositions(ev.updates);
          overlayRef.current = pinned;
          pendingOverlaySyncRef.current = pinned;
          bumpOverlay();
          applyPositionCommit(ev.updates, traceId);
          cancelOverlaySyncTimeout();
          overlaySyncTimeoutRef.current = setTimeout(() => {
            overlaySyncTimeoutRef.current = null;
            if (!pendingOverlaySyncRef.current) return;
            flowCanvasDiag('ephemeral.clear', {
              flowId: canvasId,
              reason: 'commit_sync_timeout',
            });
            pendingOverlaySyncRef.current = null;
            overlayRef.current = new Map();
            bumpOverlay();
          }, 120);
          if (overlayMatchesStorePositions(nodesRef.current, pinned)) {
            tryReleaseOverlayAfterStoreSync(nodesRef.current as Node[], 'store_synced_immediate');
          }
          break;
        }
        case 'NODE_LAYOUT_SETTLED':
          flowCanvasDiagSemantic('NODE_LAYOUT_SETTLED', canvasId, {
            traceId,
            nodeId: ev.nodeId,
            width: ev.width,
            height: ev.height,
          });
          commitNodeMeasuredDimensions(
            ev.nodeId,
            ev.width,
            ev.height,
            (fn) => setNodesTraced('NODE_LAYOUT_SETTLED', fn, { traceId, nodeId: ev.nodeId }),
            updateNodeInternals
          );
          break;
        case 'CANVAS_LAYOUT_SETTLED':
          flowCanvasDiagSemantic('CANVAS_LAYOUT_SETTLED', canvasId, {
            traceId,
            width: ev.width,
            height: ev.height,
          });
          break;
        case 'VIEWPORT_SETTLED':
        case 'VIEWPORT_INITIAL_FIT':
        case 'GRAPH_HYDRATED':
          flowCanvasDiagSemantic(ev.type, canvasId, { traceId, ...ev });
          break;
        default:
          break;
      }
    });
  }, [
    canvasId,
    applyPositionCommit,
    bumpOverlay,
    cancelOverlaySyncTimeout,
    clearEphemeralDrag,
    setNodesTraced,
    tryReleaseOverlayAfterStoreSync,
    updateNodeInternals,
  ]);

  const displayNodes = useMemo(() => {
    void overlayTick;
    return mergeNodesWithDragOverlay(nodes as Node[], overlayRef.current);
  }, [nodes, overlayTick]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const hasDraggingPosition = changes.some(isDraggingPositionChange);
      const dropped = changes.filter(
        (ch) =>
          isNonDragPositionChange(ch) ||
          ch.type === 'dimensions' ||
          ch.type === 'replace' ||
          ch.type === 'reset'
      );
      if (dropped.length > 0) {
        flowCanvasDiag('onNodesChange.ignoreRfLayout', {
          flowId: canvasId,
          types: dropped.map((ch) => ch.type),
          ids: dropped.map((ch) => ('id' in ch ? ch.id : '?')),
        });
      }
      const workspaceChanges = filterWorkspaceNodeChanges(changes);

      if (
        isFlowCanvasDebugVerbose() &&
        (hasDraggingPosition || isInterestingNodesChange(workspaceChanges))
      ) {
        flowCanvasDiag('onNodesChange', {
          flowId: canvasId,
          total: changes.length,
          draggingPos: hasDraggingPosition,
          workspace: workspaceChanges.map((c) => c.type),
          overlaySize: overlayRef.current.size,
        });
      }

      if (workspaceChanges.length > 0) {
        const tag = isInterestingNodesChange(workspaceChanges)
          ? 'onNodesChange.workspace'
          : 'onNodesChange.workspace.silent';
        setNodesTraced(
          tag,
          (prev) => applyWorkspaceNodeChangesPreservingPositions(prev as Node[], workspaceChanges),
          { changeTypes: workspaceChanges.map((c) => c.type) }
        );
        // Derive selection from the select-type changes; must NOT be inside the setNodes updater
        // because setNodes dispatches to FlowStore reducer (sync) → calling setState there = React error.
        const selectChanges = workspaceChanges.filter(
          (ch): ch is NodeChange & { id: string; selected: boolean } =>
            ch.type === 'select' && 'id' in ch
        );
        if (selectChanges.length > 0) {
          const overrides = new Map(selectChanges.map((ch) => [ch.id, ch.selected]));
          const selected = (nodesRef.current as Node[])
            .filter((n) => overrides.has(n.id) ? overrides.get(n.id) : !!n.selected)
            .map((n) => n.id);
          try {
            setSelectedNodeIds(selected);
          } catch {
            /* noop */
          }
        }
      }

      // Dragging position changes go to the ephemeral overlay — independent of workspace changes.
      // Using `if` (not `else if`) so workspace mutations and drag preview can coexist.
      if (hasDraggingPosition) {
        const posChanges = changes.filter(
          (ch): ch is NodeChange & { id: string; position?: { x: number; y: number } } =>
            ch.type === 'position' && 'id' in ch
        );
        const updates = posChanges
          .map((ch) => {
            const p = ch.position;
            if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
            return { nodeId: ch.id, position: { x: p.x, y: p.y } };
          })
          .filter((u): u is NodePositionUpdate => u != null);
        if (updates.length > 0) applyEphemeralDrag(updates);
      }
    },
    [canvasId, setNodesTraced, setSelectedNodeIds, applyEphemeralDrag]
  );

  return { displayNodes, onNodesChange };
}
