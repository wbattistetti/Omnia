// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { NODE_FONT, NODE_PADDING_H, NODE_MIN_WIDTH } from '../constants/nodeConstants';

/**
 * Measures text width using Canvas API for accurate sizing.
 * Pure function: no side effects.
 */
export function measureText(text: string, font: string): number {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return NODE_MIN_WIDTH;
  ctx.font = font;
  return ctx.measureText(text).width;
}

/**
 * Calculates the actual width of a node based on its label.
 * Uses the same logic as the GrammarNode component.
 * Pure function: no side effects.
 */
export function calculateNodeWidth(label: string): number {
  if (!label) return NODE_MIN_WIDTH;
  const textWidth = measureText(label, NODE_FONT);
  return Math.max(textWidth + NODE_PADDING_H, NODE_MIN_WIDTH);
}

/**
 * Calculates the right edge (X coordinate) of a node.
 * Right = position.x + width
 * Pure function: no side effects.
 */
export function getNodeRight(node: { position: { x: number; y: number }; label: string }): number {
  const nodeWidth = calculateNodeWidth(node.label);
  return node.position.x + nodeWidth;
}
