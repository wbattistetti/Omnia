/**
 * Centralized coordinate conversion utilities
 * SINGLE SOURCE OF TRUTH for all coordinate transformations
 */

import React from 'react';
import { ControlPointRelative, ControlPointAbsolute, LabelPositionRelative } from '../types/edgeTypes';

export class CoordinateConverter {
  private reactFlowInstance: any;
  private pathRef: React.RefObject<SVGPathElement>;

  constructor(reactFlowInstance: any, pathRef: React.RefObject<SVGPathElement>) {
    this.reactFlowInstance = reactFlowInstance;
    this.pathRef = pathRef;
  }

  /**
   * Flow coordinates → Screen coordinates
   */
  flowToScreen(flowPoint: { x: number; y: number }): { x: number; y: number } {
    const flowToScreen = this.reactFlowInstance?.flowToScreenPosition || this.reactFlowInstance?.project;
    return flowToScreen ? flowToScreen(flowPoint) : flowPoint;
  }

  /**
   * Screen coordinates → Flow coordinates
   */
  screenToFlow(screenPoint: { x: number; y: number }): { x: number; y: number } {
    const screenToFlow = this.reactFlowInstance?.screenToFlowPosition;
    return screenToFlow ? screenToFlow(screenPoint) : screenPoint;
  }

  /**
   * SVG coordinates → Screen coordinates
   */
  svgToScreen(svgPoint: { x: number; y: number }): { x: number; y: number } | null {
    const svg = this.pathRef.current?.ownerSVGElement;
    if (!svg) return null;

    const pt = svg.createSVGPoint();
    pt.x = svgPoint.x;
    pt.y = svgPoint.y;

    const ctm = svg.getScreenCTM();
    if (!ctm) return null;

    const screenPoint = pt.matrixTransform(ctm);
    return { x: screenPoint.x, y: screenPoint.y };
  }

  /**
   * Screen coordinates → SVG coordinates
   */
  screenToSvg(screenPoint: { x: number; y: number }): { x: number; y: number } | null {
    const svg = this.pathRef.current?.ownerSVGElement;
    if (!svg) {
      console.warn('[CoordinateConverter] ❌ screenToSvg: no SVG element');
      return null;
    }

    const pt = svg.createSVGPoint();
    pt.x = screenPoint.x;
    pt.y = screenPoint.y;

    const ctm = svg.getScreenCTM();
    if (!ctm) {
      console.warn('[CoordinateConverter] ❌ screenToSvg: no CTM');
      return null;
    }

    const svgPoint = pt.matrixTransform(ctm.inverse());
    return { x: svgPoint.x, y: svgPoint.y };
  }

  /**
   * Control point relativo → assoluto
   * CRITICO: usa path.getPointAtLength() per convertire t in posizione
   */
  relativeToAbsolute(relative: ControlPointRelative): ControlPointAbsolute | null {
    const path = this.pathRef.current;
    if (!path) return null;

    const pathLength = path.getTotalLength();
    if (pathLength === 0) return null;

    // Clamp t tra 0 e 1
    const t = Math.max(0, Math.min(1, relative.t));
    const length = pathLength * t;

    // Punto base sul path
    const basePoint = path.getPointAtLength(length);

    // Calcola normale al path (perpendicolare)
    const normal = this.getPathNormal(path, length);

    // Applica offset lungo la normale
    const absolutePoint = {
      x: basePoint.x + normal.x * relative.offset,
      y: basePoint.y + normal.y * relative.offset,
    };

    return {
      ...absolutePoint,
      id: `cp-${t}-${relative.offset}`,
    };
  }

