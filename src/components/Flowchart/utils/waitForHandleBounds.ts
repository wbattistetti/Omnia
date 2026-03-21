import { internalsSymbol } from 'reactflow';
import { diagFlowLink } from './flowTempLinkDiag';

/**
 * Store React Flow (useStoreApi) con nodeInternals aggiornati dopo il layout.
 */
export type ReactFlowStoreLike = {
    getState: () => { nodeInternals: Map<string, unknown> };
    subscribe: (listener: () => void) => () => void;
};

/**
 * Attende che React Flow 11 abbia misurato `handleBounds.target` per il nodo.
 * Usa `node[internalsSymbol].handleBounds` (non `node.handleBounds`).
 */
export function waitForHandleBounds(
    store: ReactFlowStoreLike,
    nodeId: string,
    timeoutMs = 2000,
): Promise<unknown> {
    return new Promise((resolve, reject) => {
        let unsub: (() => void) | undefined;
        let timer: ReturnType<typeof setTimeout> | undefined;
        let checkCount = 0;
        let lastDiagKey = '';

        const cleanup = () => {
            unsub?.();
            if (timer !== undefined) {
                clearTimeout(timer);
                timer = undefined;
            }
        };

        const check = () => {
            checkCount += 1;
            const n = store.getState().nodeInternals.get(nodeId) as any;
            const handles = n?.[internalsSymbol]?.handleBounds?.target;
            const targetLen = handles?.length ?? 0;
            const key = n ? `node:${targetLen}` : 'no-node';
            if (key !== lastDiagKey) {
                lastDiagKey = key;
                diagFlowLink('waitForHandleBounds:state', {
                    nodeId,
                    checkCount,
                    hasInternalEntry: !!n,
                    targetHandleCount: targetLen,
                    targetIds: Array.isArray(handles) ? handles.map((h: { id?: string }) => h?.id) : [],
                });
            }
            if (handles?.length) {
                cleanup();
                diagFlowLink('waitForHandleBounds:resolved', {
                    nodeId,
                    checkCount,
                    targetHandleCount: handles.length,
                    targetIds: handles.map((h: { id?: string }) => h?.id),
                });
                resolve(n);
            }
        };

        diagFlowLink('waitForHandleBounds:start', { nodeId, timeoutMs });
        unsub = store.subscribe(check);
        timer = setTimeout(() => {
            const n = store.getState().nodeInternals.get(nodeId) as any;
            const handles = n?.[internalsSymbol]?.handleBounds?.target;
            diagFlowLink('waitForHandleBounds:timeout', {
                nodeId,
                checkCount,
                timeoutMs,
                hasInternalEntry: !!n,
                targetHandleCount: handles?.length ?? 0,
            });
            cleanup();
            reject(
                new Error(
                    `waitForHandleBounds: timeout waiting for handleBounds.target on node ${nodeId}`,
                ),
            );
        }, timeoutMs);

        check();
    });
}
