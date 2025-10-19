import { useRef } from 'react';

export function useTempEdgeFlags() {
  // Ref globale per edge temporaneo
  const tempEdgeIdGlobal = useRef<string | null>(null);
  // Flag per tracciare nodi temporanei stabilizzati (per evitare riposizionamento)
  const stabilizedTempNodes = useRef<Set<string>>(new Set());
  // Flag per tracciare nodi temporanei in corso di creazione (per evitare creazione duplicata)
  const creatingTempNodes = useRef<Set<string>>(new Set());

  function markStabilized(id: string) { stabilizedTempNodes.current.add(id); }
  function clearStabilized(id: string) { stabilizedTempNodes.current.delete(id); }
  function isStabilized(id: string) { return stabilizedTempNodes.current.has(id); }

  function markCreating(id: string) { creatingTempNodes.current.add(id); }
  function clearCreating(id: string) { creatingTempNodes.current.delete(id); }
  function isCreating(id: string) { return creatingTempNodes.current.has(id); }

  function setTempEdgeId(id: string|null) { tempEdgeIdGlobal.current = id; }
  function getTempEdgeId() { return tempEdgeIdGlobal.current; }

  return {
    tempEdgeIdGlobal, setTempEdgeId, getTempEdgeId,
    stabilizedTempNodes, markStabilized, clearStabilized, isStabilized,
    creatingTempNodes, markCreating, clearCreating, isCreating
  };
}
