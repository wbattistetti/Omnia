import React, { createContext, useContext, useMemo, useReducer, useCallback } from "react";
import { IntellisenseAction, IntellisenseState, IntellisenseTarget, IntellisenseItem } from "../types/intellisense";
import { IntellisenseService, GraphProviders } from "../services/IntellisenseService";

const initialState: IntellisenseState = {
    isOpen: false,
    target: null,
    query: "",
    catalog: [],
    highlighted: 0,
    debug: false,
};

function reducer(s: IntellisenseState, a: IntellisenseAction): IntellisenseState {
    console.debug('[IntellisenseContext] Reducer:', a.type);

    switch (a.type) {
        case "OPEN_WITH_ITEMS": {
            const open = (a.items?.length ?? 0) > 0;
            console.debug('[IntellisenseContext] OPEN_WITH_ITEMS:', {
                itemsCount: a.items?.length,
                willOpen: open,
                target: a.target
            });
            return { ...s, isOpen: open, target: a.target, catalog: a.items, query: "", highlighted: 0 };
        }
        case "CLOSE":
            return { ...s, isOpen: false, target: null, query: "", catalog: [], highlighted: 0 };
        case "SET_QUERY":
            return { ...s, query: a.query, highlighted: 0 };
        case "MOVE_HIGHLIGHT": {
            const n = s.catalog.length || 1;
            const idx = ((s.highlighted + a.delta) % n + n) % n;
            return { ...s, highlighted: idx };
        }
        case "SET_DEBUG":
            return { ...s, debug: a.debug };
        default:
            return s;
    }
}

type Ctx = {
    state: IntellisenseState;
    dispatch: React.Dispatch<IntellisenseAction>;
    actions: {
        openForEdge(edgeId: string): void;
        close(): void;
        setQuery(q: string): void;
        moveHighlight(delta: number): void;
    };
};

const IntellisenseContext = createContext<Ctx | null>(null);

/** Provider accetta i providers del grafo e crea il service */
export const IntellisenseProvider: React.FC<{ providers: GraphProviders; children: React.ReactNode }> = ({ providers, children }) => {
    const [state, dispatch] = useReducer(reducer, initialState);
    const service = useMemo(() => new IntellisenseService(providers), [providers]);

    // Actions → tieni il reducer puro, chiama il service FUORI dal reducer
    const openForEdge = useCallback((edgeId: string) => {
        console.log("🎯 [IntellisenseContext] openForEdge called with edgeId:", edgeId);

        const items = service.getEdgeItems(edgeId);
        console.log("🎯 [IntellisenseContext] Items from service:", {
            totalItems: items.length,
            items: items.map(i => ({ id: i.id, label: i.label, kind: i.kind }))
        });

        dispatch({ type: "OPEN_WITH_ITEMS", target: { edgeId }, items });
    }, [service]);

    const close = useCallback(() => dispatch({ type: "CLOSE" }), []);
    const setQuery = useCallback((q: string) => dispatch({ type: "SET_QUERY", query: q }), []);
    const moveHighlight = useCallback((d: number) => dispatch({ type: "MOVE_HIGHLIGHT", delta: d }), []);

    const value = useMemo<Ctx>(
        () => ({ state, dispatch, actions: { openForEdge, close, setQuery, moveHighlight } }),
        [state, openForEdge, close, setQuery, moveHighlight]
    );

    return <IntellisenseContext.Provider value={value}>{children}</IntellisenseContext.Provider>;
};

export const useIntellisense = (): Ctx => {
    const ctx = useContext(IntellisenseContext);
    if (!ctx) throw new Error("useIntellisense must be used within IntellisenseProvider");
    return ctx;
};

// Re-export types for convenience
export type { IntellisenseItem, IntellisenseTarget } from "../types/intellisense";
