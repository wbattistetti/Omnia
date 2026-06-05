/**
 * Z-index for flow UI portaled to document.body (row toolbars, pickers).
 * Must stay below dock elevated panels (50) and above in-canvas node chrome (~15).
 */
export const FLOW_PORTAL_OVERLAY_Z_INDEX = 25;

export const FLOW_PORTAL_OVERLAY_Z_INDEX_CSS = String(FLOW_PORTAL_OVERLAY_Z_INDEX);
