import React, { useState, useEffect, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useIntellisense, IntellisenseItem } from "../../context/IntellisenseContext";
import { useNodeRegistry } from "../../context/NodeRegistryContext";
import { IntellisenseMenu } from "./IntellisenseMenu";
import { IntellisenseStandalone } from "./IntellisenseStandalone";
import { edgeLinkChoiceFromIntellisenseItem, type EdgeLinkChoice } from "./edgeLinkChoice";
import { applyEdgeLinkPipeline, type ProjectDataConditionsShape } from "./edgeLinkPipeline";
import { useProjectData, useProjectDataUpdate } from '../../context/ProjectDataContext';
import { FlowStateBridge } from '../../services/FlowStateBridge';

/** z-index sotto il pannello edge; sopra il canvas React Flow in genere. */
const EDGE_BACKDROP_Z = 100_000;

/**
 * Chiude il link-edge con un solo gestore: overlay a schermo intero sotto l’editor.
 * Evita `mousedown` su `document` + `closest(wrapper)` che si rompe con layout ritardato / portal.
 */
function EdgeIntellisenseMount({
  children,
  onDismiss,
}: {
  children: React.ReactNode;
  onDismiss: () => void;
}) {
  return (
    <>
      <div
        aria-hidden
        data-intellisense-edge-backdrop
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: EDGE_BACKDROP_Z,
          background: 'transparent',
        }}
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDismiss();
        }}
      />
      {children}
    </>
  );
}

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

    // Handler per chiudere
    const handleClose = () => {
        actions.close();
        FlowStateBridge.invokePendingEdgeConnectClear();

        // Cleanup: if it's an edge, remove temporary node and link
        if (state.target?.edgeId) {
            const cleanupTempNodesAndEdges = FlowStateBridge.getCleanupAllTempNodesAndEdges();
            if (cleanupTempNodesAndEdges) {
                cleanupTempNodesAndEdges();
            }
        }
    };

    /** Commit: `EdgeLinkChoice` è l’unica fonte di verità; dopo `close()` non si legge più `state.query`. */
    const handleEdgeLinkCommit = useCallback(
        async (choice: EdgeLinkChoice) => {
            const edgeId = state.target?.edgeId;
            actions.close();
            if (!edgeId) return;
            try {
                await applyEdgeLinkPipeline(edgeId, choice, {
                    projectData: projectData as ProjectDataConditionsShape,
                    addItem,
                    addCategory,
                });
            } finally {
                FlowStateBridge.invokePendingEdgeConnectClear();
            }
        },
        [state.target, actions, projectData, addItem, addCategory]
    );

    /** Selezione da `IntellisenseMenu` (click / Enter): stesso commit con item catalogo o sentinel. */
    const handleMenuItemSelect = useCallback(
        (item: IntellisenseItem) => {
            void handleEdgeLinkCommit(edgeLinkChoiceFromIntellisenseItem(item));
        },
        [handleEdgeLinkCommit]
    );

    if (!state.isOpen) {
        return null;
    }

    const linkMid = state.target?.linkMidScreen;
    const edgeId = state.target?.edgeId;
    const legacyEdgeAnchor =
        edgeId && rect && !linkMid
            ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
            : null;
    const edgeAnchorScreen = linkMid ?? legacyEdgeAnchor;

    if (edgeId && edgeAnchorScreen) {
        return createPortal(
            <EdgeIntellisenseMount onDismiss={handleClose}>
                <IntellisenseStandalone
                    anchorScreen={edgeAnchorScreen}
                    extraItems={state.catalog}
                    allowedKinds={['condition', 'intent']}
                    onCommit={handleEdgeLinkCommit}
                    onClose={handleClose}
                />
            </EdgeIntellisenseMount>,
            document.body
        );
    }

    if (edgeId && !edgeAnchorScreen) {
        return null;
    }

    if (!rect || !referenceElement) {
        return null;
    }

    return createPortal(
        <IntellisenseMenu
            isOpen={state.isOpen}
            query={state.query}
            position={{ x: rect.left, y: rect.bottom + 8 }}
            referenceElement={referenceElement}
            onSelect={handleMenuItemSelect}
            onClose={handleClose}
            extraItems={state.catalog}
            allowedKinds={edgeId ? ['condition', 'intent'] : undefined}
            mode="inline"
        />,
        document.body
    );
};

