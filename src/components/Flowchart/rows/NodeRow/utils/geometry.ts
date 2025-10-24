/**
 * Utility functions for NodeRow geometry and positioning calculations
 */

/**
 * Check if a point is inside a rectangle with padding
 */
export function isInsideWithPadding(
    pt: { x: number; y: number },
    rect: DOMRect | null | undefined,
    pad = 16
): boolean {
    if (!rect) return false;
    return pt.x >= rect.left - pad &&
        pt.x <= rect.right + pad &&
        pt.y >= rect.top - pad &&
        pt.y <= rect.bottom + pad;
}

/**
 * Get rough estimation of the overlay toolbar bounds next to the label/icon
 */
export function getToolbarRect(
    left: number,
    top: number,
    labelEl: HTMLElement | null,
    estWidth = 160
): DOMRect | null {
    if (!labelEl) return null;
    const h = labelEl.getBoundingClientRect().height || 18;
    return {
        left,
        top: top + 3,
        right: left + estWidth,
        bottom: top + 3 + h,
        width: estWidth,
        height: h,
        x: left,
        y: top + 3,
        toJSON: () => ({})
    } as DOMRect;
}

