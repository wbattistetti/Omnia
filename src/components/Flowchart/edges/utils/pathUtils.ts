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
 * Campiona il path e crea segmenti lineari tra punti consecutivi
 */
export function getPathSegments(pathElement: SVGPathElement): PathSegment[] {
  const segments: PathSegment[] = [];
  const pathLength = pathElement.getTotalLength();

  if (pathLength === 0) return segments;

  // Campiona il path con densità sufficiente (ogni 5px o minimo 20 punti)
  const sampleCount = Math.max(20, Math.ceil(pathLength / 5));
  const step = pathLength / sampleCount;

  let prevPoint: DOMPoint | null = null;
  let segmentIndex = 0;

  for (let i = 0; i <= sampleCount; i++) {
    const length = i * step;
    const point = pathElement.getPointAtLength(length);

    if (prevPoint) {
      segments.push({
        start: { x: prevPoint.x, y: prevPoint.y },
        end: { x: point.x, y: point.y },
        index: segmentIndex++,
      });
    }

    prevPoint = point;
  }

  return segments;
}

/**
 * Calcola la distanza minima da un punto a un segmento
 * Restituisce distanza, punto proiettato e parametro t (0-1)
 */
export function distanceToSegment(
  point: { x: number; y: number },
  segment: PathSegment
): { distance: number; projectedPoint: { x: number; y: number }; t: number } {
  const { start, end } = segment;

  // Vettore del segmento
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const segmentLengthSq = dx * dx + dy * dy;

  // Se il segmento è un punto, distanza diretta
  if (segmentLengthSq < 1e-10) {
    const dist = Math.sqrt(
      Math.pow(point.x - start.x, 2) + Math.pow(point.y - start.y, 2)
    );
    return {
      distance: dist,
      projectedPoint: { x: start.x, y: start.y },
      t: 0,
    };
  }

  // Vettore dal punto iniziale al punto
  const px = point.x - start.x;
  const py = point.y - start.y;

  // Proiezione scalare
  const t = Math.max(0, Math.min(1, (px * dx + py * dy) / segmentLengthSq));

  // Punto proiettato sul segmento
  const projectedPoint = {
    x: start.x + t * dx,
    y: start.y + t * dy,
  };

  // Distanza dal punto proiettato
  const distance = Math.sqrt(
    Math.pow(point.x - projectedPoint.x, 2) + Math.pow(point.y - projectedPoint.y, 2)
  );

  return { distance, projectedPoint, t };
}

/**
 * Proietta un punto su un segmento
 */
export function projectPointToSegment(
  point: { x: number; y: number },
  segment: PathSegment
): { x: number; y: number } {
  const { projectedPoint } = distanceToSegment(point, segment);
  return projectedPoint;
}

/**
 * Trova il segmento più vicino a un punto
 * Restituisce null se nessun segmento è entro la soglia
 */
export function findClosestSegment(
  point: { x: number; y: number },
  segments: PathSegment[],
  threshold: number
): { segment: PathSegment; distance: number; projectedPoint: { x: number; y: number } } | null {
  if (segments.length === 0) return null;

  let minDistance = Infinity;
  let closestSegment: PathSegment | null = null;
  let closestProjected: { x: number; y: number } | null = null;

  for (const segment of segments) {
    const { distance, projectedPoint } = distanceToSegment(point, segment);

    if (distance < minDistance) {
      minDistance = distance;
      closestSegment = segment;
      closestProjected = projectedPoint;
    }
  }

  if (minDistance <= threshold && closestSegment && closestProjected) {
    return {
      segment: closestSegment,
      distance: minDistance,
      projectedPoint: closestProjected,
    };
  }

  return null;
}

/**
 * Identifica il segmento corrente di una label
 * (quello a cui appartiene la posizione salvata)
 */
export function getCurrentSegment(
  labelPosition: { x: number; y: number },
  segments: PathSegment[],
  threshold: number
): PathSegment | null {
  const closest = findClosestSegment(labelPosition, segments, threshold);
  return closest ? closest.segment : null;
}

/**
 * Calcola il punto medio di un segmento
 */
export function getSegmentMidpoint(segment: PathSegment): { x: number; y: number } {
  return {
    x: (segment.start.x + segment.end.x) / 2,
    y: (segment.start.y + segment.end.y) / 2,
  };
}
