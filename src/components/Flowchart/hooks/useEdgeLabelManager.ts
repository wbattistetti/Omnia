import { useCallback, useEffect, useRef } from 'react';
import { Edge } from 'reactflow';
import { debug } from '../../../utils/logger';
import type { EdgeData } from '../types/flowTypes';

interface UseEdgeLabelManagerParams {
  edges: Edge<EdgeData>[];
  setEdges: React.Dispatch<React.SetStateAction<Edge<EdgeData>[]>>;
  setSelectedEdgeId: (id: string | null) => void;
  pendingEdgeIdRef: React.MutableRefObject<string | null>;
  edgesRef: React.MutableRefObject<Edge<EdgeData>[]>;
  connectionMenuRef: React.MutableRefObject<any>;
  scheduleApplyLabel: (edgeId: string, label: string) => void;
  pendingApplyRef: React.MutableRefObject<{ id: string; label: string; data?: any } | null>;
  closeMenu: () => void;
  setNodes: React.Dispatch<React.SetStateAction<any[]>>;
}

/**
 * Hook for managing edge label logic.
 * Handles applying labels to existing edges and temporary edge stabilization.
 */
export function useEdgeLabelManager({
  edges,
  setEdges,
  setSelectedEdgeId,
  pendingEdgeIdRef,
  edgesRef,
  connectionMenuRef,
  scheduleApplyLabel,
  pendingApplyRef,
  closeMenu,
  setNodes,
}: UseEdgeLabelManagerParams) {
  const handleExistingEdgeLabel = useCallback(
    (pid: string, label: string) => {
      setEdges((eds) => eds.map((e) => (e.id === pid ? { ...e, label } : e)));
      setSelectedEdgeId(pid);
      pendingEdgeIdRef.current = null;
    },
    [setEdges, setSelectedEdgeId, pendingEdgeIdRef]
  );

  const handleTempEdgeStabilization = useCallback(
    (tempNodeId: string, tempEdgeId: string, label: string, fp: any) => {
      debug('FLOW_EDITOR', 'Starting stabilization', {
        tempNodeId,
        tempEdgeId,
        flowPosition: fp,
        timestamp: Date.now(),
      });

      setNodes((nds) => {
        const stabilizedNodes = nds.map((n) => {
          if (n.id === tempNodeId) {
            debug('FLOW_EDITOR', 'Stabilizing temporary node', {
              tempNodeId,
              pos: n.position,
              fp,
              timestamp: Date.now(),
            });
            return { ...n, isTemporary: false };
          }
          return n;
        });
        return stabilizedNodes;
      });

      setEdges((eds) => eds.map((e) => (e.id === tempEdgeId ? { ...e, label } : e)));
      setSelectedEdgeId(tempEdgeId);
      closeMenu();
    },
    [setNodes, setEdges, setSelectedEdgeId, closeMenu]
  );

  // Commit helper: apply a label to the current linkage context deterministically
  const commitEdgeLabel = useCallback(
    (label: string): boolean => {
      // 1) Just-created edge between existing nodes
      if (pendingEdgeIdRef.current) {
        const pid = pendingEdgeIdRef.current;
        // If not yet present in state, defer until it appears
        const exists = (edgesRef.current || []).some((e) => e.id === pid);
        if (exists) {
          handleExistingEdgeLabel(pid, label);
        } else {
          scheduleApplyLabel(pid, label);
        }
        return true;
      }

      // 2) Promote temp node/edge if present
      const tempNodeId = connectionMenuRef.current.tempNodeId as string | null;
      const tempEdgeId = connectionMenuRef.current.tempEdgeId as string | null;
      if (tempNodeId && tempEdgeId) {
        const fp = (connectionMenuRef.current as any).flowPosition;
        handleTempEdgeStabilization(tempNodeId, tempEdgeId, label, fp);
        return true;
      }

      return false;
    },
    [scheduleApplyLabel, handleExistingEdgeLabel, handleTempEdgeStabilization, pendingEdgeIdRef, edgesRef, connectionMenuRef]
  );

  // Also attempt apply on every edges change (fast path)
  useEffect(() => {
    const cur = pendingApplyRef.current;
    if (!cur) return;
    if ((edges || []).some((e) => e.id === cur.id)) {
      setEdges((eds) =>
        eds.map((e) => (e.id === cur.id ? { ...e, label: cur.label, data: cur.data } : e))
      );
      setSelectedEdgeId(cur.id);
      pendingEdgeIdRef.current = null;
    }
  }, [edges, setEdges, setSelectedEdgeId, pendingApplyRef, pendingEdgeIdRef]);

  return { commitEdgeLabel };
}
