/**
 * Edge types for CustomEdge architecture
 * Defines coordinate systems and data structures
 */

/**
 * Control point in formato relativo (PERSISTITO in edge.data)
 * t: posizione lungo il path (0 = source, 1 = target)
 * offset: distanza perpendicolare dal path (positivo = destra, negativo = sinistra)
 */
export interface ControlPointRelative {
  t: number;        // 0 = source, 1 = target
  offset: number;   // distanza perpendicolare (positivo = destra, negativo = sinistra)
}

/**
 * Control point in formato assoluto (RUNTIME per rendering)
 * Usato solo durante il rendering e il drag
 */
export interface ControlPointAbsolute {
  x: number;
  y: number;
  id: string;
}

/**
 * Label position in SVG coordinates (PERSISTITO)
 */
export interface LabelPositionSvg {
  x: number;
  y: number;
}

/**
 * Legacy control point format (per migrazione)
 * @deprecated Usa ControlPointRelative invece
 */
export interface ControlPointLegacy {
  x: number;
  y: number;
}
