/**
 * Row-drag policy: Subflow (flow) tasks cannot be dropped onto a different flow canvas until
 * cross-canvas variable/interface rules are defined.
 */

import { normalizeFlowCanvasId } from '../../FlowMappingPanel/flowInterfaceDragTypes';
import { TaskType } from '@types/taskTypes';

export const OMNIA_FLOW_CANVAS_HOST_SELECTOR = '[data-omnia-flow-canvas-id]';

/** Resolves normalized flow canvas id for the FlowEditor host under the pointer (dual-pane safe). */
export function resolveFlowCanvasIdUnderPointer(clientX: number, clientY: number): string | null {
    let el: Element | null = null;
    try {
        el = document.elementFromPoint(clientX, clientY);
    } catch {
        return null;
    }
    if (!el) return null;
    const host = el.closest(OMNIA_FLOW_CANVAS_HOST_SELECTOR);
    if (!host) return null;
    const raw = host.getAttribute('data-omnia-flow-canvas-id');
    if (raw == null || !String(raw).trim()) return null;
    return normalizeFlowCanvasId(raw);
}

export function shouldCancelSubflowTaskDropOnForeignCanvas(
    taskType: TaskType | undefined,
    originCanvasId: string | undefined,
    dropCanvasId: string | null
): boolean {
    if (taskType !== TaskType.Subflow) return false;
    if (!dropCanvasId) return false;
    return normalizeFlowCanvasId(originCanvasId) !== dropCanvasId;
}
