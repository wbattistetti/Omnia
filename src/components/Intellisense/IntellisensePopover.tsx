import React, { useState, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { useIntellisense, IntellisenseItem } from "../../context/IntellisenseContext";
import { useNodeRegistry } from "../../context/NodeRegistryContext";
import { IntellisenseMenu } from "./IntellisenseMenu";
import { IntellisenseStandalone } from "./IntellisenseStandalone"; // ✅ NUOVO IMPORT

export const IntellisensePopover: React.FC = () => {
    const { state, actions } = useIntellisense();
    const { getEl } = useNodeRegistry();
    const [rect, setRect] = useState<DOMRect | null>(null);
    const [referenceElement, setReferenceElement] = useState<HTMLElement | null>(null);

    // Log quando lo stato cambia
    useEffect(() => {
        console.log("🎯 [IntellisensePopover] State changed:", {
            isOpen: state.isOpen,
            target: state.target,
            catalogLength: state.catalog.length,
            query: state.query
        });
    }, [state.isOpen, state.target, state.catalog, state.query]);

    // Calcola anchor quando si apre o cambia target - NO POLLING!
    useLayoutEffect(() => {
        if (!state.isOpen || !state.target) {
            setRect(null);
            setReferenceElement(null);
            return;
        }

        let elementId = state.target.nodeId;

        // Se è un edge, trova il nodo temporaneo associato
        if (state.target.edgeId && !state.target.nodeId) {
            const flowEdges = (window as any).__flowEdges || [];
            const edge = flowEdges.find((e: any) => e.id === state.target!.edgeId);
            if (edge && edge.target) {
                elementId = edge.target;
                console.log("🎯 [IntellisensePopover] Found temporary node for edge:", {
                    edgeId: state.target.edgeId,
                    tempNodeId: elementId
                });
            }
        }

        if (!elementId) {
            setRect(null);
            setReferenceElement(null);
            return;
        }

        const el = getEl(elementId);

        if (!el) {
            setRect(null);
            setReferenceElement(null);
            return;
        }

        setReferenceElement(el);
        setRect(el.getBoundingClientRect());
    }, [state.isOpen, state.target, getEl]);

    // Aggiorna su resize/scroll
    useEffect(() => {
        if (!state.isOpen || !state.target) return;

        const handler = () => {
            let elementId = state.target!.nodeId;

            // Se è un edge, trova il nodo temporaneo associato
            if (state.target!.edgeId && !state.target!.nodeId) {
                const flowEdges = (window as any).__flowEdges || [];
                const edge = flowEdges.find((e: any) => e.id === state.target!.edgeId);
                if (edge && edge.target) {
                    elementId = edge.target;
                }
            }

            if (!elementId) return;

            const el = getEl(elementId);
            if (el) {
                setRect(el.getBoundingClientRect());
            }
        };

        window.addEventListener("resize", handler);
        window.addEventListener("scroll", handler, true);

        return () => {
            window.removeEventListener("resize", handler);
            window.removeEventListener("scroll", handler, true);
        };
    }, [state.isOpen, state.target, getEl]);

    // Handler per chiudere
    const handleClose = () => {
        actions.close();
    };

    // Handler per selezione
    const handleSelect = (item: IntellisenseItem) => {
        // TODO: Implement selection logic
        console.log("Item selected:", item);
        actions.close();
    };

    if (!state.isOpen || !rect || !referenceElement) return null;

    // ✅ Log solo quando cambiano i valori importanti (riduci rumore)
    const shouldLog = state.catalog.length > 0 || state.query !== '';
    if (shouldLog) {
        console.debug("🎯 [IntellisensePopover] Rendering with:", {
            catalogSize: state.catalog.length,
            targetNodeId: state.target?.nodeId,
            targetEdgeId: state.target?.edgeId,
            query: state.query
        });
    }

    // Usa il componente appropriato in base al target
    return createPortal(
        <div style={{ border: '2px solid red', backgroundColor: 'rgba(255, 0, 0, 0.1)' }}>
            {state.target?.edgeId ? (
                // ✅ CASO EDGE: usa il wrapper standalone
                <IntellisenseStandalone
                    position={{ x: rect.left, y: rect.bottom + 8 }}
                    referenceElement={referenceElement}
                    extraItems={state.catalog}
                    allowedKinds={['condition', 'intent']}
                    onSelect={handleSelect}
                    onClose={handleClose}
                />
            ) : (
                // ✅ CASO RIGA NODO: usa il menu normale
                <IntellisenseMenu
                    isOpen={state.isOpen}
                    query={state.query}
                    position={{ x: rect.left, y: rect.bottom + 8 }}
                    referenceElement={referenceElement}
                    onSelect={handleSelect}
                    onClose={handleClose}
                    extraItems={state.catalog}
                    allowedKinds={state.target?.edgeId ? ['condition', 'intent'] : undefined}
                    mode="inline"
                />
            )}
        </div>,
        document.body
    );
};

