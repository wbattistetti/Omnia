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
        console.log("🎯 [IntellisensePopover useLayoutEffect] TRIGGERED", {
            isOpen: state.isOpen,
            target: state.target
        });

        if (!state.isOpen || !state.target) {
            setRect(null);
            setReferenceElement(null);
            return;
        }

        let elementId = state.target.nodeId;

        // Se è un edge, trova il nodo di DESTINAZIONE (temporaneo)
        if (state.target.edgeId && !state.target.nodeId) {
            const flowEdges = (window as any).__flowEdges || [];
            const edge = flowEdges.find((e: any) => e.id === state.target!.edgeId);
            if (edge && edge.target) {
                elementId = edge.target; // ✅ Questo è il nodo di DESTINAZIONE
                console.log("🎯 [IntellisensePopover] Found DESTINATION node for edge:", {
                    edgeId: state.target.edgeId,
                    destinationNodeId: elementId,
                    sourceNodeId: edge.source
                });
            }
        }

        if (!elementId) {
            setRect(null);
            setReferenceElement(null);
            return;
        }

        const el = getEl(elementId);

        // ✅ DEBUG CRITICO: Verifica quale nodo stiamo realmente prendendo
        console.log("🎯 [IntellisensePopover] getEl() result:", {
            elementId,
            el,
            elFound: !!el,
            isEdge: !!state.target.edgeId
        });

        if (el) {
            console.log("🎯 [IntellisensePopover] ACTUAL ELEMENT FOUND:", {
                elementId,
                elementTag: el.tagName,
                elementClass: el.className,
                elementRect: el.getBoundingClientRect(),
                elementDataId: el.getAttribute('data-id'),
                isDestinationNode: elementId === state.target?.edgeId ? 'DESTINATION' : 'OTHER'
            });
        } else {
            console.error("❌ [IntellisensePopover] ELEMENT NOT FOUND IN REGISTRY:", {
                elementId,
                isEdge: !!state.target.edgeId,
                targetEdgeId: state.target.edgeId
            });
        }

        if (!el) {
            setRect(null);
            setReferenceElement(null);
            return;
        }

        setReferenceElement(el);
        const nodeRect = el.getBoundingClientRect();
        setRect(nodeRect);

        // ✅ Log dettagliato per debug posizione
        if (state.target.edgeId) {
            console.log("🎯 [IntellisensePopover useLayoutEffect] Dest node rect:", {
                elementId,
                isEdge: !!state.target.edgeId,
                rect: {
                    left: nodeRect.left,
                    top: nodeRect.top,
                    width: nodeRect.width,
                    height: nodeRect.height,
                    centerX: nodeRect.left + (nodeRect.width / 2)
                },
                wrapperWillBeAt: {
                    x: nodeRect.left + (nodeRect.width / 2) - 160,
                    y: nodeRect.top - 200 - 8
                }
            });
        }
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
    const handleSelect = (item: IntellisenseItem | null) => {
        console.log("Item selected or text entered:", item ? item.label : "TEXT_INPUT");

        // ✅ 1. Chiudi Intellisense
        actions.close();

        // ✅ 2. Se è un edge, rendi visibile il nodo temporaneo e aggiorna l'edge
        if (state.target?.edgeId) {
            console.log("🎯 [IntellisensePopover] Processing edge selection:", {
                edgeId: state.target.edgeId,
                selectedItem: item,
                query: state.query
            });

            // ✅ 3. Aggiorna l'edge con la label (caption sul link)
            const edgeId = state.target.edgeId;

            // ✅ DETERMINA LA LABEL: se item esiste usa item.label, altrimenti usa il testo della query
            const label = item ? item.label : (state.query || "Condition");

            // Cerca la funzione scheduleApplyLabel o setEdges nel window object
            const scheduleApplyLabel = (window as any).__scheduleApplyLabel;
            const setEdges = (window as any).__setEdges;

            if (scheduleApplyLabel) {
                // Usa la funzione esistente di scheduling
                scheduleApplyLabel(edgeId, label);
                console.log("🎯 [IntellisensePopover] Edge label scheduled:", label);
            } else if (setEdges) {
                // Aggiorna direttamente gli edges con la caption
                setEdges((eds: any[]) => eds.map(e =>
                    e.id === edgeId ? { ...e, label, data: { ...(e.data || {}), label } } : e
                ));
                console.log("🎯 [IntellisensePopover] Edge label applied:", label);
            }

            // ✅ 4. Rendi visibile il nodo temporaneo (SENZA modificare il titolo)
            const flowEdges = (window as any).__flowEdges || [];
            const edge = flowEdges.find((e: any) => e.id === edgeId);

            if (edge && edge.target) {
                const flowNodes = (window as any).__flowNodes || [];
                const tempNode = flowNodes.find((n: any) => n.id === edge.target);

                if (tempNode && tempNode.data) {
                    // ✅ Rimuovi solo hidden, NON modificare il titolo
                    tempNode.data.hidden = false;

                    console.log("🎯 [IntellisensePopover] Node made visible:", {
                        nodeId: tempNode.id
                    });

                    // Aggiorna anche il nodo nello stato (solo hidden)
                    const setNodes = (window as any).__setNodes;
                    if (setNodes) {
                        setNodes((nds: any[]) => nds.map(n =>
                            n.id === tempNode.id ? { ...n, data: { ...n.data, hidden: false } } : n
                        ));
                    }
                }
            }
        }
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

    // ✅ Calcola posizione centrata sul nodo di DESTINAZIONE (hidden)
    const wrapperWidth = 320;
    const wrapperHeight = 200;
    const centeredPosition = state.target?.edgeId && rect
        ? {
            // Centra orizzontalmente rispetto al nodo di destinazione
            x: rect.left + (rect.width / 2) - (wrapperWidth / 2),
            // ✅ CORRETTO: Posiziona il top del wrapper 8px sopra il top del nodo
            y: rect.top - 8
        }
        : null;

    // ✅ Log solo UNA VOLTA (non nel render loop)
    // Spostato nel useLayoutEffect

    // Usa il componente appropriato in base al target
    return createPortal(
        <>
            {state.target?.edgeId && centeredPosition ? (
                // ✅ CASO EDGE: usa il wrapper standalone con posizione centrata
                <IntellisenseStandalone
                    position={centeredPosition}
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
        </>,
        document.body
    );
};

