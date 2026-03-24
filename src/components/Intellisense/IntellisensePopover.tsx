import React, { useState, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { useIntellisense, IntellisenseItem } from "../../context/IntellisenseContext";
import { useNodeRegistry } from "../../context/NodeRegistryContext";
import { IntellisenseMenu } from "./IntellisenseMenu";
import { IntellisenseStandalone } from "./IntellisenseStandalone";
import { useProjectData, useProjectDataUpdate } from '../../context/ProjectDataContext';
import { FlowStateBridge } from '../../services/FlowStateBridge';
import { generateId } from '../../utils/idGenerator';
import { TaskType } from '../../types/taskTypes';

export const IntellisensePopover: React.FC = () => {
    const { state, actions } = useIntellisense();
    const { data: projectData } = useProjectData();
    const { addItem, addCategory } = useProjectDataUpdate();
    const { getEl } = useNodeRegistry();
    const [rect, setRect] = useState<DOMRect | null>(null);
    const [referenceElement, setReferenceElement] = useState<HTMLElement | null>(null);

    // RIMOSSO: useEffect che causava loop infinito

    // Calcola anchor quando si apre o cambia target - NO POLLING!
    useLayoutEffect(() => {

        if (!state.isOpen || !state.target) {
            setRect(null);
            setReferenceElement(null);
            return;
        }

        if (state.target.edgeId && state.target.linkMidScreen) {
            setRect(null);
            setReferenceElement(null);
            return;
        }

        let elementId = state.target.nodeId;

        // Step 4: edge anchoring should come from linkMidScreen; avoid bridge node/edge lookup.
        if (state.target.edgeId && !state.target.nodeId) {
            setRect(null);
            setReferenceElement(null);
            return;
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
        if (state.target.edgeId && state.target.linkMidScreen) return;

        const handler = () => {
            let elementId = state.target!.nodeId;

            if (state.target!.edgeId && !state.target!.nodeId) {
                return;
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
            actions.close();

            // Cleanup: remove temporary node and edge
            const cleanupTempNodesAndEdges = FlowStateBridge.getCleanupAllTempNodesAndEdges();
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

        // Cleanup: if it's an edge, remove temporary node and link
        if (state.target?.edgeId) {
            const cleanupTempNodesAndEdges = FlowStateBridge.getCleanupAllTempNodesAndEdges();
            if (cleanupTempNodesAndEdges) {
                cleanupTempNodesAndEdges();
            }
        }
    };

    // Handler per selezione
    const handleSelect = async (item: IntellisenseItem | null) => {
        // ✅ 1. Chiudi Intellisense
        actions.close();

        // ✅ 2. Se è un edge, rendi visibile il nodo temporaneo e aggiorna l'edge
        if (state.target?.edgeId) {
            const edgeId = state.target.edgeId;
            const isUnconditional = !!(item && (item as any).id === '__unlinked__');

            // ✅ GESTISCI CASI SPECIALI
            let label: string | undefined;
            let isElse = false;
            let conditionId: string | undefined;

            if (item && (item as any).id === '__else__') {
                // Caso Else
                label = 'Else';
                isElse = true;
            } else if (item && (item as any).id === '__unlinked__') {
                // Caso Unlinked (nessuna label)
                label = undefined;
            } else if (item) {
                // Condizione dall'Intellisense
                label = item.label;
                conditionId = item.taskId || item.id; // ✅ taskId required
            } else {
                // Testo digitato (Enter senza selezione) - CREA CONDIZIONE
                const customText = (state.query || "Condition").trim();
                label = customText;

                // Verifica se esiste già
                const conditions = (projectData as any)?.conditions || [];
                let found = false;
                for (const cat of conditions) {
                    for (const condItem of cat.items || []) {
                        const condName = String(condItem?.name || condItem?.label || '').trim();
                        if (condName.toLowerCase() === customText.toLowerCase()) {
                            conditionId = condItem.id || condItem._id;
                            found = true;
                            break;
                        }
                    }
                    if (found) break;
                }

                // Se non esiste, creala
                if (!found) {
                    try {
                        let categoryId = conditions.length > 0 ? conditions[0].id : '';
                        if (!categoryId) {
                            await addCategory('conditions', 'Default Conditions');
                            const { ProjectDataService } = await import('../../services/ProjectDataService');
                            const refreshed = await ProjectDataService.loadProjectData();
                            categoryId = (refreshed as any)?.conditions?.[0]?.id || '';
                        }

                        if (categoryId) {
                            await addItem('conditions', categoryId, customText, '');

                            // Ricarica per ottenere l'ID
                            const { ProjectDataService } = await import('../../services/ProjectDataService');
                            const refreshed = await ProjectDataService.loadProjectData();
                            const created = (refreshed as any)?.conditions?.[0]?.items?.find((i: any) => i.name === customText);
                            conditionId = created?.id || created?._id;

                            // Forza refresh sidebar
                            (await import('../../ui/events')).emitSidebarForceRender();
                            setTimeout(async () => {
                                try { (await import('../../ui/events')).emitSidebarHighlightItem('conditions', customText); } catch { }
                            }, 100);
                        }
                    } catch (e) {
                        console.error("Error creating condition:", e);
                    }
                }
            }

            // Update the edge
            const scheduleApplyLabel = FlowStateBridge.getScheduleApplyLabel();
            const setEdges = FlowStateBridge.getSetEdges();

            let targetNodeId: string | null = null;
            if (scheduleApplyLabel && label !== undefined) {
                const extraData: any = {};
                if (conditionId) extraData.conditionId = conditionId;
                if (isElse) extraData.isElse = true;

                scheduleApplyLabel(edgeId, label, Object.keys(extraData).length > 0 ? extraData : undefined);
            } else if (setEdges) {
                setEdges((eds: any[]) => eds.map(e => {
                    if (e.id === edgeId) {
                        targetNodeId = e.target || null;
                        return {
                            ...e,
                            label,
                            data: {
                                ...(e.data || {}),
                                label,
                                isElse,
                                conditionId: conditionId || (e.data as any)?.conditionId
                            }
                        };
                    }
                    return e;
                }));
            }

            const setNodes = FlowStateBridge.getSetNodes();
            if (!targetNodeId && setEdges) {
                setEdges((eds: any[]) =>
                    eds.map((e) => {
                        if (e.id === edgeId) targetNodeId = e.target || null;
                        return e;
                    })
                );
            }
            if (setNodes && targetNodeId) {
                setNodes((nds: any[]) =>
                    nds.map((n) => {
                        if (n.id !== targetNodeId) return n;
                        if (isUnconditional) {
                            const newRowId = generateId();
                            return {
                                ...n,
                                data: {
                                    ...n.data,
                                    hidden: false,
                                    rows: [
                                        ...(n.data?.rows || []),
                                        {
                                            id: newRowId,
                                            text: '',
                                            included: true,
                                            heuristics: { type: TaskType.Flow, templateId: null },
                                        },
                                    ],
                                    focusRowId: newRowId,
                                },
                            };
                        }
                        return { ...n, data: { ...n.data, hidden: false } };
                    })
                );
            }
        }
    };

    if (!state.isOpen) {
        return null;
    }

    const linkMid = state.target?.linkMidScreen;
    if (state.target?.edgeId && linkMid) {
        return createPortal(
            <IntellisenseStandalone
                anchorScreen={linkMid}
                extraItems={state.catalog}
                allowedKinds={['condition', 'intent']}
                onSelect={handleSelect}
                onClose={handleClose}
            />,
            document.body
        );
    }

    if (!rect || !referenceElement) {
        return null;
    }

    const legacyEdgeAnchor =
        state.target?.edgeId && rect
            ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
            : null;

    return createPortal(
        <>
            {state.target?.edgeId && legacyEdgeAnchor ? (
                <IntellisenseStandalone
                    anchorScreen={legacyEdgeAnchor}
                    extraItems={state.catalog}
                    allowedKinds={['condition', 'intent']}
                    onSelect={handleSelect}
                    onClose={handleClose}
                />
            ) : (
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

