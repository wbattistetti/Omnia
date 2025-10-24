import React, { createContext, useContext, useMemo, useRef, useCallback } from "react";

type Registry = Map<string, HTMLElement | null>;
type Ctx = {
    getEl: (id: string) => HTMLElement | null;
    setEl: (id: string, el: HTMLElement | null) => void;
};

const NodeRegistryContext = createContext<Ctx | null>(null);

export const NodeRegistryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const regRef = useRef<Registry>(new Map());

    const getEl = useCallback((id: string) => regRef.current.get(id) ?? null, []);
    const setEl = useCallback((id: string, el: HTMLElement | null) => {
        if (el) regRef.current.set(id, el); else regRef.current.delete(id);
    }, []);

    const value = useMemo(() => ({ getEl, setEl }), [getEl, setEl]);
    return <NodeRegistryContext.Provider value={value}>{children}</NodeRegistryContext.Provider>;
};

export const useNodeRegistry = (): Ctx => {
    const ctx = useContext(NodeRegistryContext);
    if (!ctx) throw new Error("useNodeRegistry must be used within NodeRegistryProvider");
    return ctx;
};

// Helper per i componenti nodo/edge
export const useRegisterAsNode = (id: string) => {
    const { setEl } = useNodeRegistry();
    const ref = React.useRef<HTMLElement | null>(null);
    React.useEffect(() => {
        if (id) setEl(id, ref.current);
        return () => setEl(id, null);
    }, [id, setEl]);
    return ref; // assegna a <div ref={ref} data-id={id} />
};
