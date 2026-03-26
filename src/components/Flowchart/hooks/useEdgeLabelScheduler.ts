import { useRef, useCallback, type MutableRefObject } from 'react';
import type { Edge } from 'reactflow';

const MAX_TICKS = 24;

/**
 * Applica label quando l’edge con `id` compare nello stato React Flow.
 * Usa `edgesRef` (sempre aggiornato) per il check di esistenza — non `setEdges.current` (non è un ref).
 * Nessun fallback euristico src/tgt: l’edge si identifica solo per `edgeId`.
 */
export function useEdgeLabelScheduler(
  edgesRef: MutableRefObject<Edge[]>,
  setEdges: (updater: (eds: Edge[]) => Edge[]) => void,
  setSelectedEdgeId: (id: string | null) => void
) {
  const pendingApplyRef = useRef<null | { id: string; label: string; data?: any; tries: number }>(null);

  const scheduleApplyLabel = useCallback(
    (edgeId: string, label: string, extraData?: any) => {
      pendingApplyRef.current = { id: edgeId, label, data: extraData, tries: 0 };
      const tick = () => {
        const cur = pendingApplyRef.current;
        if (!cur) return;
        const exists = (edgesRef.current || []).some((e: Edge) => e.id === cur.id);
        if (exists) {
          setEdges((eds: Edge[]) =>
            eds.map((e) => {
              if (e.id !== cur.id) return e;
              const mergedData = cur.data ? { ...(e.data || {}), ...cur.data } : e.data;
              if (cur.data?.isElse === true && e.data?.isElse !== true) {
                console.log('[useEdgeLabelScheduler] Setting isElse to true', { edgeId: e.id });
              }
              return { ...e, label: cur.label, data: mergedData };
            })
          );
          setSelectedEdgeId(cur.id);
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
    [edgesRef, setEdges, setSelectedEdgeId]
  );

  return { scheduleApplyLabel, pendingApplyRef };
}
