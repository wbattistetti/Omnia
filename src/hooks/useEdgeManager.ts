import { useCallback, Dispatch, SetStateAction } from 'react';
import { Edge } from 'reactflow';

// Tipo base per i dati custom delle edge
export type EdgeData = {
  onDeleteEdge?: (edgeId: string) => void;
  [key: string]: any;
};

export function useEdgeManager(
  setEdges: Dispatch<SetStateAction<Edge<EdgeData>[]>>
) {
  /**
   * Aggiungi una edge
   */
  const addEdge = useCallback((params: Partial<Edge<EdgeData>> & { source: string; target: string }) => {
    setEdges((eds) => {
      // Non aggiungere se esiste già una edge tra source e target (e handle)
      const exists = eds.some(e =>
        e.source === params.source &&
        e.target === params.target &&
        e.sourceHandle === params.sourceHandle &&
        e.targetHandle === params.targetHandle
      );
      if (exists) return eds;
      return [
        ...eds,
        {
          ...params,
          markerEnd: 'arrowhead',
          type: 'custom',
        } as Edge<EdgeData>,
      ];
    });
  }, [setEdges]);

  /**
   * Patcha tutte le edge (es: normalizza markerEnd, tipo, ecc)
   */
  const patchEdges = useCallback(() => {
    setEdges((eds) =>
      eds.map((e) => ({
        ...e,
        markerEnd: 'arrowhead',
        type: 'custom',
      }))
    );
  }, [setEdges]);

  /**
   * Cancella una edge per id
   */
  const deleteEdge = useCallback((edgeId: string) => {
    setEdges((eds) => eds.filter((e) => e.id !== edgeId));
  }, [setEdges]);

  return { addEdge, patchEdges, deleteEdge };
}