  /**
   * Control point assoluto → relativo
   * CRITICO: trova t più vicino e calcola offset
   */
  absoluteToRelative(absolute: ControlPointAbsolute): ControlPointRelative | null {
    const path = this.pathRef.current;
    if (!path) return null;

    const pathLength = path.getTotalLength();
    if (pathLength === 0) return null;

    // Trova il punto più vicino sul path
    let minDistance = Infinity;
    let bestT = 0.5;
    let bestPoint: DOMPoint | null = null;

    // Campiona il path per trovare t ottimale
    const samples = 100;
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const length = pathLength * t;
      const point = path.getPointAtLength(length);

      const dist = Math.sqrt(
        Math.pow(absolute.x - point.x, 2) + Math.pow(absolute.y - point.y, 2)
      );

      if (dist < minDistance) {
        minDistance = dist;
        bestT = t;
        bestPoint = point;
      }
    }

    if (!bestPoint) return null;

    // Calcola normale al path
    const normal = this.getPathNormal(path, pathLength * bestT);

    // Calcola offset (distanza proiettata sulla normale)
    const dx = absolute.x - bestPoint.x;
    const dy = absolute.y - bestPoint.y;
    const offset = dx * normal.x + dy * normal.y;

    return {
      t: bestT,
      offset: offset,
    };
  }

  /**
   * Label position relativa → coordinate SVG assolute
   * Usa lo stesso meccanismo dei control points
   */
  labelRelativeToAbsolute(relative: LabelPositionRelative): { x: number; y: number } | null {
    const path = this.pathRef.current;
    if (!path) return null;

    const pathLength = path.getTotalLength();
    if (pathLength === 0) return null;

    // Clamp t tra 0 e 1
    const t = Math.max(0, Math.min(1, relative.t));
    const length = pathLength * t;

    // Punto base sul path
    const basePoint = path.getPointAtLength(length);

    // Calcola normale al path (perpendicolare)
    const normal = this.getPathNormal(path, length);

    // Applica offset lungo la normale
    return {
      x: basePoint.x + normal.x * relative.offset,
      y: basePoint.y + normal.y * relative.offset,
    };
  }

  /**
   * Coordinate SVG assolute → label position relativa
   * Usa lo stesso meccanismo dei control points
   */
  labelAbsoluteToRelative(absolute: { x: number; y: number }): LabelPositionRelative | null {
    const path = this.pathRef.current;
    if (!path) return null;

    const pathLength = path.getTotalLength();
    if (pathLength === 0) return null;

    // Trova il punto più vicino sul path
    let minDistance = Infinity;
    let bestT = 0.5;
    let bestPoint: DOMPoint | null = null;

    // Campiona il path per trovare t ottimale
    const samples = 100;
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const length = pathLength * t;
      const point = path.getPointAtLength(length);

      const dist = Math.sqrt(
        Math.pow(absolute.x - point.x, 2) + Math.pow(absolute.y - point.y, 2)
      );

      if (dist < minDistance) {
        minDistance = dist;
        bestT = t;
        bestPoint = point;
      }
    }

    if (!bestPoint) return null;

    // Calcola normale al path
    const normal = this.getPathNormal(path, pathLength * bestT);

    // Calcola offset (distanza proiettata sulla normale)
    const dx = absolute.x - bestPoint.x;
    const dy = absolute.y - bestPoint.y;
    const offset = dx * normal.x + dy * normal.y;

    return {
      t: bestT,
      offset: offset,
    };
  }

  /**
   * Calcola vettore normale al path in un punto
   */
  private getPathNormal(path: SVGPathElement, length: number): { x: number; y: number } {
    const epsilon = 1;
    const point1 = path.getPointAtLength(Math.max(0, length - epsilon));
    const point2 = path.getPointAtLength(Math.min(path.getTotalLength(), length + epsilon));

    // Vettore tangente
    const dx = point2.x - point1.x;
    const dy = point2.y - point1.y;
    const length_tangent = Math.sqrt(dx * dx + dy * dy);

    if (length_tangent < 1e-10) {
      return { x: 0, y: 1 }; // Default normale verticale
    }

    // Normale (perpendicolare, ruotata di 90°)
    return {
      x: -dy / length_tangent,
      y: dx / length_tangent,
    };
  }
}
