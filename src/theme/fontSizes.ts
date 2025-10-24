// Centralized font size constants for consistent styling across Omnia
// Use these constants instead of hardcoded values to maintain visual harmony

export const FONT_SIZES = {
    // Node titles and headers
    NODE_TITLE: '8px',

    // Edge captions and labels (same as node title for consistency)
    EDGE_CAPTION: '8px',

    // Node row text and content
    NODE_ROW: '12px',

    // Tooltips and helper text
    TOOLTIP: '12px',

    // UI elements and buttons
    UI_ELEMENT: '12px',

    // Intellisense and search
    INTELLISENSE: '14px',
} as const;

// Font size utility functions
export const getZoomAdjustedSize = (baseSize: string, zoom: number = 1): string => {
    const numericSize = parseInt(baseSize);
    return `${numericSize * zoom}px`;
};

// Common combinations
export const FONT_SIZE_PRESETS = {
    nodeTitle: FONT_SIZES.NODE_TITLE,
    edgeCaption: (zoom: number = 1) => getZoomAdjustedSize(FONT_SIZES.EDGE_CAPTION, zoom),
    nodeRow: FONT_SIZES.NODE_ROW,
    tooltip: FONT_SIZES.TOOLTIP,
} as const;
