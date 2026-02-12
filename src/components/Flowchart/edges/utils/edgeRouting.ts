/**
 * Orthogonal edge routing utilities
 * Provides functions for generating orthogonal (90-degree) edge paths
 */

/**
 * Generates a Vertical-Horizontal-Vertical (VHV) orthogonal path
 * Pattern: Down/Up → Right/Left → Down/Up
 *
 * @param sx - Source X coordinate
 * @param sy - Source Y coordinate
 * @param tx - Target X coordinate
 * @param ty - Target Y coordinate
 * @returns SVG path string in compact format
 */
export function getVHVPath(sx: number, sy: number, tx: number, ty: number): string {
  const midY = (sy + ty) / 2;
  return `M ${sx},${sy} L ${sx},${midY} L ${tx},${midY} L ${tx},${ty}`;
}

/**
 * Generates a Horizontal-Vertical-Horizontal (HVH) orthogonal path
 * Pattern: Right/Left → Down/Up → Right/Left
 *
 * @param sx - Source X coordinate
 * @param sy - Source Y coordinate
 * @param tx - Target X coordinate
 * @param ty - Target Y coordinate
 * @returns SVG path string in compact format
 */
export function getHVHPath(sx: number, sy: number, tx: number, ty: number): string {
  const midX = (sx + tx) / 2;
  return `M ${sx},${sy} L ${midX},${sy} L ${midX},${ty} L ${tx},${ty}`;
}

/**
 * Automatically selects between VHV and HVH based on geometry
 * - If vertical distance (dy) > horizontal distance (dx) → uses VHV
 * - Otherwise → uses HVH
 *
 * This ensures the path follows the longer dimension first for better visual flow.
 *
 * @param sx - Source X coordinate
 * @param sy - Source Y coordinate
 * @param tx - Target X coordinate
 * @param ty - Target Y coordinate
 * @returns SVG path string in compact format
 */
export function getAutoOrthoPath(sx: number, sy: number, tx: number, ty: number): string {
  const dx = Math.abs(tx - sx);
  const dy = Math.abs(ty - sy);

  if (dy > dx) {
    // Vertical distance is greater → use VHV (Vertical-Horizontal-Vertical)
    return getVHVPath(sx, sy, tx, ty);
  } else {
    // Horizontal distance is greater or equal → use HVH (Horizontal-Vertical-Horizontal)
    return getHVHPath(sx, sy, tx, ty);
  }
}

/**
 * Generates a VHV path with rounded corners using SVG arc commands
 * Currently returns the standard VHV path as fallback.
 *
 * @param sx - Source X coordinate
 * @param sy - Source Y coordinate
 * @param tx - Target X coordinate
 * @param ty - Target Y coordinate
 * @param radius - Corner radius in pixels (default: 8)
 * @returns SVG path string with rounded corners
 */
export function getRoundedVHVPath(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  radius: number = 8
): string {
  // TODO: Implement rounded corners using SVG arc (A) commands
  // For now, return standard VHV path as fallback
  return getVHVPath(sx, sy, tx, ty);
}

/**
 * Generates an HVH path with rounded corners using SVG arc commands
 * Currently returns the standard HVH path as fallback.
 *
 * @param sx - Source X coordinate
 * @param sy - Source Y coordinate
 * @param tx - Target X coordinate
 * @param ty - Target Y coordinate
 * @param radius - Corner radius in pixels (default: 8)
 * @returns SVG path string with rounded corners
 */
export function getRoundedHVHPath(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  radius: number = 8
): string {
  // TODO: Implement rounded corners using SVG arc (A) commands
  // For now, return standard HVH path as fallback
  return getHVHPath(sx, sy, tx, ty);
}

/**
 * Automatically selects between rounded VHV and HVH based on geometry
 * Currently returns the standard auto-ortho path as fallback.
 *
 * @param sx - Source X coordinate
 * @param sy - Source Y coordinate
 * @param tx - Target X coordinate
 * @param ty - Target Y coordinate
 * @param radius - Corner radius in pixels (default: 8)
 * @returns SVG path string with rounded corners
 */
export function getRoundedAutoOrthoPath(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  radius: number = 8
): string {
  // TODO: Implement rounded corners using SVG arc (A) commands
  // For now, return standard auto-ortho path as fallback
  return getAutoOrthoPath(sx, sy, tx, ty);
}
