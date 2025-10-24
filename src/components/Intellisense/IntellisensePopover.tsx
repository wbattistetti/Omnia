import React, { useState, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { useIntellisense, IntellisenseItem } from "../../context/IntellisenseContext";
import { useNodeRegistry } from "../../context/NodeRegistryContext";
import { IntellisenseMenu } from "./IntellisenseMenu";

export const IntellisensePopover: React.FC = () => {
    const { state, actions } = useIntellisense();
    const { getEl } = useNodeRegistry();
    const [rect, setRect] = useState<DOMRect | null>(null);
    const [referenceElement, setReferenceElement] = useState<HTMLElement | null>(null);

    // Calcola anchor quando si apre o cambia target - NO POLLING!
    useLayoutEffect(() => {
        if (!state.isOpen || !state.target) {
            setRect(null);
            setReferenceElement(null);
            return;
        }

        const id = state.target.nodeId ?? state.target.edgeId!;
        const el = getEl(id);

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
            const id = state.target!.nodeId ?? state.target!.edgeId!;
            const el = getEl(id);
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

    console.log("🎯 [IntellisensePopover] Rendering with:", {
        catalogSize: state.catalog.length,
        targetNodeId: state.target?.nodeId,
        targetEdgeId: state.target?.edgeId,
        query: state.query
    });

    // Usa il componente IntellisenseMenu esistente
    // Il filtering è già fatto dal service layer, passiamo tutto il catalog
    return createPortal(
        <div style={{ border: '2px solid red', backgroundColor: 'rgba(255, 0, 0, 0.1)' }}>
            <IntellisenseMenu
                isOpen={state.isOpen}
                query={state.query}
                position={{ x: rect.left, y: rect.bottom + 8 }}
                referenceElement={referenceElement}
                onSelect={handleSelect}
                onClose={handleClose}
                extraItems={state.catalog}
            />
        </div>,
        document.body
    );
};

