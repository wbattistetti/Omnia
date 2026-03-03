/**
 * Data migration utilities
 * Migrates legacy control points from {x, y} to {t, offset} format
 */

import { ControlPointRelative, ControlPointLegacy } from '../types/edgeTypes';

/**
 * Migra control points da formato legacy {x, y} a {t, offset}
 */
export function migrateControlPoints(
  legacyPoints: ControlPointLegacy[],
  path: SVGPathElement
): ControlPointRelative[] {
  if (!path || legacyPoints.length === 0) return [];

  const pathLength = path.getTotalLength();
  if (pathLength === 0) return [];

  return legacyPoints.map((legacy) => {
    // Trova t più vicino
    let minDistance = Infinity;
    let bestT = 0.5;

    const samples = 100;
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const point = path.getPointAtLength(pathLength * t);
      const dist = Math.sqrt(
        Math.pow(legacy.x - point.x, 2) + Math.pow(legacy.y - point.y, 2)
      );

      if (dist < minDistance) {
        minDistance = dist;
        bestT = t;
      }
    }

    // Calcola offset (semplificato)
    const basePoint = path.getPointAtLength(pathLength * bestT);
    const dx = legacy.x - basePoint.x;
    const dy = legacy.y - basePoint.y;
    const offset = Math.sqrt(dx * dx + dy * dy) * (dx > 0 ? 1 : -1);

    return {
      t: bestT,
      offset: offset,
    };
  });
}

/**
 * Verifica se un control point è in formato legacy
 */
export function isLegacyControlPoint(
  point: any
): point is ControlPointLegacy {
  return point && typeof point.x === 'number' && typeof point.y === 'number' && point.t === undefined;
}

/**
 * Verifica se un control point è in formato relativo
 */
export function isRelativeControlPoint(
  point: any
): point is ControlPointRelative {
  return point && typeof point.t === 'number' && typeof point.offset === 'number';
}
