import { useRef, useCallback } from 'react';
import type { Edge } from 'reactflow';

export function useEdgeLabelScheduler(setEdges: any, setSelectedEdgeId: any, connectionMenuRef: any) {
  const pendingApplyRef = useRef<null | { id: string; label: string; data?: any; tries: number }>(null);

  const scheduleApplyLabel = useCallback((edgeId: string, label: string, extraData?: any) => {
    pendingApplyRef.current = { id: edgeId, label, data: extraData, tries: 0 };
    const tick = () => {
      const cur = pendingApplyRef.current;
      if (!cur) return;
      const exists = (setEdges.current || []).some((e: Edge) => e.id === cur.id);
      if (exists) {
        setEdges((eds: Edge[]) => eds.map(e => {
          if (e.id === cur.id) {
            const mergedData = cur.data ? { ...(e.data || {}), ...cur.data } : e.data;
            // ✅ Log when isElse is being set via scheduleApplyLabel
            if (cur.data?.isElse === true && e.data?.isElse !== true) {
              console.log('[useEdgeLabelScheduler] ✅ Setting isElse to true', {
                edgeId: e.id,
                edgeLabel: e.label,
                oldIsElse: e.data?.isElse,
                newIsElse: true
              });
            }
            return { ...e, label: cur.label, data: mergedData };
          }
          return e;
        }));
        setSelectedEdgeId(cur.id);
        pendingApplyRef.current = null;
        return;
      }
      if (cur.tries >= 12) {
        // Fallback: match by src/tgt,
        const src = connectionMenuRef.current?.sourceNodeId;
        const tgt = connectionMenuRef.current?.targetNodeId;
        if (src && tgt) {
          setEdges((eds: Edge[]) => eds.map(e => {
            if (e.source === src && e.target === tgt) {
              const mergedData = cur.data ? { ...(e.data || {}), ...cur.data } : e.data;
              // ✅ Log when isElse is being set via scheduleApplyLabel (fallback)
              if (cur.data?.isElse === true && e.data?.isElse !== true) {
                console.log('[useEdgeLabelScheduler][fallback] ✅ Setting isElse to true', {
                  edgeId: e.id,
                  edgeLabel: e.label,
                  oldIsElse: e.data?.isElse,
                  newIsElse: true
                });
              }
              return { ...e, label: cur.label, data: mergedData };
            }
            return e;
          }));
        }
        pendingApplyRef.current = null;
        return;
      }
      pendingApplyRef.current = { ...cur, tries: cur.tries + 1 };
      setTimeout(tick, 0);
    };
    tick();
  }, [setEdges, setSelectedEdgeId, connectionMenuRef]);

  return { scheduleApplyLabel, pendingApplyRef };
}
