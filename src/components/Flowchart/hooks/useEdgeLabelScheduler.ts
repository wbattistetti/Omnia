import { useRef, useCallback, useEffect, type MutableRefObject } from 'react';
import type { Edge } from 'reactflow';

const MAX_TICKS = 24;

export type UseEdgeLabelSchedulerOptions = {
  edgesRef: MutableRefObject<Edge[] | null | undefined>;
  edges: Edge[] | null | undefined;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  setSelectedEdgeId: (id: string | null) => void;
  pendingEdgeIdRef?: MutableRefObject<string | null>;
};

/**
 * Schedula e applica etichette su edge (tick + sync reattivo quando `edges` si aggiorna).
 * Usa un oggetto opzioni per evitare errori di ordine dei parametri.
 */
export function useEdgeLabelScheduler({
  edgesRef,
  edges,
  setEdges,
  setSelectedEdgeId,
  pendingEdgeIdRef,
}: UseEdgeLabelSchedulerOptions) {
  const pendingApplyRef = useRef<null | { id: string; label: string; data?: any; tries: number }>(null);

  const setEdgesRef = useRef(setEdges);
  const setSelectedEdgeIdRef = useRef(setSelectedEdgeId);
  setEdgesRef.current = setEdges;
  setSelectedEdgeIdRef.current = setSelectedEdgeId;

  const scheduleApplyLabel = useCallback(
    (edgeId: string, label: string, extraData?: any) => {
      pendingApplyRef.current = { id: edgeId, label, data: extraData, tries: 0 };
      const tick = () => {
        const cur = pendingApplyRef.current;
        if (!cur) return;
        const list = edgesRef.current ?? [];
        const exists = list.some((e: Edge) => e.id === cur.id);
        if (exists) {
          setEdgesRef.current((eds: Edge[]) => {
            const safe = eds ?? [];
            return safe.map((e) => {
              if (e.id !== cur.id) return e;
              const mergedData = cur.data ? { ...(e.data || {}), ...cur.data } : e.data;
              if (cur.data?.isElse === true && e.data?.isElse !== true) {
                console.log('[useEdgeLabelScheduler] Setting isElse to true', { edgeId: e.id });
              }
              return { ...e, label: cur.label, data: mergedData };
            });
          });
          setSelectedEdgeIdRef.current(cur.id);
          pendingApplyRef.current = null;
          return;
        }
        if (cur.tries >= MAX_TICKS) {
          console.error('[useEdgeLabelScheduler] Edge id not in graph after retries', {
            edgeId: cur.id,
            tries: cur.tries,
          });
          pendingApplyRef.current = null;
          return;
        }
        pendingApplyRef.current = { ...cur, tries: cur.tries + 1 };
        setTimeout(tick, 0);
      };
      tick();
    },
    [edgesRef]
  );

  /** Fast path: quando l’edge compare nello stato React, applica subito la label pendente. */
  useEffect(() => {
    const cur = pendingApplyRef.current;
    if (!cur) return;
    const edgeList = edges ?? [];
    if (!edgeList.some((e) => e.id === cur.id)) return;
    setEdges((eds) => {
      const safe = eds ?? [];
      return safe.map((e) => (e.id === cur.id ? { ...e, label: cur.label, data: cur.data } : e));
    });
    setSelectedEdgeId(cur.id);
    pendingApplyRef.current = null;
    if (pendingEdgeIdRef) pendingEdgeIdRef.current = null;
  }, [edges, setEdges, setSelectedEdgeId, pendingEdgeIdRef]);

  return { scheduleApplyLabel, pendingApplyRef };
}
