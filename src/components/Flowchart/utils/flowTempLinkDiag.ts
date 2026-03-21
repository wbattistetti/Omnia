/**
 * Log diagnostici per il flusso: drop su pane → nodo temp → wait handleBounds → openForEdge.
 * In produzione non emette nulla; in dev usa console con prefisso fisso per filtrare in DevTools.
 */
const PREFIX = '[Omnia:FlowLink]';

export function diagFlowLink(phase: string, data?: Record<string, unknown>): void {
    if (!import.meta.env.DEV || import.meta.env.MODE === 'test') return;
    if (data !== undefined) {
        console.info(`${PREFIX} ${phase}`, data);
    } else {
        console.info(`${PREFIX} ${phase}`);
    }
}
