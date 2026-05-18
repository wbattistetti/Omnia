/**
 * Ephemeral RF preview + semantic commits to FlowStore (position only; layout stays RF-local).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Node, NodeChange } from 'reactflow';
import { FlowStateBridge } from '../../../services/FlowStateBridge';
import {
  applyNodeLayoutRuntime,
  mergeNodesWithMeasuredLayout,
  type NodeMeasuredSize,
} from '../semantic/flowCanvasLayoutRuntime';
import { registerFlowCanvasStoreSemanticHandler } from '../semantic/flowCanvasSemanticRegistry';
import {
  type NodePositionUpdate,
} from '../semantic/flowCanvasSemanticEvents';
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
  /** Measured DOM sizes — RF display only, never FlowStore. */
  const layoutByIdRef = useRef<Map<string, NodeMeasuredSize>>(new Map());
  const pendingLayoutRef = useRef<Map<string, NodeMeasuredSize>>(new Map());
  /** Overlay pins held until props.nodes reflect the last NODE_POSITION_COMMITTED. */
  const pendingOverlaySyncRef = useRef<EphemeralDragSnapshot | null>(null);
  const overlaySyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [overlayTick, setOverlayTick] = useState(0);
  const [layoutTick, setLayoutTick] = useState(0);

  const cancelOverlaySyncTimeout = useCallback(() => {
    if (overlaySyncTimeoutRef.current) {
      clearTimeout(overlaySyncTimeoutRef.current);
      overlaySyncTimeoutRef.current = null;
    }
  }, []);

  const bumpOverlay = useCallback(() => {
    setOverlayTick((t) => t + 1);
  }, []);

  const bumpLayout = useCallback(() => {
    setLayoutTick((t) => t + 1);
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

  const applyLayoutSettled = useCallback(
    (nodeId: string, width: number, height: number, traceId: string) => {
      const changed = applyNodeLayoutRuntime({
        nodeId,
        width,
        height,
        layoutById: layoutByIdRef.current,
        updateNodeInternals,
      });
      if (!changed) return;
      flowCanvasDiagSemantic('NODE_LAYOUT_SETTLED', canvasId, {
        traceId,
        nodeId,
        width,
        height,
      });
      flowCanvasDiag('layout.runtime.apply', {
        flowId: canvasId,
        traceId,
        nodeId,
        width,
        height,
      });
      bumpLayout();
    },
    [bumpLayout, canvasId, updateNodeInternals]
  );

  const flushPendingLayout = useCallback(
    (reason: string) => {
      const pending = pendingLayoutRef.current;
      if (pending.size === 0) return;
      flowCanvasDiag('layout.runtime.flush', {
        flowId: canvasId,
        reason,
        count: pending.size,
      });
      const traceId = nextFlowCanvasTraceId('layout');
      for (const [nodeId, size] of pending) {
        applyLayoutSettled(nodeId, size.width, size.height, traceId);
      }
      pendingLayoutRef.current = new Map();
    },
    [applyLayoutSettled, canvasId]
  );

  const handleLayoutSettled = useCallback(
    (nodeId: string, width: number, height: number, traceId: string) => {
      if (FlowStateBridge.getToolbarDragNodeId()) {
        pendingLayoutRef.current.set(nodeId, {
          width: Math.round(width),
          height: Math.round(height),
        });
        flowCanvasDiag('layout.runtime.defer', {
          flowId: canvasId,
          traceId,
          nodeId,
          toolbarDrag: FlowStateBridge.getToolbarDragNodeId(),
        });
        return;
      }
      applyLayoutSettled(nodeId, width, height, traceId);
    },
    [applyLayoutSettled, canvasId]
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
    for (const n of nodes) {
      const w = Number(n.width);
      const h = Number(n.height);
      if (w >= 1 && h >= 1 && !layoutByIdRef.current.has(n.id)) {
        layoutByIdRef.current.set(n.id, { width: Math.round(w), height: Math.round(h) });
      }
    }
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
    (updates: NodePositionUpdate[], traceId: string): boolean => {
      if (updates.length === 0) return false;
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
      flushPendingLayout('after_position_commit');
      return true;
    },
    [canvasId, flushPendingLayout, setNodesTraced]
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
    const onToolbarDragEnd = (e: Event) => {
      const detail = (e as CustomEvent<{ flowCanvasId?: string }>).detail;
      if (detail?.flowCanvasId && String(detail.flowCanvasId).trim() !== canvasId) return;
      flushPendingLayout('toolbar_drag_end');
    };
    window.addEventListener('flowchart:toolbarDragEnd', onToolbarDragEnd);
    return () => window.removeEventListener('flowchart:toolbarDragEnd', onToolbarDragEnd);
  }, [canvasId, flushPendingLayout]);

  useEffect(() => {
    return registerFlowCanvasStoreSemanticHandler(canvasId, (ev) => {
      const traceId = nextFlowCanvasTraceId('sem');
      switch (ev.type) {
        case 'NODE_POSITION_COMMITTED': {
          const pinned = pinOverlayToPositions(ev.updates);
          overlayRef.current = pinned;
          pendingOverlaySyncRef.current = pinned;
          bumpOverlay();
          const committed = applyPositionCommit(ev.updates, traceId);
          cancelOverlaySyncTimeout();
          overlaySyncTimeoutRef.current = setTimeout(() => {
            overlaySyncTimeoutRef.current = null;
            const pending = pendingOverlaySyncRef.current;
            if (!pending) return;
            if (
              !committed &&
              !overlayMatchesStorePositions(nodesRef.current, pending)
            ) {
              flowCanvasDiag('ephemeral.clear_aborted', {
                flowId: canvasId,
                reason: 'store_not_synced',
              });
              return;
            }
            if (!overlayMatchesStorePositions(nodesRef.current, pending)) {
              flowCanvasDiag('ephemeral.sync_pending', {
                flowId: canvasId,
                reason: 'commit_sync_timeout_waiting_store',
              });
              return;
            }
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
          handleLayoutSettled(ev.nodeId, ev.width, ev.height, traceId);
          break;
        default:
          break;
      }
    });
  }, [
    applyPositionCommit,
    bumpOverlay,
    cancelOverlaySyncTimeout,
    canvasId,
    handleLayoutSettled,
    tryReleaseOverlayAfterStoreSync,
  ]);

  const displayNodes = useMemo(() => {
    void overlayTick;
    void layoutTick;
    const withOverlay = mergeNodesWithDragOverlay(nodes as Node[], overlayRef.current);
    return mergeNodesWithMeasuredLayout(withOverlay, layoutByIdRef.current);
  }, [nodes, overlayTick, layoutTick]);

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
