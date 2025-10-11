import React from 'react';

type Status = 'idle' | 'dragging' | 'temp' | 'picking' | 'promoting';

type Ctx = {
  status: Status;
  sourceNodeId: string | null;
  sourceHandleId: string | null;
  tempNodeId: string | null;
  tempEdgeId: string | null;
  targetNodeId: string | null;
  targetHandleId: string | null;
  position: { x: number; y: number } | null;
  batchId: string | null;
};

type Action =
  | { type: 'RESET' }
  | { type: 'START_DRAG'; sourceNodeId: string; sourceHandleId?: string }
  | { type: 'CREATE_TEMP'; tempNodeId: string; tempEdgeId: string; position: { x: number; y: number }; batchId: string }
  | { type: 'OPEN_PICKER' }
  | { type: 'SET_TARGET'; targetNodeId: string | null; targetHandleId?: string | null }
  | { type: 'PROMOTING' };

const initial: Ctx = {
  status: 'idle',
  sourceNodeId: null,
  sourceHandleId: null,
  tempNodeId: null,
  tempEdgeId: null,
  targetNodeId: null,
  targetHandleId: null,
  position: null,
  batchId: null,
};

function reducer(state: Ctx, action: Action): Ctx {
  switch (action.type) {
    case 'RESET':
      return { ...initial };
    case 'START_DRAG':
      return {
        ...initial,
        status: 'dragging',
        sourceNodeId: action.sourceNodeId,
        sourceHandleId: action.sourceHandleId || null,
      };
    case 'CREATE_TEMP':
      return {
        ...state,
        status: 'temp',
        tempNodeId: action.tempNodeId,
        tempEdgeId: action.tempEdgeId,
        position: action.position,
        batchId: action.batchId,
      };
    case 'OPEN_PICKER':
      return { ...state, status: 'picking' };
    case 'SET_TARGET':
      return { ...state, targetNodeId: action.targetNodeId, targetHandleId: action.targetHandleId || null };
    case 'PROMOTING':
      return { ...state, status: 'promoting' };
    default:
      return state;
  }
}

export function useConnectionController() {
  const [state, dispatch] = React.useReducer(reducer, initial);

  const isLocked = React.useMemo(() => state.status === 'promoting', [state.status]);

  // helper per reset hard
  const hardReset = React.useCallback(() => dispatch({ type: 'RESET' }), []);

  type PromoteAPI = {
    setNodes: (updater: (nds: any[]) => any[]) => void;
    setEdges: (updater: (eds: any[]) => any[]) => void;
    finalize: (keepNodeId: string, keepEdgeId?: string) => void;
    generateId: () => string;
    getSource: () => { sourceNodeId?: string; sourceHandleId?: string; targetHandleId?: string };
  };

  const promoteTempWithLabel = React.useCallback((label: string, api: PromoteAPI): string | null => {
    if (state.status === 'promoting') return null;
    if (!state.tempNodeId) return null;
    dispatch({ type: 'PROMOTING' });
    let createdEdgeId: string | null = null;
    // 1) marca nodo non temporaneo e rimuovi qualsiasi altro nodo del batch
    const batchId = state.batchId;
    let removedIds: string[] = [];
    api.setNodes((nds) => {
      // rimuovi tutti i nodi del medesimo batch ad eccezione del temp da promuovere
      removedIds = nds.filter((n: any) => n.id !== state.tempNodeId && (n?.data?.batchId && n.data.batchId === batchId)).map((n: any) => n.id);
      const mapped = nds.map((n: any) => n.id === state.tempNodeId
        ? { ...n, data: { ...(n.data || {}), isTemporary: false, hidden: false, batchId: undefined, focusRowId: '1' } }
        : n);
      return mapped.filter((n: any) => !removedIds.includes(n.id));
    });
    // 2) etichetta edge temporaneo o crealo
    if (state.tempEdgeId) {
      const edgeId = state.tempEdgeId;
      api.setEdges((eds) => {
        const filtered = eds.filter((e: any) => !removedIds.includes(e.source) && !removedIds.includes(e.target));
        let found = false;
        const mapped = filtered.map((e: any) => {
          if (e.id === edgeId) { found = true; return { ...e, label, style: { ...(e.style || {}), stroke: '#8b5cf6' }, data: { ...(e.data || {}) } }; }
          return e;
        });
        if (!found) {
          const src = api.getSource();
          mapped.push({
            id: edgeId,
            source: src.sourceNodeId || '',
            sourceHandle: src.sourceHandleId || undefined,
            target: state.tempNodeId,
            targetHandle: src.targetHandleId || undefined,
            style: { stroke: '#8b5cf6' },
            label,
            type: 'custom',
            data: {},
            markerEnd: 'arrowhead'
          } as any);
        }
        return mapped;
      });
      createdEdgeId = edgeId;
    } else {
      const gen = api.generateId();
      const src = api.getSource();
      api.setEdges((eds) => ([
        ...eds.filter((e: any) => !removedIds.includes(e.source) && !removedIds.includes(e.target)),
        {
        id: gen,
        source: src.sourceNodeId || '',
        sourceHandle: src.sourceHandleId || undefined,
        target: state.tempNodeId,
        targetHandle: src.targetHandleId || undefined,
        style: { stroke: '#8b5cf6' },
        label,
        type: 'custom',
        data: {},
        markerEnd: 'arrowhead'
      } ]));
      createdEdgeId = gen;
    }
    // 3) finalize + reset
    api.finalize(state.tempNodeId, state.tempEdgeId || undefined);
    dispatch({ type: 'RESET' });
    return createdEdgeId;
  }, [state]);

  type LinkAPI = {
    setEdges: (updater: (eds: any[]) => any[]) => void;
    generateId: () => string;
    cleanup: () => void; // close menu + cleanup temps/targets
  };

  const linkExistingWithLabel = React.useCallback((label: string, api: LinkAPI): string | null => {
    if (state.status === 'promoting') return null;
    const src = state.sourceNodeId; const tgt = state.targetNodeId;
    if (!src || !tgt) return null;
    const id = api.generateId();
    api.setEdges((eds) => ([...eds, {
      id,
      source: src,
      sourceHandle: state.sourceHandleId || undefined,
      target: tgt,
      targetHandle: state.targetHandleId || undefined,
      style: { stroke: '#8b5cf6' },
      label,
      type: 'custom',
      data: {},
      markerEnd: 'arrowhead'
    }]));
    api.cleanup();
    dispatch({ type: 'RESET' });
    return id;
  }, [state]);

  return {
    state,
    dispatch,
    isLocked,
    hardReset,
    promoteTempWithLabel,
    linkExistingWithLabel,
  };
}


