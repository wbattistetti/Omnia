import { describe, expect, it } from 'vitest';
import { screenPointToFlow, flowPointToScreen } from '../flowScreenProjection';

describe('flowScreenProjection', () => {
  const pane = { left: 100, top: 50, width: 800, height: 600 };
  const viewport = { x: 10, y: 20, zoom: 2 };

  it('screenPointToFlow inverts flowPointToScreen', () => {
    const flow = { x: 120, y: 80 };
    const screen = flowPointToScreen(flow.x, flow.y, viewport, pane);
    expect(screen).not.toBeNull();
    const back = screenPointToFlow(screen!.x, screen!.y, viewport, pane);
    expect(back).toEqual(flow);
  });
});
