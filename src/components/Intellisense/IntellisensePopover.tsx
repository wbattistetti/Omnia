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

    // Log quando lo stato cambia - solo quando si apre/chiude
    useEffect(() => {
        if (state.isOpen) {
            console.log("🎯 [IntellisensePopover] OPENED:", {
                targetNodeId: state.target?.nodeId,
                targetEdgeId: state.target?.edgeId,
                catalogLength: state.catalog.length,
                firstItems: state.catalog.slice(0, 3).map(item => ({ id: item.id, label: item.label })),
                timestamp: Date.now()
            });
        } else {
            console.log("🎯 [IntellisensePopover] CLOSED");
        }
    }, [state.isOpen]);

    // Calcola anchor quando si apre o cambia target - NO POLLING!
    useLayoutEffect(() => {

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

        if (!el) {
            setRect(null);
            setReferenceElement(null);
            return;
        }

        setReferenceElement(el);
        const nodeRect = el.getBoundingClientRect();
        setRect(nodeRect);

        // ✅ Log rimosso per evitare spam
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

    // ✅ Click fuori → Chiudi e cleanup
    useEffect(() => {
        if (!state.isOpen || !state.target?.edgeId) return;

        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Element;
            // ✅ Ignora click dentro il wrapper Intellisense
            if (target.closest('.intellisense-standalone-wrapper')) {
                return;
            }
            // ✅ Click fuori → Chiudi e cleanup
            console.log("🎯 [IntellisensePopover] Click outside - closing and cleanup");
            actions.close();

            // ✅ CLEANUP: Cancella nodo temporaneo e edge
            const cleanupTempNodesAndEdges = (window as any).__cleanupAllTempNodesAndEdges;
            if (cleanupTempNodesAndEdges) {
                cleanupTempNodesAndEdges();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [state.isOpen, state.target, actions]);

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
            const edgeId = state.target.edgeId;

            // ✅ GESTISCI CASI SPECIALI
            let label: string | undefined;
            let isElse = false;

            if (item && (item as any).id === '__else__') {
                // ✅ Caso Else
                label = 'Else';
                isElse = true;
                console.log("🎯 [IntellisensePopover] Else button clicked");
            } else if (item && (item as any).id === '__unlinked__') {
                // ✅ Caso Unlinked (nessuna label)
                label = undefined;
                console.log("🎯 [IntellisensePopover] Unlinked button clicked");
            } else if (item) {
                // ✅ Condizione normale dall'Intellisense
                label = item.label;
                console.log("🎯 [IntellisensePopover] Condition selected:", label);
            } else {
                // ✅ Testo digitato (Enter senza selezione)
                label = state.query || "Condition";
                console.log("🎯 [IntellisensePopover] Custom text entered:", label);
            }

            console.log("🎯 [IntellisensePopover] Processing edge selection:", {
                edgeId,
                label,
                isElse,
                selectedItem: item
            });

            // ✅ 3. Aggiorna l'edge
            const scheduleApplyLabel = (window as any).__scheduleApplyLabel;
            const setEdges = (window as any).__setEdges;

            if (scheduleApplyLabel && label !== undefined) {
                scheduleApplyLabel(edgeId, label);
                console.log("🎯 [IntellisensePopover] Edge label scheduled:", label);
            } else if (setEdges) {
                setEdges((eds: any[]) => eds.map(e =>
                    e.id === edgeId
                        ? { ...e, label, data: { ...(e.data || {}), label, isElse } }
                        : e
                ));
                console.log("🎯 [IntellisensePopover] Edge updated:", { label, isElse });
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

    if (!state.isOpen || !rect || !referenceElement) {
        return null;
    }

    // ✅ Log rimosso per evitare spam

    // ✅ Calcola posizione centrata sul nodo di DESTINAZIONE (hidden)
    // La freccia deve puntare al CENTRO della textbox!
    // Formula: textbox_left = arrowX - (textbox_width / 2)
    const centeredPosition = state.target?.edgeId && rect
        ? (() => {
            // ✅ Larghezze fisse dei pulsanti (come definito in IntellisenseStandalone)
            const elseButtonWidth = 40; // circa (padding 3px 8px + testo "Else" 8px)
            const iconButtonWidth = 20; // LinkOff button
            const cancelButtonWidth = 20; // X button
            const gap = 6; // gap tra elementi

            // Larghezza totale dei pulsanti + gap
            const buttonsTotalWidth = elseButtonWidth + iconButtonWidth + cancelButtonWidth + (gap * 2);

            // La textbox ha flex: 0.5, quindi occupa circa la metà dello spazio rimanente
            // Wrapper totale è 420px - padding 24px = 396px disponibili
            const availableWidth = 396; // 420px wrapper - 24px padding
            const textboxWidth = (availableWidth - buttonsTotalWidth) * 0.5; // flex: 0.5

            // ✅ FORMULA CORRETTA: textbox_left = arrowX - (textbox_width / 2)
            const arrowX = rect.left + (rect.width / 2);
            const textboxLeft = arrowX - (textboxWidth / 2);

            // Il wrapper inizia a: textboxLeft - padding (12px)
            const wrapperX = textboxLeft - 12;

            // console.log("🎯 [IntellisensePopover] Centering calculation:", {
            //     arrowX,
            //     textboxWidth,
            //     textboxLeft,
            //     wrapperX,
            //     rect: { left: rect.left, width: rect.width, center: rect.left + (rect.width / 2) }
            // });

            return {
                x: wrapperX,
                y: rect.top - 8
            };
        })()
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

