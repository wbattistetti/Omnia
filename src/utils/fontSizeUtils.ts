/**
 * Utility functions for calculating UI element dimensions based on font size
 * Centralizes all size calculations to avoid code duplication
 */

/**
 * Parse font size string (e.g., "14px") to number
 */
function parseFontSize(fontSize: string | number): number {
  if (typeof fontSize === 'number') return fontSize;
  const numeric = parseFloat(fontSize);
  return isNaN(numeric) ? 14 : numeric; // Default to 14px
}

/**
 * Calculate all UI element dimensions based on font size
 * Uses the same ratios as the node toolbar for consistency
 */
export interface FontBasedSizes {
  // Icon sizes (same ratio as node toolbar: 1.19)
  iconSize: number; // fontSize * 1.19

  // Button sizes
  iconButtonSize: number; // fontSize * 1.3 (for icon-only buttons)

  // Input/Textbox dimensions
  inputHeight: number; // fontSize * 1.5
  inputPaddingV: number; // fontSize * 0.5 (increased from 0.35)
  inputPaddingH: number; // fontSize * 0.5

  // Button dimensions
  buttonHeight: number; // fontSize * 1.5 (same as input)
  buttonPaddingV: number; // fontSize * 0.5 (increased from 0.35)
  buttonPaddingH: number; // fontSize * 0.5
}

/**
 * Calculate all sizes based on font size
 * @param fontSize - Font size as string ("14px") or number
 * @returns Object with all calculated dimensions
 */
export function calculateFontBasedSizes(fontSize: string | number): FontBasedSizes {
  const fontSizeNum = parseFontSize(fontSize);

  return {
    // Icon sizes - same as node toolbar (1.19 ratio)
    iconSize: fontSizeNum * 1.19,

    // Icon button size
    iconButtonSize: fontSizeNum * 1.3,

    // Input/Textbox dimensions
    inputHeight: fontSizeNum * 1.5,
    inputPaddingV: fontSizeNum * 0.5, // ✅ Increased from 0.35
    inputPaddingH: fontSizeNum * 0.5,

    // Button dimensions (same as input for consistency)
    buttonHeight: fontSizeNum * 1.5,
    buttonPaddingV: fontSizeNum * 0.5, // ✅ Increased from 0.35
    buttonPaddingH: fontSizeNum * 0.5,
  };
}

