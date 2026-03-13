/**
 * Utility functions for path manipulation
 */

export interface PathVertex {
  x: number;
  y: number;
  id: string;
}

/**
 * Extract vertices from an SVG path string
 * Returns array of {x, y, id} for each vertex
 */
export function extractPathVertices(pathString: string): PathVertex[] {
  const vertices: PathVertex[] = [];
  const commands = pathString.match(/[MmLlHhVvCcSsQqTtAaZz][^MmLlHhVvCcSsQqTtAaZz]*/g) || [];

  let currentX = 0;
  let currentY = 0;
  let vertexIndex = 0;

  for (const cmd of commands) {
    const type = cmd[0];
    const coords = cmd
      .slice(1)
      .trim()
      .split(/[\s,]+/)
      .map(Number)
      .filter((n) => !isNaN(n));

    const isAbsolute = type === type.toUpperCase();
    const lowerType = type.toLowerCase();

    switch (lowerType) {
      case 'm': // Move to
        if (isAbsolute) {
          currentX = coords[0] || currentX;
          currentY = coords[1] || currentY;
        } else {
          currentX += coords[0] || 0;
          currentY += coords[1] || 0;
        }
        vertices.push({ x: currentX, y: currentY, id: `v${vertexIndex++}` });
        break;
      case 'l': // Line to
        if (isAbsolute) {
          currentX = coords[0] || currentX;
          currentY = coords[1] || currentY;
        } else {
          currentX += coords[0] || 0;
          currentY += coords[1] || 0;
        }
        vertices.push({ x: currentX, y: currentY, id: `v${vertexIndex++}` });
        break;
      case 'h': // Horizontal line
        if (isAbsolute) {
          currentX = coords[0] || currentX;
        } else {
          currentX += coords[0] || 0;
        }
        vertices.push({ x: currentX, y: currentY, id: `v${vertexIndex++}` });
        break;
      case 'v': // Vertical line
        if (isAbsolute) {
          currentY = coords[0] || currentY;
        } else {
          currentY += coords[0] || 0;
        }
        vertices.push({ x: currentX, y: currentY, id: `v${vertexIndex++}` });
        break;
      // For curves, we extract the end point
      case 'c': // Cubic bezier
      case 's': // Smooth cubic bezier
        if (isAbsolute) {
          currentX = coords[coords.length - 2] || currentX;
          currentY = coords[coords.length - 1] || currentY;
        } else {
          currentX += coords[coords.length - 2] || 0;
          currentY += coords[coords.length - 1] || 0;
        }
        vertices.push({ x: currentX, y: currentY, id: `v${vertexIndex++}` });
        break;
      case 'q': // Quadratic bezier
      case 't': // Smooth quadratic bezier
        if (isAbsolute) {
          currentX = coords[coords.length - 2] || currentX;
          currentY = coords[coords.length - 1] || currentY;
        } else {
          currentX += coords[coords.length - 2] || 0;
          currentY += coords[coords.length - 1] || 0;
        }
        vertices.push({ x: currentX, y: currentY, id: `v${vertexIndex++}` });
        break;
      case 'a': // Arc
        if (isAbsolute) {
          currentX = coords[coords.length - 2] || currentX;
          currentY = coords[coords.length - 1] || currentY;
        } else {
          currentX += coords[coords.length - 2] || 0;
          currentY += coords[coords.length - 1] || 0;
        }
        vertices.push({ x: currentX, y: currentY, id: `v${vertexIndex++}` });
        break;
      case 'z': // Close path
        // Don't add vertex for close path
        break;
    }
  }

  return vertices;
}

/**
 * Build path string from vertices
 * Creates a simple polyline path
 */
export function buildPathFromVertices(vertices: PathVertex[]): string {
  if (vertices.length === 0) return '';
  if (vertices.length === 1) return `M ${vertices[0].x},${vertices[0].y}`;

  const pathParts = vertices.map((v, i) => (i === 0 ? `M ${v.x},${v.y}` : `L ${v.x},${v.y}`));
  return pathParts.join(' ');
}

/**
 * Path segment interface for geometric calculations
 */
export interface PathSegment {
  start: { x: number; y: number };
  end: { x: number; y: number };
  index: number;
}

/**
 * Estrae segmenti lineari da un path SVG
 * ✅ FIX: Usa i vertici reali del path invece di campionare ogni 5px
 * Questo produce i segmenti geometrici reali (es. 3 segmenti per V-H-V) invece di 80 micro-segmenti
 */
export function getPathSegments(pathElement: SVGPathElement): PathSegment[] {
  const pathD = pathElement.getAttribute('d');
  if (!pathD) return [];

  // ✅ Estrai i vertici reali dal path string
  const vertices = extractPathVertices(pathD);
  if (vertices.length < 2) return [];

  // ✅ Crea segmenti tra vertici consecutivi
  return vertices.slice(0, -1).map((vertex, i) => ({
    start: { x: vertex.x, y: vertex.y },
    end: { x: vertices[i + 1].x, y: vertices[i + 1].y },
    index: i,
  }));
}

// ❌ REMOVED: All continuous calculation functions
// - distanceToSegment: removed (continuous distance calculation)
// - projectPointToSegment: removed (orthogonal projection)
// - findClosestSegment: removed (continuous distance-based search)
// - getCurrentSegment: removed (uses findClosestSegment)
//
// ✅ NEW MODEL: Only discrete functions remain:
// - getPathSegments: extracts segments from path
// - getSegmentMidpoint: calculates midpoint of a segment

/**
 * Calcola il punto medio di un segmento
 */
export function getSegmentMidpoint(segment: PathSegment): { x: number; y: number } {
  return {
    x: (segment.start.x + segment.end.x) / 2,
    y: (segment.start.y + segment.end.y) / 2,
  };
}
