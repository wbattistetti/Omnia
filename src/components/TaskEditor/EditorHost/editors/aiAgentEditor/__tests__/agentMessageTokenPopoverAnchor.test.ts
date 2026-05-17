import { describe, expect, it } from 'vitest';
import {
  buildTokenPopoverAnchorBelowCaret,
  resolveFloatingPopoverPosition,
  resolveFloatingPopoverTop,
} from '../agentMessageTokenPopoverAnchor';

describe('agentMessageTokenPopoverAnchor', () => {
  it('buildTokenPopoverAnchorBelowCaret offsets below line height', () => {
    const a = buildTokenPopoverAnchorBelowCaret({ top: 100, left: 50 }, 20);
    expect(a.caretTop).toBe(100);
    expect(a.left).toBe(50);
    expect(a.top).toBe(126);
  });

  it('resolveFloatingPopoverTop flips above when below would overflow', () => {
    const anchor = buildTokenPopoverAnchorBelowCaret({ top: 100, left: 40 }, 16);
    const below = resolveFloatingPopoverTop({
      anchor,
      popoverHeight: 60,
      viewportHeight: 220,
    });
    expect(below.placement).toBe('below');

    const above = resolveFloatingPopoverTop({
      anchor: { ...anchor, top: 170 },
      popoverHeight: 120,
      viewportHeight: 200,
    });
    expect(above.placement).toBe('above');
    expect(above.top).toBeLessThan(anchor.caretTop);
  });

  it('resolveFloatingPopoverPosition clamps horizontal when right-align would overflow left', () => {
    const anchor = buildTokenPopoverAnchorBelowCaret({ top: 80, left: 12 }, 16);
    const pos = resolveFloatingPopoverPosition({
      anchor,
      popoverWidth: 200,
      popoverHeight: 40,
      viewportWidth: 400,
      viewportHeight: 600,
    });
    expect(pos.left).toBeGreaterThanOrEqual(8);
    expect(pos.left + 200).toBeLessThanOrEqual(392);
    expect(pos.left).toBe(12);
  });

  it('resolveFloatingPopoverPosition right-aligns to caret when there is room', () => {
    const anchor = buildTokenPopoverAnchorBelowCaret({ top: 80, left: 300 }, 16);
    const pos = resolveFloatingPopoverPosition({
      anchor,
      popoverWidth: 180,
      popoverHeight: 40,
      viewportWidth: 800,
      viewportHeight: 600,
    });
    expect(pos.left).toBe(120);
  });

  it('resolveFloatingPopoverPosition clamps when panel is wider than viewport', () => {
    const anchor = buildTokenPopoverAnchorBelowCaret({ top: 80, left: 50 }, 16);
    const pos = resolveFloatingPopoverPosition({
      anchor,
      popoverWidth: 500,
      popoverHeight: 40,
      viewportWidth: 320,
      viewportHeight: 600,
    });
    expect(pos.left).toBe(8);
  });
});
