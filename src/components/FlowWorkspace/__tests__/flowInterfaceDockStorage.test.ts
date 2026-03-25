/**
 * Tests for flow-area–aware clamp helpers (panel must not exceed flow canvas bounds).
 */

import { describe, expect, it } from 'vitest';
import { clampHeight, clampWidth, MIN_H, MIN_W } from '../flowInterfaceDockStorage';

describe('flowInterfaceDockStorage clamp', () => {
  it('clampHeight respects container cap below window max', () => {
    const capped = clampHeight(800, 220);
    expect(capped).toBeLessThanOrEqual(220);
    expect(capped).toBeGreaterThanOrEqual(Math.min(MIN_H, 220));
  });

  it('clampWidth respects container cap below window max', () => {
    const capped = clampWidth(900, 280);
    expect(capped).toBeLessThanOrEqual(280);
    expect(capped).toBeGreaterThanOrEqual(Math.min(MIN_W, 280));
  });

  it('clampHeight allows down to container when container is smaller than MIN_H', () => {
    expect(clampHeight(500, 100)).toBe(100);
  });

  it('clampWidth allows down to container when container is smaller than MIN_W', () => {
    expect(clampWidth(500, 120)).toBe(120);
  });
});
